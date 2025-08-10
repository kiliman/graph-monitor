const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs').promises;
const path = require('path');
const { format, subHours, subDays } = require('date-fns');

class ChartGenerator {
  constructor(database, config, logger) {
    this.database = database;
    this.config = config;
    this.logger = logger;
    this.width = 800;
    this.height = 400;
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({ 
      width: this.width, 
      height: this.height,
      backgroundColour: 'white'
    });
  }

  async generateAllCharts() {
    try {
      const outputDir = path.join(__dirname, '..', 'charts');
      await fs.mkdir(outputDir, { recursive: true });

      const graphs = this.config.getGraphs();
      
      for (const [title, graphConfig] of Object.entries(graphs)) {
        await this.generateChart(title, graphConfig);
      }
      
      await this.generateIndexHtml();
      
      this.logger.info('Generated all charts successfully');
    } catch (error) {
      this.logger.error(`Error generating charts: ${error.message}`);
    }
  }

  async generateChart(title, config) {
    try {
      const data = await this.fetchChartData(title, config);
      
      if (!data || data.length === 0) {
        this.logger.warn(`No data available for chart: ${title}`);
        return;
      }

      const chartConfig = this.createChartConfig(title, config, data);
      const buffer = await this.chartJSNodeCanvas.renderToBuffer(chartConfig);
      
      const filename = this.sanitizeFilename(title) + '.png';
      const filepath = path.join(__dirname, '..', 'charts', filename);
      
      await fs.writeFile(filepath, buffer);
      this.logger.debug(`Generated chart: ${filename}`);
    } catch (error) {
      this.logger.error(`Error generating chart "${title}": ${error.message}`);
    }
  }

  async fetchChartData(title, config) {
    const metricKey = this.extractMetricKey(title);
    const yAxisName = config['y-axis'];
    const now = Math.floor(Date.now() / 1000);
    const startTime = this.getStartTime(config.limit, now);
    
    let data;
    if (config.source === 'latest') {
      if (metricKey === 'all') {
        data = await this.database.all(
          `SELECT timestamp, key, value, unit 
           FROM metrics 
           WHERE name = ? AND timestamp >= ?
           ORDER BY timestamp DESC 
           LIMIT 1000`,
          [yAxisName, startTime]
        );
      } else {
        data = await this.database.all(
          `SELECT timestamp, value, unit 
           FROM metrics 
           WHERE key = ? AND name = ? AND timestamp >= ?
           ORDER BY timestamp DESC 
           LIMIT 1000`,
          [metricKey, yAxisName, startTime]
        );
      }
    } else if (config.source.startsWith('rollup-')) {
      const increment = config.source.replace('rollup-', '');
      data = await this.database.all(
        `SELECT timestamp, min, max, average, unit
         FROM rollups
         WHERE increment = ? AND key = ? AND name = ? AND timestamp >= ?
         ORDER BY timestamp DESC
         LIMIT 120`,
        [increment, metricKey, yAxisName, startTime]
      );
    }
    
    return data ? data.reverse() : [];
  }

  createChartConfig(title, config, data) {
    const chartType = this.getChartType(config.type);
    const isMultiSeries = data.length > 0 && data[0].key;
    
    let datasets;
    let labels;
    
    if (isMultiSeries) {
      // Group data by key for multi-series charts
      const groupedData = this.groupDataByKey(data);
      labels = this.getUniqueTimestamps(data);
      datasets = Object.entries(groupedData).map(([key, values], index) => ({
        label: key,
        data: this.alignDataToLabels(values, labels),
        backgroundColor: this.getColor(index),
        borderColor: this.getColor(index),
        fill: false,
        tension: 0.1
      }));
    } else {
      labels = data.map(d => this.formatTimestamp(d.timestamp));
      const values = data.map(d => d.average || d.value);
      datasets = [{
        label: config['y-axis'],
        data: values,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 2,
        fill: chartType === 'line' ? false : true,
        tension: 0.1
      }];
    }

    return {
      type: chartType,
      data: {
        labels,
        datasets
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: title,
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'bottom'
          }
        },
        scales: {
          x: {
            display: true,
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            display: true,
            beginAtZero: true
          }
        }
      }
    };
  }

  groupDataByKey(data) {
    const grouped = {};
    data.forEach(item => {
      if (!grouped[item.key]) {
        grouped[item.key] = [];
      }
      grouped[item.key].push({
        timestamp: item.timestamp,
        value: item.value
      });
    });
    return grouped;
  }

  getUniqueTimestamps(data) {
    const timestamps = [...new Set(data.map(d => d.timestamp))];
    return timestamps.sort((a, b) => a - b).map(ts => this.formatTimestamp(ts));
  }

  alignDataToLabels(values, labels) {
    const timestampMap = {};
    values.forEach(v => {
      timestampMap[this.formatTimestamp(v.timestamp)] = v.value;
    });
    return labels.map(label => timestampMap[label] || null);
  }

  getChartType(type) {
    const typeMap = {
      'LineChart': 'line',
      'BarChart': 'bar',
      'AreaChart': 'line'
    };
    return typeMap[type] || 'line';
  }

  getColor(index) {
    const colors = [
      'rgb(75, 192, 192)',
      'rgb(255, 99, 132)',
      'rgb(54, 162, 235)',
      'rgb(255, 205, 86)',
      'rgb(153, 102, 255)',
      'rgb(255, 159, 64)'
    ];
    return colors[index % colors.length];
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return format(date, 'HH:mm:ss');
    }
    
    return format(date, 'MMM dd HH:mm');
  }

  getStartTime(limit, now) {
    const units = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
      'mo': 2592000,
      'y': 31536000
    };
    
    const match = limit.match(/^(\d+)([smhdy]|mo)$/);
    if (!match) return 0;
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    return now - (value * units[unit]);
  }

  extractMetricKey(title) {
    const matches = title.match(/:\s*([^(]+)/);
    if (matches && matches[1]) {
      const domain = matches[1].trim();
      
      if (domain.includes('bigdeskenergy')) return 'bde';
      if (domain.includes('google')) return 'google';
      if (domain.toLowerCase().includes('all sites')) return 'all';
      
      return domain.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    return null;
  }

  sanitizeFilename(title) {
    return title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async generateIndexHtml() {
    const graphs = this.config.getGraphs();
    const chartFiles = Object.keys(graphs).map(title => ({
      title,
      filename: this.sanitizeFilename(title) + '.png'
    }));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="30">
  <title>Graph Monitor Dashboard</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .dashboard {
      max-width: 1600px;
      margin: 0 auto;
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
    }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(800px, 1fr));
      gap: 30px;
    }
    .chart {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .chart img {
      width: 100%;
      height: auto;
      display: block;
    }
    .timestamp {
      text-align: center;
      color: #666;
      margin-top: 20px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="dashboard">
    <h1>Graph Monitor Dashboard</h1>
    <div class="charts-grid">
${chartFiles.map(({ filename }) => `      <div class="chart">
        <img src="${filename}" alt="Chart">
      </div>`).join('\n')}
    </div>
    <div class="timestamp">
      Last updated: ${new Date().toLocaleString()} (Auto-refreshes every 30 seconds)
    </div>
  </div>
</body>
</html>`;

    const indexPath = path.join(__dirname, '..', 'charts', 'index.html');
    await fs.writeFile(indexPath, html);
    this.logger.info('Generated index.html');
  }
}

module.exports = ChartGenerator;
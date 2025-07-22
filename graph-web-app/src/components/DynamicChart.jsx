import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { getLatestMetrics, getRollupMetrics } from '../services/api';
import { getStartTime, transformMetricsData, extractMetricKey, formatTimestamp } from '../utils/dataUtils';

const chartComponents = {
  LineChart: { Chart: LineChart, DataComponent: Line },
  BarChart: { Chart: BarChart, DataComponent: Bar },
  AreaChart: { Chart: AreaChart, DataComponent: Area }
};

export default function DynamicChart({ title, config, refreshTrigger }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialRender, setIsInitialRender] = useState(true);

  useEffect(() => {
    fetchData();
  }, [config, refreshTrigger]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const metricKey = extractMetricKey(title);
      if (!metricKey) {
        throw new Error('Could not extract metric key from title');
      }
      
      const yAxisName = config['y-axis'];
      const startTime = getStartTime(config.limit);
      
      let rawData;
      if (config.source === 'latest') {
        const limitSeconds = getStartTime(config.limit);
        const approxRecords = Math.ceil((Date.now() / 1000 - limitSeconds) / 30);
        rawData = await getLatestMetrics(metricKey, yAxisName, Math.min(approxRecords * 2, 5000));
        
        rawData = rawData.filter(item => item.timestamp >= startTime);
      } else if (config.source.startsWith('rollup-')) {
        const increment = config.source.replace('rollup-', '');
        rawData = await getRollupMetrics(increment, metricKey, yAxisName, startTime);
      }
      
      // For "all sites", we need to handle multiple keys
      let transformedData;
      if (metricKey === 'all' && rawData.length > 0 && rawData[0].key) {
        // Group data by timestamp and aggregate
        const groupedData = {};
        rawData.forEach(item => {
          const timestamp = item.timestamp;
          if (!groupedData[timestamp]) {
            groupedData[timestamp] = { timestamp, data: {} };
          }
          groupedData[timestamp].data[item.key] = item.value;
        });
        
        transformedData = Object.values(groupedData).map(item => ({
          timestamp: formatTimestamp(item.timestamp),
          ...item.data
        }));
      } else {
        transformedData = transformMetricsData(
          rawData,
          config['x-axis'],
          config['y-axis']
        );
      }
      
      setData(transformedData);
      
      // After first render, disable animations
      if (isInitialRender) {
        setTimeout(() => setIsInitialRender(false), 1500);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching chart data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="chart-container">
        <h3>{title}</h3>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-container">
        <h3>{title}</h3>
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  const { Chart, DataComponent } = chartComponents[config.type] || chartComponents.LineChart;
  const xAxisKey = config['x-axis'] === 'timestamp' ? 'timestamp' : config['x-axis'];
  const yAxisKey = config['y-axis'];
  const metricKey = extractMetricKey(title);

  // Get all unique keys from data for "all sites" charts
  const dataKeys = metricKey === 'all' && data.length > 0 
    ? Object.keys(data[0]).filter(key => key !== 'timestamp' && key !== xAxisKey)
    : [yAxisKey];

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

  return (
    <div className="chart-container">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <Chart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={xAxisKey}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis />
          <Tooltip />
          <Legend />
          {dataKeys.map((key, index) => (
            <DataComponent
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[index % colors.length]}
              fill={colors[index % colors.length]}
              strokeWidth={2}
              isAnimationActive={isInitialRender}
            />
          ))}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
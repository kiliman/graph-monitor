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
import { getStartTime, transformMetricsData, extractMetricKey } from '../utils/dataUtils';

const chartComponents = {
  LineChart: { Chart: LineChart, DataComponent: Line },
  BarChart: { Chart: BarChart, DataComponent: Bar },
  AreaChart: { Chart: AreaChart, DataComponent: Area }
};

export default function DynamicChart({ title, config }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [config]);

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
      
      const transformedData = transformMetricsData(
        rawData,
        config['x-axis'],
        config['y-axis']
      );
      
      setData(transformedData);
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
          <DataComponent
            type="monotone"
            dataKey={yAxisKey}
            stroke="#8884d8"
            fill="#8884d8"
            strokeWidth={2}
          />
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import DynamicChart from './DynamicChart';
import { getConfig } from '../services/api';

export default function Dashboard() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (config) {
      const interval = setInterval(() => {
        setRefreshKey(prev => prev + 1);
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [config]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getConfig();
      setConfig(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return <div className="dashboard loading">Loading configuration...</div>;
  }

  if (error) {
    return <div className="dashboard error">Error loading configuration: {error}</div>;
  }

  const graphs = config?.graphs || {};

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Graph Monitor Dashboard</h1>
        <button onClick={handleRefresh} className="refresh-button">
          Refresh All
        </button>
      </div>
      
      <div className="charts-grid">
        {Object.entries(graphs).map(([title, graphConfig]) => (
          <DynamicChart
            key={`${title}-${refreshKey}`}
            title={title}
            config={graphConfig}
          />
        ))}
      </div>
      
      {Object.keys(graphs).length === 0 && (
        <div className="no-graphs">
          No graphs configured. Please check your config.json file.
        </div>
      )}
    </div>
  );
}
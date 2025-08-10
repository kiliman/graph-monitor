export function parseTimeLimit(limit) {
  const units = {
    's': 1,
    'm': 60,
    'h': 3600,
    'd': 86400,
    'mo': 2592000,
    'y': 31536000
  };
  
  const match = limit.match(/^(\d+)([smhdy]|mo)$/);
  if (!match) return null;
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  return value * units[unit];
}

export function getStartTime(limit) {
  const seconds = parseTimeLimit(limit);
  if (!seconds) return 0;
  
  return Math.floor(Date.now() / 1000) - seconds;
}

export function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function transformMetricsData(data, xAxis, yAxis) {
  return data.map(item => ({
    ...item,
    [xAxis]: xAxis === 'timestamp' ? formatTimestamp(item.timestamp) : item[xAxis],
    [yAxis]: item[yAxis] || item.value || item.average
  }));
}

export function extractMetricKey(graphKey) {
  const matches = graphKey.match(/:\s*([^(]+)/);
  if (matches && matches[1]) {
    const domain = matches[1].trim();
    
    if (domain.includes('bigdeskenergy')) return 'bde';
    if (domain.includes('google')) return 'google';
    
    return domain.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  return null;
}
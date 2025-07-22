const API_BASE = 'http://localhost:3001/api';

export async function getConfig() {
  const response = await fetch(`${API_BASE}/config`);
  if (!response.ok) throw new Error('Failed to fetch configuration');
  return response.json();
}

export async function getLatestMetrics(key, name, limit) {
  const params = new URLSearchParams({
    key,
    name,
    limit: limit.toString()
  });
  
  const response = await fetch(`${API_BASE}/metrics/latest?${params}`);
  if (!response.ok) throw new Error('Failed to fetch latest metrics');
  return response.json();
}

export async function getRollupMetrics(increment, key, name, startTime) {
  const params = new URLSearchParams({
    increment,
    key,
    name,
    startTime: startTime.toString()
  });
  
  const response = await fetch(`${API_BASE}/metrics/rollup?${params}`);
  if (!response.ok) throw new Error('Failed to fetch rollup metrics');
  return response.json();
}

export async function getMetricKeys() {
  const response = await fetch(`${API_BASE}/metrics/keys`);
  if (!response.ok) throw new Error('Failed to fetch metric keys');
  return response.json();
}
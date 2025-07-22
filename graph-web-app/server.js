const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, '..', 'metrics.db');
const configPath = path.join(__dirname, '..', 'config.json');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to metrics database');
  }
});

app.get('/api/config', (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

app.get('/api/metrics/latest', (req, res) => {
  const { key, name, limit } = req.query;
  const limitValue = parseInt(limit) || 100;
  
  console.log('Request params:', { key, name, limit, limitValue });
  
  let sql;
  let params;
  
  if (key === 'all') {
    sql = `
      SELECT timestamp, key, value, unit
      FROM metrics
      WHERE name = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    params = [name, limitValue];
  } else {
    sql = `
      SELECT timestamp, value, unit
      FROM metrics
      WHERE key = ? AND name = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    params = [key, name, limitValue];
  }
  
  console.log('SQL:', sql);
  console.log('Params:', params);
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: err.message });
    } else {
      console.log('Rows returned:', rows.length);
      res.json(rows.reverse());
    }
  });
});

app.get('/api/metrics/rollup', (req, res) => {
  const { increment, key, name, startTime } = req.query;
  const start = parseInt(startTime) || 0;
  
  const sql = `
    SELECT timestamp, min, max, average, unit
    FROM rollups
    WHERE increment = ? AND key = ? AND name = ? AND timestamp >= ?
    ORDER BY timestamp DESC
    LIMIT 120
  `;
  
  db.all(sql, [increment, key, name, start], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows.reverse());
    }
  });
});

app.get('/api/metrics/keys', (req, res) => {
  const sql = `
    SELECT DISTINCT key, name
    FROM metrics
    ORDER BY key, name
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed');
    process.exit(0);
  });
});
# graph-monitor

This tool is a system monitoring application that captures metrics and generates static PNG charts. There are two main components.

## Data Capture

This Node.js process will execute commands defined in a config.json file. It will continue to run until stopped.

```json
{
  "metrics": {
    "bde": {
      "command": "curl https://www.bigdeskenergy.com"
    }
  },
  "graphs": {
    "Response Time: www.bigdeskenergy.com (Last hour)": {
      "metric": "bde",
      "source": "latest",
      "limit": "1h",
      "type": "LineChart",
      "x-axis": "timestamp",
      "y-axis": "duration"
    }
    "Response Time: www.bigdeskenergy.com (Last 24 hours)": {
      "metric": "bde",
      "source": "rollup-5m",
      "limit": "24h",
      "type": "LineChart",
      "x-axis": "timestamp",
      "y-axis": "duration",
      "aggregation": ["min", "max", "average"]
    }

  }

}
```
For each `metric`, we're going to execute the shell command every minute.

The command will output to stdout one or more lines
```
name: value [unit]
```
<example>
duration: 123 ms
status: 200
</example>

Each time a command is executed, we're going to store the following data in a sqlite database
```
timestamp (unix time), key, name, value, unit
```
<example>
1753219424, bde, duration, 123, ms
1753219424, bde, status, 200
</example>

The timestamp is rounded to the nearest minute.

We also want to create a table that keeps a rolling summary of each metric

We'll rollup the values in the following increments, starting with the first increment greater than our frequency.

5 minutes (5m)
30 minutes (30m)
1 hour (1h)
12 hours (12h)
1 day (1d)
1 month (1mo)

For each group, we'll keep a maximum on the latest 120 entries.

We'll capture the following data
```
increment, timestamp, key, name, unit, min, max, average
```
- increment is the interval key in parentheses.
- timestamp is the unix time rounded to nearest increment
    - 5m 00:00, 00:05, 00:10, etc.
    - 30m 00:00, 00:30, 01:00, etc.
    - 1h 00:00, 01:00, 02:00, etc.
    - 1d 2025-07-21T00:00, 2025-07-22T00:00, etc.
    - 1m 2025-07-01T00:00, 2025-08-01T00:00, etc.
- key, name, unit from metric
- min*
- max*
- average*

* aggregate of all metrics for this key/name pair for this interval

<example>
5m, 1753219500, bde, duration, 123, ms, 99, 201, 112
<example>

As metrics entries are collected, we'll update the rollup entries. We use a hierarchical storage method to minimize the
amount of data that is captured. For latest metrics, only the last 60 (1/min) are stored. The 5m rollup uses the latest
metrics. The next interval uses the previous interval, and so on. Once a rollup reaches 120 entries (not by count, but
by timestamp based on interval), any entries less than this min timestamp is deleted.

## Chart Generation & Web Server

The data capture process automatically generates static PNG charts based on the configuration using Chart.js. These charts are saved to the `/charts` directory and served by a simple HTTP server.

A web server runs on port 8080 to serve these static charts through a simple HTML interface.

### Running the Application

```bash
# Install dependencies
npm install
cd data-capture && npm install

# Run both data capture and web server
npm start

# Or run components separately
npm run capture  # Run data capture only
npm run serve    # Run web server only
```

### Graph Configuration

Graphs are configured in the config.json file. For each graph, the key is the title of the chart.

We specify the following:
- metric: the metric key we're graphing
- source
    - latest: get from captured metrics
    - rollup-interval: rollup-5m gets the rollup values from the appropriate interval
- limit: limit entries up to (1h = 1 hour, etc) `timestamp >= Date.now - limit`
- type: chart type (currently supports LineChart)
- x-axis: value name used for x-axis data (timestamp): converted to formatted date/time
- y-axis: value name used for y-axis data (duration)
- aggegation: for rollup charts, one or more of the following: min, max, average

Charts are regenerated


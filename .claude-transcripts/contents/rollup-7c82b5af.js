class RollupManager {
  constructor(database, logger) {
    this.database = database;
    this.logger = logger;
    this.intervals = new Map();
    
    this.rollupIntervals = [
      { key: '5m', ms: 5 * 60 * 1000, seconds: 5 * 60 },
      { key: '30m', ms: 30 * 60 * 1000, seconds: 30 * 60 },
      { key: '1h', ms: 60 * 60 * 1000, seconds: 60 * 60 },
      { key: '12h', ms: 12 * 60 * 60 * 1000, seconds: 12 * 60 * 60 },
      { key: '1d', ms: 24 * 60 * 60 * 1000, seconds: 24 * 60 * 60 },
      { key: '1mo', ms: 30 * 24 * 60 * 60 * 1000, seconds: 30 * 24 * 60 * 60 },
      { key: '1y', ms: 365 * 24 * 60 * 60 * 1000, seconds: 365 * 24 * 60 * 60 }
    ];
  }

  start() {
    for (const interval of this.rollupIntervals) {
      this.scheduleRollup(interval);
    }
    
    this.performInitialRollups();
    
    this.logger.info('Started rollup manager with all intervals');
  }

  scheduleRollup(interval) {
    const task = setInterval(() => {
      this.performRollup(interval);
    }, interval.ms);
    
    this.intervals.set(interval.key, task);
    this.logger.debug(`Scheduled rollup for ${interval.key} interval`);
  }

  async performInitialRollups() {
    for (const interval of this.rollupIntervals) {
      await this.performRollup(interval);
    }
  }

  async performRollup(interval) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const alignedTimestamp = this.alignTimestamp(now, interval.seconds);
      const startTime = alignedTimestamp - interval.seconds;
      
      const metricsQuery = `
        SELECT DISTINCT key, name 
        FROM metrics 
        WHERE timestamp >= ? AND timestamp < ?
      `;
      
      const metrics = await this.database.all(metricsQuery, [startTime, alignedTimestamp]);
      
      for (const { key, name } of metrics) {
        await this.calculateAndStoreRollup(interval, key, name, startTime, alignedTimestamp);
      }
      
      this.logger.debug(`Completed rollup for ${interval.key} interval at ${new Date(alignedTimestamp * 1000).toISOString()}`);
    } catch (error) {
      this.logger.error(`Error performing rollup for ${interval.key}: ${error.message}`);
    }
  }

  async calculateAndStoreRollup(interval, key, name, startTime, endTime) {
    try {
      const metrics = await this.database.getMetricsForRollup(key, name, startTime, endTime);
      
      if (metrics.length === 0) return;
      
      const values = metrics.map(m => m.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      
      const firstMetric = await this.database.all(
        'SELECT unit FROM metrics WHERE key = ? AND name = ? LIMIT 1',
        [key, name]
      );
      const unit = firstMetric[0]?.unit || null;
      
      await this.database.insertRollup(
        interval.key,
        endTime,
        key,
        name,
        unit,
        min,
        max,
        average
      );
      
      await this.database.cleanupOldRollups(interval.key, key, name);
      
    } catch (error) {
      this.logger.error(`Error calculating rollup for ${key}/${name}: ${error.message}`);
    }
  }

  alignTimestamp(timestamp, intervalSeconds) {
    return Math.floor(timestamp / intervalSeconds) * intervalSeconds;
  }

  stop() {
    for (const [key, interval] of this.intervals) {
      clearInterval(interval);
      this.logger.debug(`Stopped rollup for ${key}`);
    }
    
    this.intervals.clear();
    this.logger.info('Stopped all rollup tasks');
  }
}

module.exports = RollupManager;
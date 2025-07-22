class RollupManager {
  constructor(database, logger) {
    this.database = database;
    this.logger = logger;
    
    this.rollupIntervals = [
      { key: '5m', ms: 5 * 60 * 1000, seconds: 5 * 60 },
      { key: '30m', ms: 30 * 60 * 1000, seconds: 30 * 60 },
      { key: '1h', ms: 60 * 60 * 1000, seconds: 60 * 60 },
      { key: '12h', ms: 12 * 60 * 60 * 1000, seconds: 12 * 60 * 60 },
      { key: '1d', ms: 24 * 60 * 60 * 1000, seconds: 24 * 60 * 60 },
      { key: '1mo', ms: 30 * 24 * 60 * 60 * 1000, seconds: 30 * 24 * 60 * 60 }
    ];
  }

  start() {
    this.logger.info('Rollup manager started - will calculate rollups on metric capture');
  }

  async calculateRollupsForMetrics(metrics) {
    const uniqueKeys = new Set();
    metrics.forEach(m => uniqueKeys.add(`${m.key}:${m.name}`));
    
    for (const keyName of uniqueKeys) {
      const [key, name] = keyName.split(':');
      await this.calculateRollupsForMetric(key, name);
    }
  }

  async calculateRollupsForMetric(key, name) {
    const now = Math.floor(Date.now() / 1000);
    
    for (const interval of this.rollupIntervals) {
      try {
        await this.updateRollup(interval, key, name, now);
      } catch (error) {
        this.logger.error(`Error calculating ${interval.key} rollup for ${key}/${name}: ${error.message}`);
      }
    }
  }

  async updateRollup(interval, key, name, currentTime) {
    const alignedTimestamp = this.alignTimestamp(currentTime, interval.seconds);
    const startTime = alignedTimestamp;
    const endTime = alignedTimestamp + interval.seconds;
    
    // Get metrics for this interval
    const metrics = await this.database.getMetricsForRollup(key, name, startTime, endTime);
    
    if (metrics.length === 0) return;
    
    const values = metrics.map(m => m.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Get unit from first metric
    const firstMetric = await this.database.all(
      'SELECT unit FROM metrics WHERE key = ? AND name = ? LIMIT 1',
      [key, name]
    );
    const unit = firstMetric[0]?.unit || null;
    
    // Insert or update the rollup
    await this.database.insertRollup(
      interval.key,
      alignedTimestamp,
      key,
      name,
      unit,
      min,
      max,
      average
    );
    
    // Cleanup old rollups
    await this.database.cleanupOldRollups(interval.key, key, name);
  }

  alignTimestamp(timestamp, intervalSeconds) {
    return Math.floor(timestamp / intervalSeconds) * intervalSeconds;
  }

  stop() {
    this.logger.info('Rollup manager stopped');
  }
}

module.exports = RollupManager;
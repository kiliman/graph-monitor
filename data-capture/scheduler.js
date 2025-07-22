const CommandExecutor = require('./executor');
const Database = require('./database');

class MetricScheduler {
  constructor(config, database, logger, rollupManager) {
    this.config = config;
    this.database = database;
    this.logger = logger;
    this.rollupManager = rollupManager;
    this.executor = new CommandExecutor(logger);
    this.tasks = new Map();
    this.intervals = new Map();
  }

  start() {
    const metrics = this.config.getMetrics();
    
    for (const [key, metric] of Object.entries(metrics)) {
      this.scheduleMetric(key, metric);
    }
    
    this.logger.info(`Started ${this.tasks.size} metric collection tasks`);
  }

  scheduleMetric(key, metric) {
    const frequencyMs = this.config.parseFrequency(metric.frequency);
    
    if (!frequencyMs) {
      this.logger.error(`Invalid frequency for metric ${key}: ${metric.frequency}`);
      return;
    }

    this.executeMetric(key, metric);
    
    const interval = setInterval(() => {
      this.executeMetric(key, metric);
    }, frequencyMs);
    
    this.intervals.set(key, interval);
    this.logger.info(`Scheduled metric "${key}" to run every ${metric.frequency}`);
  }

  async executeMetric(key, metric) {
    try {
      this.logger.debug(`Executing metric "${key}": ${metric.command}`);
      
      const result = await this.executor.execute(metric.command);
      const timestamp = Math.floor(Date.now() / 1000);
      
      if (result.success) {
        const storedMetrics = [];
        for (const m of result.metrics) {
          await this.database.insertMetric(
            timestamp,
            key,
            m.name,
            m.value,
            m.unit
          );
          storedMetrics.push({ key, name: m.name });
        }
        
        this.logger.debug(`Stored ${result.metrics.length} metrics for "${key}"`);
        
        // Calculate rollups for the metrics we just stored
        if (this.rollupManager) {
          await this.rollupManager.calculateRollupsForMetrics(storedMetrics);
        }
      } else {
        this.logger.error(`Failed to execute metric "${key}": ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Error processing metric "${key}": ${error.message}`);
    }
  }

  reload(newConfig) {
    this.logger.info('Reloading metric scheduler with new configuration...');
    
    // Stop all existing tasks
    for (const [key, interval] of this.intervals) {
      clearInterval(interval);
      this.logger.debug(`Stopped metric collection for "${key}"`);
    }
    
    this.intervals.clear();
    this.tasks.clear();
    
    // Update config and restart with new metrics
    this.config = newConfig;
    this.start();
  }

  stop() {
    for (const [key, interval] of this.intervals) {
      clearInterval(interval);
      this.logger.debug(`Stopped metric collection for "${key}"`);
    }
    
    this.intervals.clear();
    this.tasks.clear();
    this.logger.info('Stopped all metric collection tasks');
  }
}

module.exports = MetricScheduler;
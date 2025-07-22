const fs = require('fs');
const path = require('path');

class ConfigLoader {
  constructor(configPath) {
    this.configPath = configPath || path.join(__dirname, '..', 'config.json');
    this.config = null;
  }

  load() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      this.validate();
      return this.config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Configuration file not found at ${this.configPath}`);
      } else if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  reload() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      const newConfig = JSON.parse(configData);
      
      // Store old config in case validation fails
      const oldConfig = this.config;
      this.config = newConfig;
      
      try {
        this.validate();
        return { success: true, config: this.config };
      } catch (validationError) {
        // Restore old config if validation fails
        this.config = oldConfig;
        return { success: false, error: validationError.message };
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return { success: false, error: `Invalid JSON: ${error.message}` };
      }
      return { success: false, error: error.message };
    }
  }

  validate() {
    if (!this.config.metrics || typeof this.config.metrics !== 'object') {
      throw new Error('Configuration must contain a "metrics" object');
    }

    for (const [key, metric] of Object.entries(this.config.metrics)) {
      if (!metric.command || typeof metric.command !== 'string') {
        throw new Error(`Metric "${key}" must have a "command" string`);
      }
      if (!metric.frequency || typeof metric.frequency !== 'string') {
        throw new Error(`Metric "${key}" must have a "frequency" string`);
      }
      if (!this.isValidFrequency(metric.frequency)) {
        throw new Error(`Invalid frequency format for metric "${key}": ${metric.frequency}`);
      }
    }
  }

  isValidFrequency(frequency) {
    const pattern = /^\d+[smh]$/;
    return pattern.test(frequency);
  }

  parseFrequency(frequency) {
    const match = frequency.match(/^(\d+)([smh])$/);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000
    };

    return value * multipliers[unit];
  }

  getMetrics() {
    if (!this.config) {
      this.load();
    }
    return this.config.metrics;
  }

  getGraphs() {
    if (!this.config) {
      this.load();
    }
    return this.config.graphs || {};
  }
}

module.exports = ConfigLoader;
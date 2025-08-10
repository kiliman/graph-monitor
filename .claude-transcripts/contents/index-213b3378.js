const ConfigLoader = require('./config');
const Database = require('./database');
const MetricScheduler = require('./scheduler');
const RollupManager = require('./rollup');
const createLogger = require('./logger');
const fs = require('fs');
const path = require('path');

class DataCaptureService {
  constructor() {
    this.logger = createLogger();
    this.config = new ConfigLoader();
    this.database = new Database();
    this.scheduler = null;
    this.rollupManager = null;
  }

  async start() {
    try {
      this.logger.info('Starting Data Capture Service...');
      
      this.ensureLogsDirectory();
      
      this.logger.info('Loading configuration...');
      this.config.load();
      
      this.logger.info('Initializing database...');
      await this.database.initialize();
      
      this.scheduler = new MetricScheduler(this.config, this.database, this.logger);
      this.scheduler.start();
      
      this.rollupManager = new RollupManager(this.database, this.logger);
      this.rollupManager.start();
      
      this.setupShutdownHandlers();
      
      this.logger.info('Data Capture Service started successfully');
    } catch (error) {
      this.logger.error(`Failed to start service: ${error.message}`);
      process.exit(1);
    }
  }

  ensureLogsDirectory() {
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }
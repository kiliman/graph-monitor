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

  setupShutdownHandlers() {
    const shutdown = async (signal) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      
      if (this.scheduler) {
        this.scheduler.stop();
      }
      
      if (this.rollupManager) {
        this.rollupManager.stop();
      }
      
      if (this.database) {
        await this.database.close();
      }
      
      this.logger.info('Service shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      this.logger.error(`Uncaught exception: ${error.message}`, { stack: error.stack });
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }
}

const service = new DataCaptureService();
service.start();
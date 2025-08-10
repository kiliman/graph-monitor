
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
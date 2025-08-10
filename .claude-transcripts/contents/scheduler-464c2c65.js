const cron = require('node-cron');
const CommandExecutor = require('./executor');
const Database = require('./database');

class MetricScheduler {
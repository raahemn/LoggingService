import * as fs from "fs";
import * as path from "path";

const APP_NAME = process.env.APP_NAME || "default-app";

const levels = ['INFO', 'WARNING', 'ERROR', 'DEBUG'];
const messages: { [key: string]: string[] } = {
  app1: ["User authentication successful", "Database connection established", "Processing payment transaction"],
  app2: ["File upload completed", "Email notification sent", "Background job started"],
  app3: ["Order processing initiated", "Inventory updated", "Shipping label generated"]
};

const logPath = path.join(__dirname, "logs", `${APP_NAME}.log`);

// Only support apps 1, 2, and 3
if (!['app1', 'app2', 'app3'].includes(APP_NAME)) {
  console.error(`Unsupported app: ${APP_NAME}. Only app1, app2, and app3 are supported.`);
  process.exit(1);
}

// Setup log file
fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.writeFileSync(logPath, '');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function generateLog() {
  const level = levels[Math.floor(Math.random() * levels.length)];
  const traceId = generateId();
  const appMessages = messages[APP_NAME];
  const message = appMessages[Math.floor(Math.random() * appMessages.length)];
  const timestamp = new Date().toISOString();
  
  return `[${timestamp}] [${level}] [${traceId}] ${message}\n`;
}

function writeLog() {
  const logEntry = generateLog();
  
  fs.appendFileSync(logPath, logEntry);
  
}

const intervals: { [key: string]: number } = {
  app1: 61000,
  app2: 20000,
  app3: 15000
};

async function main() {
  console.log(`Starting log simulator for ${APP_NAME}`);
  const interval = intervals[APP_NAME];
  
  setInterval(writeLog, interval);
}

main().catch(console.error);
import fs from 'fs';
import path from 'path';

const logDir = path.resolve(process.cwd(), 'logs');
const logFile = path.join(logDir, 'api-debug.log');

export function ensureLogDir() {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

export function logApiError(context: string, err: any) {
  ensureLogDir();
  
  const entry = {
    ts: new Date().toISOString(),
    context,
    message: err?.message || String(err),
    stack: err?.stack,
    name: err?.name,
  };
  
  try {
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch (writeErr) {
    console.error('[API-LOGGER] Failed to write to log file:', writeErr);
  }
  
  console.error(`[API ERROR] ${context}:`, entry.message);
  if (entry.stack) {
    console.error('[API STACK]:', entry.stack.split('\n').slice(0, 5).join('\n'));
  }
}

export function logApiInfo(context: string, message: string) {
  ensureLogDir();
  
  const entry = {
    ts: new Date().toISOString(),
    level: 'info',
    context,
    message,
  };
  
  try {
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch (writeErr) {
    console.error('[API-LOGGER] Failed to write to log file:', writeErr);
  }
  
  console.log(`[API INFO] ${context}: ${message}`);
}

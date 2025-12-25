/**
 * Diagnostic Logger - Sends client logs to server for real-time debugging
 * Logs are stored in memory on the server and can be retrieved via GET /api/diag
 */

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

interface DiagOptions {
  tag: string;
  wallet?: string;
}

const sendQueue: Array<{level: LogLevel; tag: string; message: string; data?: any; wallet?: string}> = [];
let isSending = false;

async function flushQueue() {
  if (isSending || sendQueue.length === 0) return;
  
  isSending = true;
  while (sendQueue.length > 0) {
    const entry = sendQueue.shift();
    if (!entry) continue;
    
    try {
      await fetch('/api/diag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (e) {
      // Silently fail - don't want diagnostic logging to break the app
    }
  }
  isSending = false;
}

function queueLog(level: LogLevel, tag: string, message: string, data?: any, wallet?: string) {
  // Also log to browser console
  const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  consoleMethod(`[${tag}]`, message, data || '');
  
  // Queue for server
  sendQueue.push({ level, tag, message, data, wallet });
  
  // Debounce flush
  setTimeout(flushQueue, 50);
}

/**
 * Create a diagnostic logger with a specific tag
 */
export function createDiag(options: DiagOptions) {
  const { tag, wallet } = options;
  
  return {
    log: (message: string, data?: any) => queueLog('log', tag, message, data, wallet),
    info: (message: string, data?: any) => queueLog('info', tag, message, data, wallet),
    warn: (message: string, data?: any) => queueLog('warn', tag, message, data, wallet),
    error: (message: string, data?: any) => queueLog('error', tag, message, data, wallet),
    debug: (message: string, data?: any) => queueLog('debug', tag, message, data, wallet),
  };
}

/**
 * Quick diagnostic log (one-off)
 */
export function diag(tag: string, message: string, data?: any) {
  queueLog('log', tag, message, data);
}

/**
 * Global diag instance for quick logging
 */
export const diagLog = {
  log: (tag: string, message: string, data?: any) => queueLog('log', tag, message, data),
  info: (tag: string, message: string, data?: any) => queueLog('info', tag, message, data),
  warn: (tag: string, message: string, data?: any) => queueLog('warn', tag, message, data),
  error: (tag: string, message: string, data?: any) => queueLog('error', tag, message, data),
  debug: (tag: string, message: string, data?: any) => queueLog('debug', tag, message, data),
};

import { Request, Response } from 'express';
import os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';
import { StructuredLogger } from './logger';

const execAsync = promisify(exec);

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: CheckStatus;
    memory: CheckStatus;
    cpu: CheckStatus;
    disk: CheckStatus;
    websocket?: CheckStatus;
    redis?: CheckStatus;
  };
  timestamp: string;
  uptime: number;
  version?: string;
}

export interface CheckStatus {
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  value?: any;
  timestamp: string;
}

export class HealthMonitor {
  private logger: StructuredLogger;
  private dbChecker?: () => Promise<boolean>;
  private wsChecker?: () => boolean;
  private redisChecker?: () => Promise<boolean>;
  private startTime: number;

  constructor(logger: StructuredLogger) {
    this.logger = logger;
    this.startTime = Date.now();
  }

  setDatabaseChecker(checker: () => Promise<boolean>): void {
    this.dbChecker = checker;
  }

  setWebSocketChecker(checker: () => boolean): void {
    this.wsChecker = checker;
  }

  setRedisChecker(checker: () => Promise<boolean>): void {
    this.redisChecker = checker;
  }

  private async checkDatabase(): Promise<CheckStatus> {
    const timestamp = new Date().toISOString();
    
    if (!this.dbChecker) {
      return {
        status: 'warn',
        message: 'Database checker not configured',
        timestamp,
      };
    }

    try {
      const start = Date.now();
      const isConnected = await this.dbChecker();
      const latency = Date.now() - start;

      if (!isConnected) {
        return {
          status: 'fail',
          message: 'Database connection failed',
          timestamp,
        };
      }

      if (latency > 1000) {
        return {
          status: 'warn',
          message: `High database latency: ${latency}ms`,
          value: { latency },
          timestamp,
        };
      }

      return {
        status: 'pass',
        message: 'Database connected',
        value: { latency },
        timestamp,
      };
    } catch (error) {
      this.logger.error('Database health check failed', error as Error);
      return {
        status: 'fail',
        message: (error as Error).message,
        timestamp,
      };
    }
  }

  private async checkRedis(): Promise<CheckStatus> {
    const timestamp = new Date().toISOString();
    
    if (!this.redisChecker) {
      return {
        status: 'pass',
        message: 'Redis not configured (optional)',
        timestamp,
      };
    }

    try {
      const isConnected = await this.redisChecker();
      return {
        status: isConnected ? 'pass' : 'warn',
        message: isConnected ? 'Redis connected' : 'Redis not available',
        timestamp,
      };
    } catch (error) {
      return {
        status: 'warn',
        message: 'Redis check failed (optional service)',
        timestamp,
      };
    }
  }

  private checkWebSocket(): CheckStatus {
    const timestamp = new Date().toISOString();
    
    if (!this.wsChecker) {
      return {
        status: 'pass',
        message: 'WebSocket not configured',
        timestamp,
      };
    }

    const isRunning = this.wsChecker();
    return {
      status: isRunning ? 'pass' : 'warn',
      message: isRunning ? 'WebSocket server running' : 'WebSocket server not running',
      timestamp,
    };
  }

  private checkMemory(): CheckStatus {
    const timestamp = new Date().toISOString();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = (usedMem / totalMem) * 100;

    const value = {
      total: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
      used: `${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
      free: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
      usagePercent: `${usagePercent.toFixed(2)}%`,
    };

    if (usagePercent > 90) {
      return {
        status: 'fail',
        message: 'Critical memory usage',
        value,
        timestamp,
      };
    }

    if (usagePercent > 80) {
      return {
        status: 'warn',
        message: 'High memory usage',
        value,
        timestamp,
      };
    }

    return {
      status: 'pass',
      message: 'Memory usage normal',
      value,
      timestamp,
    };
  }

  private checkCPU(): CheckStatus {
    const timestamp = new Date().toISOString();
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const cpuCount = cpus.length;

    const load1 = loadAvg[0];
    const loadPercent = (load1 / cpuCount) * 100;

    const value = {
      cores: cpuCount,
      load1min: load1.toFixed(2),
      load5min: loadAvg[1].toFixed(2),
      load15min: loadAvg[2].toFixed(2),
      loadPercent: `${loadPercent.toFixed(2)}%`,
    };

    if (loadPercent > 90) {
      return {
        status: 'fail',
        message: 'Critical CPU load',
        value,
        timestamp,
      };
    }

    if (loadPercent > 70) {
      return {
        status: 'warn',
        message: 'High CPU load',
        value,
        timestamp,
      };
    }

    return {
      status: 'pass',
      message: 'CPU load normal',
      value,
      timestamp,
    };
  }

  private async checkDisk(): Promise<CheckStatus> {
    const timestamp = new Date().toISOString();
    
    try {
      const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $5}'");
      const usagePercent = parseInt(stdout.trim().replace('%', ''));

      const value = { usagePercent: `${usagePercent}%` };

      if (usagePercent > 90) {
        return {
          status: 'fail',
          message: 'Critical disk usage',
          value,
          timestamp,
        };
      }

      if (usagePercent > 80) {
        return {
          status: 'warn',
          message: 'High disk usage',
          value,
          timestamp,
        };
      }

      return {
        status: 'pass',
        message: 'Disk usage normal',
        value,
        timestamp,
      };
    } catch (error) {
      return {
        status: 'warn',
        message: 'Could not check disk usage',
        timestamp,
      };
    }
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const [database, memory, cpu, disk, websocket, redis] = await Promise.all([
      this.checkDatabase(),
      Promise.resolve(this.checkMemory()),
      Promise.resolve(this.checkCPU()),
      this.checkDisk(),
      Promise.resolve(this.checkWebSocket()),
      this.checkRedis(),
    ]);

    const checks = { database, memory, cpu, disk, websocket, redis };

    const hasFailure = Object.values(checks).some(check => check && check.status === 'fail');
    const hasWarning = Object.values(checks).some(check => check && check.status === 'warn');

    const status = hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version,
    };
  }

  healthEndpoint() {
    return async (req: Request, res: Response) => {
      try {
        const health = await this.performHealthCheck();
        const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        this.logger.error('Health check failed', error as Error);
        res.status(503).json({
          status: 'unhealthy',
          error: 'Health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    };
  }
}

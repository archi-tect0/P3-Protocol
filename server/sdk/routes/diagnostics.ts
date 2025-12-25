import { Router, Request, Response } from 'express';

const router = Router();

const startTime = Date.now();
const isProduction = process.env.NODE_ENV === 'production';

interface AuthRequest extends Request {
  wallet?: string;
}

router.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'p3-sdk',
    timestamp: Date.now(),
  });
});

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    res.json({
      ok: true,
      version: '2.0.0',
      uptime,
      uptimeFormatted: formatUptime(uptime),
      timestamp: Date.now(),
      modules: {
        crypto: true,
        session: true,
        anchor: true,
        identity: true,
        zk: true,
        media: true,
        explorer: true,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

router.get('/metrics', async (req: AuthRequest, res: Response) => {
  const wallet = req.wallet;
  if (!wallet) {
    return res.status(401).json({ error: 'Wallet authentication required' });
  }

  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    res.json({
      ok: true,
      system: {
        platform: isProduction ? 'redacted' : 'linux',
        arch: isProduction ? 'redacted' : 'x64',
        nodeVersion: isProduction ? 'redacted' : process.version,
        uptime: Math.floor((Date.now() - startTime) / 1000),
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

router.get('/ping', (req: Request, res: Response) => {
  const start = process.hrtime.bigint();
  
  setTimeout(() => {
    const end = process.hrtime.bigint();
    const latency = Number(end - start) / 1e6;
    
    res.json({
      ok: true,
      latency: Math.round(latency * 100) / 100,
      timestamp: Date.now(),
    });
  }, 0);
});

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

export default router;

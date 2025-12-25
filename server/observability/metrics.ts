import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { Request, Response } from 'express';

export class MetricsService {
  private registry: Registry;
  
  public apiRequestsTotal: Counter<string>;
  public apiRequestDuration: Histogram<string>;
  public activeWebsocketConnections: Gauge<string>;
  public dbConnectionPoolSize: Gauge<string>;
  
  public zkProvingTime: Histogram<string>;
  public bridgeRelayLatency: Histogram<string>;
  public anchorSuccessRate: Gauge<string>;
  
  private anchorAttempts = 0;
  private anchorSuccesses = 0;

  constructor() {
    this.registry = new Registry();
    
    collectDefaultMetrics({ register: this.registry });
    
    this.apiRequestsTotal = new Counter({
      name: 'api_requests_total',
      help: 'Total number of API requests',
      labelNames: ['endpoint', 'method', 'status'],
      registers: [this.registry],
    });
    
    this.apiRequestDuration = new Histogram({
      name: 'api_request_duration_seconds',
      help: 'API request duration in seconds',
      labelNames: ['endpoint', 'method', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });
    
    this.activeWebsocketConnections = new Gauge({
      name: 'active_websocket_connections',
      help: 'Number of active WebSocket connections',
      registers: [this.registry],
    });
    
    this.dbConnectionPoolSize = new Gauge({
      name: 'db_connection_pool_size',
      help: 'Database connection pool size',
      labelNames: ['state'],
      registers: [this.registry],
    });
    
    this.zkProvingTime = new Histogram({
      name: 'zk_proving_time_seconds',
      help: 'ZK proof generation time in seconds',
      labelNames: ['proof_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
      registers: [this.registry],
    });
    
    this.bridgeRelayLatency = new Histogram({
      name: 'bridge_relay_latency_seconds',
      help: 'Bridge relay latency in seconds',
      labelNames: ['source_chain', 'dest_chain'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300],
      registers: [this.registry],
    });
    
    this.anchorSuccessRate = new Gauge({
      name: 'anchor_success_rate',
      help: 'Anchor operation success rate (0-1)',
      registers: [this.registry],
    });
  }
  
  recordAnchorAttempt(success: boolean): void {
    this.anchorAttempts++;
    if (success) {
      this.anchorSuccesses++;
    }
    
    const rate = this.anchorAttempts > 0 
      ? this.anchorSuccesses / this.anchorAttempts 
      : 1;
    this.anchorSuccessRate.set(rate);
  }
  
  incrementWebsocketConnections(): void {
    this.activeWebsocketConnections.inc();
  }
  
  decrementWebsocketConnections(): void {
    this.activeWebsocketConnections.dec();
  }
  
  updateDbConnectionPool(idle: number, total: number): void {
    this.dbConnectionPoolSize.set({ state: 'idle' }, idle);
    this.dbConnectionPoolSize.set({ state: 'active' }, total - idle);
    this.dbConnectionPoolSize.set({ state: 'total' }, total);
  }
  
  recordZkProving(proofType: string, durationSeconds: number): void {
    this.zkProvingTime.observe({ proof_type: proofType }, durationSeconds);
  }
  
  recordBridgeRelay(sourceChain: string, destChain: string, durationSeconds: number): void {
    this.bridgeRelayLatency.observe(
      { source_chain: sourceChain, dest_chain: destChain },
      durationSeconds
    );
  }
  
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
  
  metricsEndpoint() {
    return async (req: Request, res: Response) => {
      try {
        res.set('Content-Type', this.registry.contentType);
        const metrics = await this.getMetrics();
        res.end(metrics);
      } catch (error) {
        res.status(500).json({ error: 'Failed to collect metrics' });
      }
    };
  }
  
  createTimingMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const endpoint = this.normalizeEndpoint(req.path);
        const method = req.method;
        const status = res.statusCode.toString();
        
        this.apiRequestsTotal.inc({ endpoint, method, status });
        this.apiRequestDuration.observe({ endpoint, method, status }, duration);
      });
      
      next();
    };
  }
  
  private normalizeEndpoint(path: string): string {
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\/0x[a-fA-F0-9]+/g, '/:address');
  }
}

export const metricsService = new MetricsService();

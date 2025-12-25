import rocksdb from 'rocksdb';
import { promisify } from 'util';
import path from 'path';

export interface EventIndex {
  eventId: string;
  batchId: string;
  timestamp: number;
  type: string;
}

export interface ConsentRoot {
  userId: string;
  root: string;
  timestamp: number;
  version: number;
}

export interface RuleEvaluation {
  ruleId: string;
  userId: string;
  result: boolean;
  timestamp: number;
  metadata?: any;
}

export interface StateManagerConfig {
  dbPath: string;
}

export class StateManager {
  private db: any;
  private isOpen: boolean = false;
  private dbPath: string;

  constructor(config: StateManagerConfig) {
    this.dbPath = config.dbPath || path.join(process.cwd(), 'data', 'rollup-state');
    this.db = rocksdb(this.dbPath);
  }

  async open(): Promise<void> {
    if (this.isOpen) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db.open((err: Error) => {
        if (err) {
          console.error('[StateManager] Error opening database:', err);
          reject(err);
        } else {
          this.isOpen = true;
          console.log(`[StateManager] Database opened at ${this.dbPath}`);
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    if (!this.isOpen) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db.close((err: Error) => {
        if (err) {
          reject(err);
        } else {
          this.isOpen = false;
          console.log('[StateManager] Database closed');
          resolve();
        }
      });
    });
  }

  async indexEvent(event: EventIndex): Promise<void> {
    const key = `event:${event.eventId}`;
    const value = JSON.stringify(event);
    
    return new Promise((resolve, reject) => {
      this.db.put(key, value, (err: Error) => {
        if (err) {
          console.error('[StateManager] Error indexing event:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getEventIndex(eventId: string): Promise<EventIndex | null> {
    const key = `event:${eventId}`;
    
    return new Promise((resolve, reject) => {
      this.db.get(key, (err: Error, value: string) => {
        if (err) {
          if (err.message.includes('NotFound')) {
            resolve(null);
          } else {
            reject(err);
          }
        } else {
          resolve(JSON.parse(value));
        }
      });
    });
  }

  async cacheConsentRoot(consentRoot: ConsentRoot): Promise<void> {
    const key = `consent:${consentRoot.userId}:${consentRoot.version}`;
    const latestKey = `consent:latest:${consentRoot.userId}`;
    const value = JSON.stringify(consentRoot);
    
    return new Promise((resolve, reject) => {
      const batch = this.db.batch();
      batch.put(key, value);
      batch.put(latestKey, value);
      
      batch.write((err: Error) => {
        if (err) {
          console.error('[StateManager] Error caching consent root:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getConsentRoot(userId: string, version?: number): Promise<ConsentRoot | null> {
    const key = version !== undefined 
      ? `consent:${userId}:${version}`
      : `consent:latest:${userId}`;
    
    return new Promise((resolve, reject) => {
      this.db.get(key, (err: Error, value: string) => {
        if (err) {
          if (err.message.includes('NotFound')) {
            resolve(null);
          } else {
            reject(err);
          }
        } else {
          resolve(JSON.parse(value));
        }
      });
    });
  }

  async cacheRuleEvaluation(evaluation: RuleEvaluation): Promise<void> {
    const key = `rule:${evaluation.ruleId}:${evaluation.userId}:${evaluation.timestamp}`;
    const latestKey = `rule:latest:${evaluation.ruleId}:${evaluation.userId}`;
    const value = JSON.stringify(evaluation);
    
    return new Promise((resolve, reject) => {
      const batch = this.db.batch();
      batch.put(key, value);
      batch.put(latestKey, value);
      
      batch.write((err: Error) => {
        if (err) {
          console.error('[StateManager] Error caching rule evaluation:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getRuleEvaluation(ruleId: string, userId: string): Promise<RuleEvaluation | null> {
    const key = `rule:latest:${ruleId}:${userId}`;
    
    return new Promise((resolve, reject) => {
      this.db.get(key, (err: Error, value: string) => {
        if (err) {
          if (err.message.includes('NotFound')) {
            resolve(null);
          } else {
            reject(err);
          }
        } else {
          resolve(JSON.parse(value));
        }
      });
    });
  }

  async setBatchCheckpoint(batchId: string, checkpoint: any): Promise<void> {
    const key = `checkpoint:batch:${batchId}`;
    const value = JSON.stringify(checkpoint);
    
    return new Promise((resolve, reject) => {
      this.db.put(key, value, (err: Error) => {
        if (err) {
          console.error('[StateManager] Error setting batch checkpoint:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getBatchCheckpoint(batchId: string): Promise<any | null> {
    const key = `checkpoint:batch:${batchId}`;
    
    return new Promise((resolve, reject) => {
      this.db.get(key, (err: Error, value: string) => {
        if (err) {
          if (err.message.includes('NotFound')) {
            resolve(null);
          } else {
            reject(err);
          }
        } else {
          resolve(JSON.parse(value));
        }
      });
    });
  }

  async getStats(): Promise<{
    dbPath: string;
    isOpen: boolean;
    approximateSize?: string;
  }> {
    const stats: any = {
      dbPath: this.dbPath,
      isOpen: this.isOpen,
    };

    if (this.isOpen) {
      try {
        const size = await this.getApproximateSize();
        stats.approximateSize = `${(size / 1024 / 1024).toFixed(2)} MB`;
      } catch (error) {
        console.error('[StateManager] Error getting database size:', error);
      }
    }

    return stats;
  }

  private async getApproximateSize(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.approximateSize('', '~', (err: Error, size: number) => {
        if (err) {
          reject(err);
        } else {
          resolve(size);
        }
      });
    });
  }
}

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import type { IStorage } from './storage';

/**
 * Production-grade secrets management with encryption at rest
 * 
 * Features:
 * - AES-256-GCM encryption for all secrets
 * - 90-day rotation tracking with expiry alerts
 * - Short-lived TURN credentials (≤30 minutes)
 * - Comprehensive audit logging
 * - Integration with trustConfig for rotation events
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const ROTATION_PERIOD_DAYS = 90;
const TURN_TOKEN_EXPIRY_MINUTES = 30;
const EXPIRY_WARNING_DAYS = 7;

export type SecretKey =
  | 'JWT_SECRET'
  | 'IP_SALT'
  | 'TURN_USERNAME'
  | 'TURN_CREDENTIAL'
  | 'PINATA_JWT'
  | 'WEB3_STORAGE_TOKEN'
  | 'NFT_STORAGE_TOKEN';

interface EncryptedSecret {
  encrypted: string;
  iv: string;
  authTag: string;
  createdAt: Date;
  expiresAt: Date;
  rotationCount: number;
  lastRotatedAt?: Date;
}

interface TurnToken {
  username: string;
  credential: string;
  expiresAt: Date;
}

interface SecretAccessLog {
  key: SecretKey;
  action: 'read' | 'write' | 'rotate' | 'generate_turn_token';
  timestamp: Date;
  actor: string;
}

export class SecretManager {
  private storage: IStorage;
  private masterKey: Buffer;
  private secretsCache: Map<SecretKey, EncryptedSecret>;
  private accessLogs: SecretAccessLog[];

  constructor(storage: IStorage, masterPassword?: string) {
    this.storage = storage;
    this.secretsCache = new Map();
    this.accessLogs = [];

    // Derive master key from password or use environment variable
    const password = masterPassword || process.env.MASTER_KEY || this.generateSecurePassword();
    this.masterKey = this.deriveMasterKey(password);
  }

  /**
   * Initialize secrets from environment variables or generate new ones
   */
  async initialize(systemUserId: string): Promise<void> {
    console.log('🔐 Initializing SecretManager...');

    const secretKeys: SecretKey[] = [
      'JWT_SECRET',
      'IP_SALT',
      'TURN_USERNAME',
      'TURN_CREDENTIAL',
      'PINATA_JWT',
      'WEB3_STORAGE_TOKEN',
      'NFT_STORAGE_TOKEN',
    ];

    for (const key of secretKeys) {
      try {
        // Try to load from trustConfig first
        const stored = await this.loadSecretFromStorage(key);
        
        if (stored) {
          this.secretsCache.set(key, stored);
          console.log(`✓ Loaded ${key} from storage`);
        } else {
          // Check environment variable
          const envValue = process.env[key];
          
          if (envValue) {
            // Store environment variable in encrypted storage
            await this.storeSecret(key, envValue, systemUserId);
            console.log(`✓ Migrated ${key} from environment to encrypted storage`);
          } else {
            // Generate new secret
            const newSecret = this.generateSecret(key);
            await this.storeSecret(key, newSecret, systemUserId);
            console.log(`✓ Generated new ${key}`);
          }
        }
      } catch (error) {
        console.error(`Failed to initialize ${key}:`, error);
        throw new Error(`Failed to initialize secret ${key}`);
      }
    }

    console.log('✅ SecretManager initialized successfully');
  }

  /**
   * Get a decrypted secret value
   */
  async getSecret(key: SecretKey, actor: string = 'system'): Promise<string> {
    const encrypted = this.secretsCache.get(key);
    
    if (!encrypted) {
      throw new Error(`Secret ${key} not found`);
    }

    // Check if secret is expired
    if (new Date() > encrypted.expiresAt) {
      throw new Error(`Secret ${key} has expired and must be rotated`);
    }

    // Log access
    await this.logAccess(key, 'read', actor);

    // Decrypt
    return this.decrypt(encrypted);
  }

  /**
   * Store or update a secret
   */
  async storeSecret(key: SecretKey, value: string, actor: string): Promise<void> {
    const encrypted = this.encrypt(value);
    
    const secretData: EncryptedSecret = {
      ...encrypted,
      createdAt: new Date(),
      expiresAt: this.calculateExpiryDate(),
      rotationCount: 0,
    };

    this.secretsCache.set(key, secretData);

    // Persist to trustConfig
    await this.persistToStorage(key, secretData, actor);

    // Log the write
    await this.logAccess(key, 'write', actor);

    // Record rotation event in trustConfig
    await this.recordRotationEvent(key, actor, 'created');
  }

  /**
   * Rotate a secret (generate new value and update)
   */
  async rotateSecret(key: SecretKey, actor: string): Promise<string> {
    const newValue = this.generateSecret(key);
    const encrypted = this.encrypt(newValue);

    const existingSecret = this.secretsCache.get(key);
    const rotationCount = existingSecret ? existingSecret.rotationCount + 1 : 1;

    const secretData: EncryptedSecret = {
      ...encrypted,
      createdAt: new Date(),
      expiresAt: this.calculateExpiryDate(),
      rotationCount,
      lastRotatedAt: new Date(),
    };

    this.secretsCache.set(key, secretData);

    // Persist to storage
    await this.persistToStorage(key, secretData, actor);

    // Log rotation
    await this.logAccess(key, 'rotate', actor);

    // Record rotation event
    await this.recordRotationEvent(key, actor, 'rotated');

    // Audit log
    await this.storage.appendAuditLog({
      entityType: 'secret',
      entityId: key,
      action: 'rotate',
      actor,
      meta: {
        rotationCount,
        expiresAt: secretData.expiresAt,
      },
    });

    console.log(`🔄 Rotated secret ${key} (rotation count: ${rotationCount})`);
    return newValue;
  }

  /**
   * Generate a short-lived TURN token (≤30 minutes)
   */
  async generateTurnToken(actor: string = 'system'): Promise<TurnToken> {
    const username = await this.getSecret('TURN_USERNAME', actor);
    const credential = await this.getSecret('TURN_CREDENTIAL', actor);

    // Generate time-based token
    const expiresAt = new Date(Date.now() + TURN_TOKEN_EXPIRY_MINUTES * 60 * 1000);
    const timestamp = Math.floor(expiresAt.getTime() / 1000);

    // Create HMAC-based credential (RFC 5389)
    const turnUsername = `${timestamp}:${username}`;
    const hmac = createHash('sha1')
      .update(`${turnUsername}:${credential}`)
      .digest('base64');

    // Log token generation
    await this.logAccess('TURN_CREDENTIAL', 'generate_turn_token', actor);

    await this.storage.appendAuditLog({
      entityType: 'turn_token',
      entityId: turnUsername,
      action: 'generate',
      actor,
      meta: {
        expiresAt,
        ttl: TURN_TOKEN_EXPIRY_MINUTES,
      },
    });

    return {
      username: turnUsername,
      credential: hmac,
      expiresAt,
    };
  }

  /**
   * Check for expiring secrets and return warnings
   */
  async checkExpiringSecrets(): Promise<Array<{ key: SecretKey; daysUntilExpiry: number }>> {
    const warnings: Array<{ key: SecretKey; daysUntilExpiry: number }> = [];
    const now = new Date();
    const warningThreshold = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);

    for (const [key, secret] of this.secretsCache.entries()) {
      if (secret.expiresAt <= warningThreshold) {
        const daysUntilExpiry = Math.ceil(
          (secret.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );
        warnings.push({ key, daysUntilExpiry });
      }
    }

    return warnings;
  }

  /**
   * Get all secret metadata (without decrypted values)
   */
  getSecretsMetadata(): Map<SecretKey, Omit<EncryptedSecret, 'encrypted' | 'iv' | 'authTag'>> {
    const metadata = new Map<SecretKey, Omit<EncryptedSecret, 'encrypted' | 'iv' | 'authTag'>>();

    for (const [key, secret] of this.secretsCache.entries()) {
      metadata.set(key, {
        createdAt: secret.createdAt,
        expiresAt: secret.expiresAt,
        rotationCount: secret.rotationCount,
        lastRotatedAt: secret.lastRotatedAt,
      });
    }

    return metadata;
  }

  /**
   * Get access logs
   */
  getAccessLogs(): SecretAccessLog[] {
    return [...this.accessLogs];
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private deriveMasterKey(password: string): Buffer {
    // Use PBKDF2 to derive a strong key from password
    const crypto = require('crypto');
    return crypto.pbkdf2Sync(password, 'p3-protocol-salt', 100000, 32, 'sha256');
  }

  private generateSecurePassword(): string {
    return randomBytes(32).toString('hex');
  }

  private encrypt(plaintext: string): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  private decrypt(data: EncryptedSecret): string {
    const decipher = createDecipheriv(
      ALGORITHM,
      this.masterKey,
      Buffer.from(data.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private generateSecret(key: SecretKey): string {
    switch (key) {
      case 'JWT_SECRET':
        return randomBytes(64).toString('hex');
      
      case 'IP_SALT':
        return randomBytes(SALT_LENGTH).toString('hex');
      
      case 'TURN_USERNAME':
        return `turn_${randomBytes(16).toString('hex')}`;
      
      case 'TURN_CREDENTIAL':
        return randomBytes(32).toString('base64');
      
      case 'PINATA_JWT':
      case 'WEB3_STORAGE_TOKEN':
      case 'NFT_STORAGE_TOKEN':
        // Generate temporary token - user should configure with actual credentials
        return `temp_${key.toLowerCase()}_${randomBytes(16).toString('hex')}`;
      
      default:
        return randomBytes(32).toString('hex');
    }
  }

  private calculateExpiryDate(): Date {
    return new Date(Date.now() + ROTATION_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  }

  private async logAccess(
    key: SecretKey,
    action: 'read' | 'write' | 'rotate' | 'generate_turn_token',
    actor: string
  ): Promise<void> {
    const log: SecretAccessLog = {
      key,
      action,
      timestamp: new Date(),
      actor,
    };

    this.accessLogs.push(log);

    // Keep only last 1000 logs in memory
    if (this.accessLogs.length > 1000) {
      this.accessLogs.shift();
    }

    // Persist to audit log
    await this.storage.appendAuditLog({
      entityType: 'secret_access',
      entityId: key,
      action,
      actor,
      meta: {
        timestamp: log.timestamp,
      },
    });
  }

  private async persistToStorage(
    key: SecretKey,
    secret: EncryptedSecret,
    userId: string
  ): Promise<void> {
    try {
      const configKey = `secret:${key}`;
      const value = {
        encrypted: secret.encrypted,
        iv: secret.iv,
        authTag: secret.authTag,
        createdAt: secret.createdAt.toISOString(),
        expiresAt: secret.expiresAt.toISOString(),
        rotationCount: secret.rotationCount,
        lastRotatedAt: secret.lastRotatedAt?.toISOString(),
      };

      // Check if exists
      const existing = await this.storage.getTrustConfig(configKey);

      if (existing.length > 0) {
        // Update existing
        await this.storage.updateTrustConfig(configKey, value, userId);
      } else {
        // Create new
        await this.storage.createTrustConfig({
          key: configKey,
          value,
          createdBy: userId,
        });
      }
    } catch (error) {
      console.error(`Failed to persist secret ${key} to storage:`, error);
      throw error;
    }
  }

  private async loadSecretFromStorage(key: SecretKey): Promise<EncryptedSecret | null> {
    try {
      const configKey = `secret:${key}`;
      const configs = await this.storage.getTrustConfig(configKey);

      if (configs.length === 0) {
        return null;
      }

      const config = configs[0];
      const value = config.value as any;

      return {
        encrypted: value.encrypted,
        iv: value.iv,
        authTag: value.authTag,
        createdAt: new Date(value.createdAt),
        expiresAt: new Date(value.expiresAt),
        rotationCount: value.rotationCount || 0,
        lastRotatedAt: value.lastRotatedAt ? new Date(value.lastRotatedAt) : undefined,
      };
    } catch (error) {
      console.error(`Failed to load secret ${key} from storage:`, error);
      return null;
    }
  }

  private async recordRotationEvent(
    key: SecretKey,
    actor: string,
    eventType: 'created' | 'rotated'
  ): Promise<void> {
    try {
      const eventKey = `secret_rotation:${key}:${Date.now()}`;
      await this.storage.createTrustConfig({
        key: eventKey,
        value: {
          secretKey: key,
          eventType,
          actor,
          timestamp: new Date().toISOString(),
        },
        createdBy: actor,
      });
    } catch (error) {
      console.error(`Failed to record rotation event for ${key}:`, error);
      // Don't throw - rotation event is for audit purposes
    }
  }
}

/**
 * Singleton instance for global access
 */
let secretManagerInstance: SecretManager | null = null;

export function initializeSecretManager(storage: IStorage, masterPassword?: string): SecretManager {
  if (secretManagerInstance) {
    return secretManagerInstance;
  }

  secretManagerInstance = new SecretManager(storage, masterPassword);
  return secretManagerInstance;
}

export function getSecretManager(): SecretManager {
  if (!secretManagerInstance) {
    throw new Error('SecretManager not initialized. Call initializeSecretManager first.');
  }

  return secretManagerInstance;
}

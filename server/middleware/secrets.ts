import { Request, Response, NextFunction } from 'express';
import type { SecretManager, SecretKey } from '../secrets';

/**
 * Secrets middleware for Express
 * 
 * Features:
 * - Injects decrypted secrets into req.secrets
 * - Validates secrets on startup
 * - Alerts on expiring secrets (< 7 days)
 */

export interface SecretsRequest extends Request {
  secrets?: {
    getJwtSecret: () => Promise<string>;
    getIpSalt: () => Promise<string>;
    getTurnUsername: () => Promise<string>;
    getTurnCredential: () => Promise<string>;
    getPinataJwt: () => Promise<string>;
    getWeb3StorageToken: () => Promise<string>;
    getNftStorageToken: () => Promise<string>;
    generateTurnToken: () => Promise<{
      username: string;
      credential: string;
      expiresAt: Date;
    }>;
  };
}

/**
 * Validate all secrets are available and not expired
 */
export async function validateSecrets(secretManager: SecretManager): Promise<void> {
  console.log('🔍 Validating secrets...');

  const requiredSecrets: SecretKey[] = [
    'JWT_SECRET',
    'IP_SALT',
    'TURN_USERNAME',
    'TURN_CREDENTIAL',
    'PINATA_JWT',
    'WEB3_STORAGE_TOKEN',
    'NFT_STORAGE_TOKEN',
  ];

  const errors: string[] = [];

  for (const key of requiredSecrets) {
    try {
      await secretManager.getSecret(key, 'startup-validation');
    } catch (error: any) {
      errors.push(`${key}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    console.warn('⚠️  Secret validation warnings (using fallbacks):');
    errors.forEach(err => console.warn(`  - ${err}`));
    console.warn('⚠️  Server will start with fallback configuration. Secrets will be regenerated on first use.');
    return;
  }

  console.log('✅ All secrets validated successfully');
}

/**
 * Check for expiring secrets and alert
 */
export async function checkExpiringSecrets(secretManager: SecretManager): Promise<void> {
  const warnings = await secretManager.checkExpiringSecrets();

  if (warnings.length > 0) {
    console.warn('\n⚠️  WARNING: Secrets expiring soon:');
    warnings.forEach(({ key, daysUntilExpiry }) => {
      if (daysUntilExpiry <= 0) {
        console.error(`  ❌ ${key}: EXPIRED`);
      } else if (daysUntilExpiry <= 3) {
        console.error(`  ⚠️  ${key}: ${daysUntilExpiry} days remaining (URGENT)`);
      } else {
        console.warn(`  ⚠️  ${key}: ${daysUntilExpiry} days remaining`);
      }
    });
    console.warn('\n  Run secret rotation to renew expiring secrets.\n');
  }
}

/**
 * Middleware factory to inject secrets into request
 */
export function createSecretsMiddleware(secretManager: SecretManager) {
  return async (req: SecretsRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Inject secret accessor methods into request
      const actor = req.ip || 'unknown';
      
      req.secrets = {
        getJwtSecret: () => secretManager.getSecret('JWT_SECRET', actor),
        getIpSalt: () => secretManager.getSecret('IP_SALT', actor),
        getTurnUsername: () => secretManager.getSecret('TURN_USERNAME', actor),
        getTurnCredential: () => secretManager.getSecret('TURN_CREDENTIAL', actor),
        getPinataJwt: () => secretManager.getSecret('PINATA_JWT', actor),
        getWeb3StorageToken: () => secretManager.getSecret('WEB3_STORAGE_TOKEN', actor),
        getNftStorageToken: () => secretManager.getSecret('NFT_STORAGE_TOKEN', actor),
        generateTurnToken: () => secretManager.generateTurnToken(actor),
      };

      next();
    } catch (error: any) {
      console.error('Secrets middleware error:', error);
      res.status(500).json({
        error: 'Internal server error - secrets unavailable',
      });
    }
  };
}

/**
 * Startup validation and warnings
 */
export async function performStartupChecks(secretManager: SecretManager): Promise<void> {
  console.log('\n🔐 Performing secrets startup checks...\n');

  // Validate all secrets
  await validateSecrets(secretManager);

  // Check for expiring secrets
  await checkExpiringSecrets(secretManager);

  // Display secret metadata
  const metadata = secretManager.getSecretsMetadata();
  console.log('\n📊 Secrets Status:');
  console.log('┌─────────────────────────┬──────────────┬──────────────┬──────────────┐');
  console.log('│ Secret                  │ Rotation #   │ Days to Exp  │ Status       │');
  console.log('├─────────────────────────┼──────────────┼──────────────┼──────────────┤');

  for (const [key, data] of metadata.entries()) {
    const daysUntilExpiry = Math.ceil(
      (data.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    let status = '✅ OK';
    if (daysUntilExpiry <= 0) {
      status = '❌ EXPIRED';
    } else if (daysUntilExpiry <= 3) {
      status = '⚠️  URGENT';
    } else if (daysUntilExpiry <= 7) {
      status = '⚠️  WARNING';
    }

    const keyPadded = key.padEnd(23);
    const rotationPadded = String(data.rotationCount).padEnd(12);
    const expiryPadded = String(daysUntilExpiry).padEnd(12);
    const statusPadded = status.padEnd(12);

    console.log(`│ ${keyPadded} │ ${rotationPadded} │ ${expiryPadded} │ ${statusPadded} │`);
  }

  console.log('└─────────────────────────┴──────────────┴──────────────┴──────────────┘\n');
}

/**
 * Schedule periodic expiry checks (run every 24 hours)
 */
export function scheduleExpiryChecks(secretManager: SecretManager): void {
  const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  setInterval(async () => {
    try {
      await checkExpiringSecrets(secretManager);
    } catch (error) {
      console.error('Error during scheduled expiry check:', error);
    }
  }, CHECK_INTERVAL);

  console.log('⏰ Scheduled daily expiry checks');
}

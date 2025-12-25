import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { verifyMessage } from 'viem';
import axios, { AxiosError } from 'axios';

/**
 * Webhook event types
 */
export type WebhookEventType = 'message_received' | 'call_started' | 'payment_received';

/**
 * Webhook payload
 */
export interface WebhookPayload {
  eventType: WebhookEventType;
  timestamp: number;
  data: Record<string, any>;
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  success: boolean;
  attempts: number;
  statusCode?: number;
  error?: string;
  deliveredAt?: number;
}

/**
 * Encrypted webhook configuration
 */
export interface EncryptedWebhookConfig {
  encryptedUrl: string;
  iv: string;
  tag: string;
}

/**
 * WebhookService - Secure webhook notifications with encryption and signatures
 * 
 * Features:
 * - AES-256-GCM encryption for webhook URLs
 * - EIP-191 signature generation for webhook payloads
 * - Exponential backoff retry mechanism (max 3 attempts)
 * - Signature verification for receiver side
 */
export class WebhookService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second
  private encryptionKey: Buffer;

  constructor(encryptionKey?: string) {
    // Use provided key or generate a new one
    // In production, this should come from environment variables
    this.encryptionKey = encryptionKey 
      ? Buffer.from(encryptionKey, 'hex')
      : randomBytes(32);
  }

  /**
   * Encrypt a webhook URL using AES-256-GCM
   * 
   * @param url - Webhook URL to encrypt
   * @returns EncryptedWebhookConfig - Encrypted URL with IV and auth tag
   */
  encryptWebhookUrl(url: string): EncryptedWebhookConfig {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(url, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encryptedUrl: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  /**
   * Decrypt a webhook URL
   * 
   * @param config - Encrypted webhook configuration
   * @returns string - Decrypted webhook URL
   */
  decryptWebhookUrl(config: EncryptedWebhookConfig): string {
    const iv = Buffer.from(config.iv, 'hex');
    const tag = Buffer.from(config.tag, 'hex');
    const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
    
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(config.encryptedUrl, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate EIP-191 signature for webhook payload
   * 
   * @param payload - Webhook payload to sign
   * @param privateKey - Private key for signing (0x-prefixed hex string)
   * @returns Promise<string> - Signature
   * 
   * Note: In production, use a secure key management system
   */
  async generateSignature(payload: WebhookPayload, privateKey: string): Promise<string> {
    // Create message hash
    const message = JSON.stringify(payload);
    const messageHash = createHash('sha256').update(message).digest('hex');
    
    // For EIP-191, we'll use a simple hash-based signature
    // In production, use actual wallet signing
    const ethers = await import('ethers');
    const wallet = new ethers.Wallet(privateKey);
    const signature = await wallet.signMessage(messageHash);
    
    return signature;
  }

  /**
   * Verify EIP-191 signature for webhook payload
   * 
   * @param payload - Webhook payload
   * @param signature - Signature to verify
   * @param expectedAddress - Expected signer address
   * @returns Promise<boolean> - True if signature is valid
   */
  async verifySignature(
    payload: WebhookPayload,
    signature: string,
    expectedAddress: string
  ): Promise<boolean> {
    try {
      const message = JSON.stringify(payload);
      const messageHash = createHash('sha256').update(message).digest('hex');

      const recoveredAddress = await verifyMessage({
        message: messageHash,
        signature: signature as `0x${string}`,
      });

      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Send webhook with retry and exponential backoff
   * 
   * @param url - Webhook URL (can be encrypted config)
   * @param payload - Webhook payload
   * @param signature - Optional signature for payload
   * @returns Promise<WebhookDeliveryResult> - Delivery result
   */
  async sendWebhook(
    url: string | EncryptedWebhookConfig,
    payload: WebhookPayload,
    signature?: string
  ): Promise<WebhookDeliveryResult> {
    // Decrypt URL if encrypted
    const webhookUrl = typeof url === 'string' 
      ? url 
      : this.decryptWebhookUrl(url);

    let lastError: string | undefined;
    let statusCode: number | undefined;

    // Retry with exponential backoff
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Timestamp': payload.timestamp.toString(),
          'X-Webhook-Event': payload.eventType,
        };

        // Add signature if provided
        if (signature) {
          headers['X-Webhook-Signature'] = signature;
        }

        const response = await axios.post(webhookUrl, payload, {
          headers,
          timeout: 10000, // 10 second timeout
        });

        statusCode = response.status;

        // Success if 2xx status
        if (response.status >= 200 && response.status < 300) {
          return {
            success: true,
            attempts: attempt + 1,
            statusCode: response.status,
            deliveredAt: Date.now(),
          };
        }

        lastError = `HTTP ${response.status}: ${response.statusText}`;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          statusCode = axiosError.response?.status;
          lastError = axiosError.message;

          // Don't retry on 4xx errors (client errors)
          if (statusCode && statusCode >= 400 && statusCode < 500) {
            break;
          }
        } else {
          lastError = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < this.maxRetries - 1) {
        const delay = this.baseDelay * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      attempts: this.maxRetries,
      statusCode,
      error: lastError,
    };
  }

  /**
   * Test webhook delivery without payload
   * 
   * @param url - Webhook URL to test
   * @returns Promise<WebhookDeliveryResult> - Test result
   */
  async testWebhook(url: string | EncryptedWebhookConfig): Promise<WebhookDeliveryResult> {
    const testPayload: WebhookPayload = {
      eventType: 'message_received',
      timestamp: Date.now(),
      data: {
        test: true,
        message: 'This is a test webhook delivery',
      },
    };

    return this.sendWebhook(url, testPayload);
  }

  /**
   * Sleep utility for retry backoff
   * 
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get encryption key (for backup/recovery)
   * WARNING: Keep this secure!
   * 
   * @returns string - Hex-encoded encryption key
   */
  getEncryptionKey(): string {
    return this.encryptionKey.toString('hex');
  }
}

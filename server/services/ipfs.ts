import { PinataSDK } from "pinata";
import { Readable } from "stream";
import { rootLogger } from "../observability/logger";

const logger = rootLogger.child({ module: "ipfs" });

/**
 * Helper to convert Readable stream to Buffer
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Configuration for IPFS service
 */
interface IPFSConfig {
  pinataJwt?: string;
  pinataGateway?: string;
  enabled: boolean;
}

/**
 * Result from IPFS upload operation
 */
export interface IPFSUploadResult {
  success: boolean;
  cid?: string;
  gatewayUrl?: string;
  error?: string;
}

/**
 * Options for uploading files to IPFS
 */
export interface IPFSUploadOptions {
  name?: string;
  metadata?: Record<string, any>;
  groupId?: string;
}

/**
 * IPFSService - Real IPFS storage integration using Pinata
 * 
 * Features:
 * - Upload files (videos, images, documents) to IPFS via Pinata
 * - Upload JSON data to IPFS
 * - Generate gateway URLs for accessing content
 * - Graceful degradation when IPFS is not configured
 * - Comprehensive error handling and logging
 * 
 * Environment Variables Required:
 * - PINATA_JWT: JWT token for Pinata API authentication
 * - PINATA_GATEWAY: Custom Pinata gateway URL (optional, uses public gateway if not set)
 * 
 * @example
 * ```typescript
 * const ipfsService = new IPFSService();
 * 
 * // Upload a file
 * const result = await ipfsService.uploadFile(
 *   fileBuffer, 
 *   { name: 'video.mp4', metadata: { type: 'video' } }
 * );
 * 
 * // Upload JSON
 * const jsonResult = await ipfsService.uploadJSON(
 *   { message: 'Hello IPFS' },
 *   { name: 'message.json' }
 * );
 * ```
 */
export class IPFSService {
  private pinata: PinataSDK | null = null;
  private config: IPFSConfig;

  constructor() {
    this.config = this.loadConfig();
    
    if (this.config.enabled) {
      try {
        this.pinata = new PinataSDK({
          pinataJwt: this.config.pinataJwt!,
        });
        logger.info("IPFS service initialized with Pinata", {
          gateway: this.config.pinataGateway || "public",
        });
      } catch (error) {
        logger.error("Failed to initialize Pinata SDK", error as Error);
        this.config.enabled = false;
      }
    } else {
      logger.warn("IPFS service disabled - PINATA_JWT not configured");
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): IPFSConfig {
    const pinataJwt = process.env.PINATA_JWT;
    const pinataGateway = process.env.PINATA_GATEWAY;

    return {
      pinataJwt,
      pinataGateway,
      enabled: !!pinataJwt,
    };
  }

  /**
   * Check if IPFS service is enabled and configured
   */
  public isEnabled(): boolean {
    return this.config.enabled && this.pinata !== null;
  }

  /**
   * Upload a file to IPFS via Pinata
   * 
   * @param file - File buffer or readable stream
   * @param options - Upload options including name and metadata
   * @returns IPFSUploadResult with CID and gateway URL
   * 
   * @example
   * ```typescript
   * const buffer = await fs.readFile('video.mp4');
   * const result = await ipfsService.uploadFile(buffer, {
   *   name: 'my-video.mp4',
   *   metadata: { type: 'video/mp4', size: buffer.length }
   * });
   * ```
   */
  public async uploadFile(
    file: Buffer | Readable,
    options?: IPFSUploadOptions
  ): Promise<IPFSUploadResult> {
    if (!this.isEnabled()) {
      const error = "IPFS service is not configured. Please set PINATA_JWT environment variable.";
      logger.error(error);
      return {
        success: false,
        error,
      };
    }

    try {
      logger.info("Uploading file to IPFS", {
        name: options?.name,
        hasMetadata: !!options?.metadata,
      });

      // Convert Buffer to File-like object for Pinata SDK
      const fileToUpload = file instanceof Buffer
        ? new File([file], options?.name || "file", { type: "application/octet-stream" })
        : new File([await streamToBuffer(file)], options?.name || "file", { type: "application/octet-stream" });

      let uploadBuilder = this.pinata!.upload.public.file(fileToUpload);
      
      if (options?.name) {
        uploadBuilder = uploadBuilder.name(options.name);
      }

      if (options?.metadata) {
        uploadBuilder = uploadBuilder.keyvalues(options.metadata as Record<string, string>);
      }

      if (options?.groupId) {
        uploadBuilder = uploadBuilder.group(options.groupId);
      }

      const result = await uploadBuilder;

      const cid = result.cid;
      const gatewayUrl = this.getGatewayUrl(cid);

      logger.info("File uploaded to IPFS successfully", {
        cid,
        name: options?.name,
        size: file instanceof Buffer ? file.length : "stream",
      });

      return {
        success: true,
        cid,
        gatewayUrl,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to upload file to IPFS", error as Error, {
        name: options?.name,
      });

      return {
        success: false,
        error: `IPFS upload failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Upload JSON data to IPFS via Pinata
   * 
   * @param data - JSON-serializable data
   * @param options - Upload options including name and metadata
   * @returns IPFSUploadResult with CID and gateway URL
   * 
   * @example
   * ```typescript
   * const result = await ipfsService.uploadJSON(
   *   { message: 'Hello', timestamp: Date.now() },
   *   { name: 'message.json' }
   * );
   * ```
   */
  public async uploadJSON(
    data: any,
    options?: IPFSUploadOptions
  ): Promise<IPFSUploadResult> {
    if (!this.isEnabled()) {
      const error = "IPFS service is not configured. Please set PINATA_JWT environment variable.";
      logger.error(error);
      return {
        success: false,
        error,
      };
    }

    try {
      logger.info("Uploading JSON to IPFS", {
        name: options?.name,
        dataSize: JSON.stringify(data).length,
      });

      let uploadBuilder = this.pinata!.upload.public.json(data);
      
      if (options?.name) {
        uploadBuilder = uploadBuilder.name(options.name);
      }

      if (options?.metadata) {
        uploadBuilder = uploadBuilder.keyvalues(options.metadata as Record<string, string>);
      }

      if (options?.groupId) {
        uploadBuilder = uploadBuilder.group(options.groupId);
      }

      const result = await uploadBuilder;

      const cid = result.cid;
      const gatewayUrl = this.getGatewayUrl(cid);

      logger.info("JSON uploaded to IPFS successfully", {
        cid,
        name: options?.name,
      });

      return {
        success: true,
        cid,
        gatewayUrl,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to upload JSON to IPFS", error as Error, {
        name: options?.name,
      });

      return {
        success: false,
        error: `IPFS JSON upload failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Upload base64-encoded data to IPFS
   * 
   * @param base64Data - Base64-encoded string
   * @param options - Upload options including name and metadata
   * @returns IPFSUploadResult with CID and gateway URL
   */
  public async uploadBase64(
    base64Data: string,
    options?: IPFSUploadOptions
  ): Promise<IPFSUploadResult> {
    if (!this.isEnabled()) {
      const error = "IPFS service is not configured. Please set PINATA_JWT environment variable.";
      logger.error(error);
      return {
        success: false,
        error,
      };
    }

    try {
      // Remove data URL prefix if present
      const base64String = base64Data.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64String, "base64");

      return await this.uploadFile(buffer, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to decode and upload base64 data", error as Error);

      return {
        success: false,
        error: `Base64 upload failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Get gateway URL for a CID
   * 
   * @param cid - IPFS CID
   * @returns Gateway URL for accessing the content
   */
  public getGatewayUrl(cid: string): string {
    if (this.config.pinataGateway) {
      return `${this.config.pinataGateway}/ipfs/${cid}`;
    }
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }

  /**
   * Unpin a file from IPFS (remove from Pinata)
   * 
   * @param cid - IPFS CID to unpin
   * @returns Success status
   */
  public async unpinFile(cid: string): Promise<boolean> {
    if (!this.isEnabled()) {
      logger.error("IPFS service is not configured");
      return false;
    }

    try {
      await this.pinata!.files.public.delete([cid]);
      logger.info("File unpinned from IPFS", { cid });
      return true;
    } catch (error) {
      logger.error("Failed to unpin file from IPFS", error as Error, { cid });
      return false;
    }
  }

  /**
   * Get configuration status for debugging
   */
  public getStatus(): {
    enabled: boolean;
    configured: boolean;
    gateway: string | null;
  } {
    return {
      enabled: this.config.enabled,
      configured: this.pinata !== null,
      gateway: this.config.pinataGateway || "public",
    };
  }
}

// Export singleton instance
let ipfsServiceInstance: IPFSService | null = null;

/**
 * Get the singleton IPFS service instance
 */
export function getIPFSService(): IPFSService {
  if (!ipfsServiceInstance) {
    ipfsServiceInstance = new IPFSService();
  }
  return ipfsServiceInstance;
}

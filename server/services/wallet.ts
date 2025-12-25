import type { WalletRegistry } from "@shared/schema";
import type { IStorage } from "../storage";

/**
 * WalletService - Handles wallet popout logic for crypto wallet integrations
 * 
 * Provides functionality to:
 * - Retrieve wallet configurations from registry
 * - Build deep links for wallet apps
 * - Build QR code fallback URLs
 * - Manage user wallet preferences
 */
export class WalletService {
  constructor(private storage: IStorage) {}

  /**
   * Get all wallet configurations from the registry
   */
  async getRegistry(): Promise<WalletRegistry[]> {
    return await this.storage.getWalletRegistry();
  }

  /**
   * Build a deep link URL from a wallet's deep link template
   * 
   * @param walletId - The wallet identifier (e.g., "metamask", "phantom")
   * @param params - Parameters to substitute into the template (e.g., { action: "sign", payload: "..." })
   * @returns Constructed deep link URL or null if wallet not found
   * 
   * @example
   * // Template: "metamask://sign?data={{payload}}"
   * // Params: { payload: "0x123abc" }
   * // Result: "metamask://sign?data=0x123abc"
   */
  async buildDeepLink(walletId: string, params: Record<string, string>): Promise<string | null> {
    const wallets = await this.storage.getWalletRegistry();
    const wallet = wallets.find(w => w.walletId === walletId);
    
    if (!wallet || !wallet.deepLinkTemplate) {
      return null;
    }

    let deepLink = wallet.deepLinkTemplate;
    
    // Replace template variables like {{action}}, {{payload}}, etc.
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{{${key}}}`;
      deepLink = deepLink.replace(new RegExp(placeholder, 'g'), encodeURIComponent(value));
    }

    return deepLink;
  }

  /**
   * Build a QR code fallback URL from a wallet's QR template
   * 
   * @param walletId - The wallet identifier
   * @param params - Parameters to substitute into the template
   * @returns Constructed QR fallback URL or null if wallet not found
   * 
   * @example
   * // Template: "https://metamask.app.link/sign?data={{payload}}"
   * // Params: { payload: "0x123abc" }
   * // Result: "https://metamask.app.link/sign?data=0x123abc"
   */
  async buildQRPayload(walletId: string, params: Record<string, string>): Promise<string | null> {
    const wallets = await this.storage.getWalletRegistry();
    const wallet = wallets.find(w => w.walletId === walletId);
    
    if (!wallet || !wallet.qrTemplate) {
      return null;
    }

    let qrPayload = wallet.qrTemplate;
    
    // Replace template variables like {{action}}, {{payload}}, etc.
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{{${key}}}`;
      qrPayload = qrPayload.replace(new RegExp(placeholder, 'g'), encodeURIComponent(value));
    }

    return qrPayload;
  }

  /**
   * Store user's preferred wallet choice
   * 
   * @param userId - The user's unique identifier
   * @param walletId - The wallet identifier to set as preferred
   */
  async setPreferredWallet(userId: string, walletId: string): Promise<void> {
    await this.storage.setPreferredWallet(userId, walletId);
  }

  /**
   * Retrieve user's preferred wallet
   * 
   * @param userId - The user's unique identifier
   * @returns The wallet ID or null if no preference set
   */
  async getPreferredWallet(userId: string): Promise<string | null> {
    return await this.storage.getPreferredWallet(userId);
  }
}

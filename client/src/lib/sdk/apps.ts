import { P3 } from './index';
import { appManifests, getManifest as getLocalManifest } from './manifests';

type Address = string;

export interface AppManifest {
  id: string;
  title: string;
  version?: string;
  category?: string;
  description?: string;
  developer?: { 
    name?: string; 
    contact?: string; 
    website?: string;
  };
  permissions?: string[];
  widgets?: { 
    id: string; 
    title: string; 
    size: '1x1' | '2x1' | '2x2'; 
    entry: string;
  }[];
  contextMenu?: { 
    id: string; 
    label: string; 
    action: string;
  }[];
  links?: { 
    pwa?: string; 
    deeplinks?: { 
      metamask?: string; 
      coinbase?: string;
    };
  };
}

export { appManifests };

const walletKey = (addr: Address, suffix: string) => `p3:${addr.toLowerCase()}:${suffix}`;

async function getWalletAddress(): Promise<string> {
  const wallet = await P3.wallet();
  if (!wallet.address) throw new Error('Wallet not connected');
  return wallet.address.toLowerCase();
}

export const Apps = {
  async getManifest(appId: string): Promise<AppManifest | null> {
    return getLocalManifest(appId);
  },

  async installable(appId: string): Promise<boolean> {
    const m = await Apps.getManifest(appId);
    return !!m?.links?.pwa;
  },

  async install(appId: string): Promise<void> {
    const m = await Apps.getManifest(appId);
    if (!m?.links?.pwa) {
      const pwaPath = `/standalone/${appId}/`;
      if ((window as any).deferredPrompt) {
        const prompt = (window as any).deferredPrompt;
        await prompt.prompt();
        await prompt.userChoice;
        (window as any).deferredPrompt = null;
      } else {
        window.open(pwaPath, '_blank', 'noopener');
      }
    } else {
      if ((window as any).deferredPrompt) {
        const prompt = (window as any).deferredPrompt;
        await prompt.prompt();
        await prompt.userChoice;
        (window as any).deferredPrompt = null;
      } else {
        window.open(m.links.pwa, '_blank', 'noopener');
      }
    }
    
    try {
      const addr = await getWalletAddress();
      const installed = JSON.parse(localStorage.getItem(walletKey(addr, 'installed')) || '[]');
      if (!installed.includes(appId)) {
        installed.push(appId);
        localStorage.setItem(walletKey(addr, 'installed'), JSON.stringify(installed));
      }
    } catch {
    }
  },

  async uninstall(appId: string): Promise<void> {
    try {
      const addr = await getWalletAddress();
      const installed = JSON.parse(localStorage.getItem(walletKey(addr, 'installed')) || '[]');
      const next = installed.filter((x: string) => x !== appId);
      localStorage.setItem(walletKey(addr, 'installed'), JSON.stringify(next));
    } catch {
    }
  },

  async installed(addr?: Address): Promise<string[]> {
    try {
      const a = addr || await getWalletAddress();
      return JSON.parse(localStorage.getItem(walletKey(a, 'installed')) || '[]');
    } catch {
      return [];
    }
  },

  async isInstalled(appId: string, addr?: Address): Promise<boolean> {
    const list = await Apps.installed(addr);
    return list.includes(appId);
  },

  async addFavorite(appId: string): Promise<void> {
    try {
      const addr = await getWalletAddress();
      const favs = JSON.parse(localStorage.getItem(walletKey(addr, 'favorites')) || '[]');
      if (!favs.includes(appId)) {
        favs.unshift(appId);
        localStorage.setItem(walletKey(addr, 'favorites'), JSON.stringify(favs));
      }
    } catch {
    }
  },

  async removeFavorite(appId: string): Promise<void> {
    try {
      const addr = await getWalletAddress();
      const favs = JSON.parse(localStorage.getItem(walletKey(addr, 'favorites')) || '[]');
      localStorage.setItem(walletKey(addr, 'favorites'), JSON.stringify(favs.filter((x: string) => x !== appId)));
    } catch {
    }
  },

  async favorites(addr?: Address): Promise<string[]> {
    try {
      const a = addr || await getWalletAddress();
      return JSON.parse(localStorage.getItem(walletKey(a, 'favorites')) || '[]');
    } catch {
      return [];
    }
  },

  async widgets(appId: string) {
    const m = await Apps.getManifest(appId);
    return m?.widgets || [];
  },

  async deepLinks(appId: string) {
    const m = await Apps.getManifest(appId);
    return m?.links?.deeplinks || {};
  },

  async pins(addr?: Address): Promise<string[]> {
    try {
      const a = addr || await getWalletAddress();
      return JSON.parse(localStorage.getItem(walletKey(a, 'home:pins')) || '[]');
    } catch {
      return [];
    }
  },

  async addPin(appId: string): Promise<void> {
    try {
      const addr = await getWalletAddress();
      const pins = JSON.parse(localStorage.getItem(walletKey(addr, 'home:pins')) || '[]');
      if (!pins.includes(appId)) {
        pins.unshift(appId);
        localStorage.setItem(walletKey(addr, 'home:pins'), JSON.stringify(pins));
      }
    } catch {
    }
  },

  async removePin(appId: string): Promise<void> {
    try {
      const addr = await getWalletAddress();
      const pins = JSON.parse(localStorage.getItem(walletKey(addr, 'home:pins')) || '[]');
      localStorage.setItem(walletKey(addr, 'home:pins'), JSON.stringify(pins.filter((x: string) => x !== appId)));
    } catch {
    }
  }
};

export type { Address };

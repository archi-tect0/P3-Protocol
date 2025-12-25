import { P3 } from './index';

export interface Review {
  id: string;
  appId: string;
  address: string;
  rating: number;
  text?: string;
  ts: number;
}

export interface ReviewStats {
  avg: number;
  count: number;
}

async function getWalletAddress(): Promise<string> {
  const wallet = await P3.wallet();
  if (!wallet.address) throw new Error('Wallet not connected');
  return wallet.address.toLowerCase();
}

export const Reviews = {
  async list(appId: string): Promise<Review[]> {
    try {
      const raw = localStorage.getItem(`p3:reviews:${appId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async add(appId: string, rating: number, text?: string): Promise<Review> {
    const addr = await getWalletAddress();
    const r: Review = {
      id: `${appId}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      appId,
      address: addr,
      rating: Math.min(5, Math.max(1, rating)),
      text,
      ts: Date.now()
    };
    
    const list = await Reviews.list(appId);
    const existingIdx = list.findIndex(rev => rev.address === addr);
    
    let next: Review[];
    if (existingIdx >= 0) {
      list[existingIdx] = r;
      next = list;
    } else {
      next = [r, ...list].slice(0, 200);
    }
    
    localStorage.setItem(`p3:reviews:${appId}`, JSON.stringify(next));
    
    try {
      await P3.proofs.publish('app_review', { 
        appId, 
        rating,
        reviewId: r.id,
        privacy: 'hash-only'
      });
    } catch {
    }
    
    return r;
  },

  async stats(appId: string): Promise<ReviewStats> {
    const list = await Reviews.list(appId);
    const count = list.length;
    const avg = count ? (list.reduce((s, r) => s + r.rating, 0) / count) : 0;
    return { 
      avg: Math.round(avg * 10) / 10, 
      count 
    };
  },

  async myReview(appId: string): Promise<Review | null> {
    try {
      const addr = await getWalletAddress();
      const list = await Reviews.list(appId);
      return list.find(r => r.address === addr) || null;
    } catch {
      return null;
    }
  },

  async remove(appId: string, reviewId: string): Promise<void> {
    const addr = await getWalletAddress();
    const list = await Reviews.list(appId);
    const review = list.find(r => r.id === reviewId);
    
    if (review && review.address === addr) {
      const next = list.filter(r => r.id !== reviewId);
      localStorage.setItem(`p3:reviews:${appId}`, JSON.stringify(next));
    }
  }
};

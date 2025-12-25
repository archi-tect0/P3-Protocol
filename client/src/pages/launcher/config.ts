import { MessageSquare, Video, Vote, Settings, Phone, FileText, CreditCard, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MiniApp {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  route: string;
  gradient: string;
  category: 'communication' | 'governance' | 'admin' | 'utility' | 'settings';
  enabled: boolean;
}

export const miniApps: MiniApp[] = [
  {
    id: 'messaging',
    name: 'Messages',
    description: 'End-to-end encrypted messaging with blockchain anchoring',
    icon: MessageSquare,
    route: '/launcher/messaging',
    gradient: 'from-purple-500 to-indigo-600',
    category: 'communication',
    enabled: true,
  },
  {
    id: 'video',
    name: 'Video Calls',
    description: 'Secure WebRTC video conferencing with receipt generation',
    icon: Video,
    route: '/launcher/video',
    gradient: 'from-indigo-500 to-blue-600',
    category: 'communication',
    enabled: true,
  },
  {
    id: 'voice',
    name: 'Voice Calls',
    description: 'Encrypted voice calls with blockchain-anchored receipts',
    icon: Phone,
    route: '/app/voice',
    gradient: 'from-green-500 to-emerald-600',
    category: 'communication',
    enabled: true,
  },
  {
    id: 'notes',
    name: 'Notes',
    description: 'Encrypted personal notes with IPFS storage',
    icon: FileText,
    route: '/app/notes',
    gradient: 'from-amber-500 to-orange-600',
    category: 'utility',
    enabled: true,
  },
  {
    id: 'payments',
    name: 'Payments',
    description: 'ERC-20 token transfers with on-chain receipts',
    icon: CreditCard,
    route: '/app/payments',
    gradient: 'from-cyan-500 to-blue-600',
    category: 'utility',
    enabled: true,
  },
  {
    id: 'dao',
    name: 'Governance',
    description: 'DAO proposals and on-chain voting',
    icon: Vote,
    route: '/launcher/dao',
    gradient: 'from-violet-500 to-purple-600',
    category: 'governance',
    enabled: true,
  },
  {
    id: 'admin',
    name: 'Admin Panel',
    description: 'System configuration and management',
    icon: Settings,
    route: '/launcher/admin',
    gradient: 'from-slate-500 to-slate-700',
    category: 'admin',
    enabled: true,
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'Encryption keys, decrypt password, and biometric security',
    icon: Shield,
    route: '/launcher/settings',
    gradient: 'from-emerald-500 to-teal-600',
    category: 'settings',
    enabled: true,
  },
];

export const categories = [
  { id: 'all', name: 'All' },
  { id: 'communication', name: 'Comms' },
  { id: 'utility', name: 'Utility' },
  { id: 'governance', name: 'DAO' },
  { id: 'appstore', name: 'Store' },
];

export function getWalletAddress(): string | null {
  return localStorage.getItem('walletAddress');
}

export function setWalletAddress(address: string): void {
  localStorage.setItem('walletAddress', address);
}

export function clearWalletAddress(): void {
  localStorage.removeItem('walletAddress');
}

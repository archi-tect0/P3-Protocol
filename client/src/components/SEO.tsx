import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
}

export default function SEO({ 
  title = 'P3 Protocol', 
  description = 'Web3 Mesh Operating System with voice-first interface, end-to-end encryption, and blockchain anchoring',
  path = '/',
  image = '/icons/atlas-512.svg'
}: SEOProps) {
  useEffect(() => {
    const fullTitle = title.includes('P3 Protocol') 
      ? title 
      : `${title} | P3 Protocol`;
    
    document.title = fullTitle;
    
    const updateMeta = (selector: string, content: string) => {
      const el = document.querySelector(selector) as HTMLMetaElement;
      if (el) el.content = content;
    };
    
    updateMeta('meta[name="description"]', description);
    updateMeta('meta[property="og:title"]', fullTitle);
    updateMeta('meta[property="og:description"]', description);
    updateMeta('meta[property="og:url"]', `https://p3protocol.com${path}`);
    updateMeta('meta[property="og:image"]', image.startsWith('http') ? image : `https://p3protocol.com${image}`);
    updateMeta('meta[name="twitter:title"]', fullTitle);
    updateMeta('meta[name="twitter:description"]', description);
    updateMeta('meta[name="twitter:image"]', image.startsWith('http') ? image : `https://p3protocol.com${image}`);
    
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonical) canonical.href = `https://p3protocol.com${path}`;
    
    return () => {
      document.title = 'P3 Protocol - Web3 Mesh Operating System | Atlas Substrate';
    };
  }, [title, description, path, image]);
  
  return null;
}

export const pageSEO = {
  landing: {
    title: 'P3 Protocol - Web3 Mesh Operating System',
    description: 'Voice-first Atlas substrate for encrypted messaging, payments, and decentralized apps. Connect your wallet, control everything.',
    path: '/'
  },
  atlas: {
    title: 'Atlas - Voice-First Web3 Assistant',
    description: 'Your conversational navigator for the P3 mesh. Send messages, check payments, navigate apps with voice commands.',
    path: '/atlas'
  },
  hub: {
    title: 'P3 Hub - App Marketplace',
    description: 'Discover and integrate Web3 applications. Manifest-driven registry with 100+ endpoints.',
    path: '/launcher'
  },
  nexus: {
    title: 'Nexus - Encrypted Communications',
    description: 'End-to-end encrypted messaging, voice calls, and payments with blockchain receipts.',
    path: '/app'
  },
  atlasWhitepaper: {
    title: 'Atlas Whitepaper - Technical Documentation',
    description: 'Deep dive into Atlas architecture: voice-first interface, Canvas UI, multi-AI integration, and manifest-driven registry.',
    path: '/launcher/atlas-whitepaper'
  },
  hubWhitepaper: {
    title: 'P3 Hub Whitepaper - Technical Documentation',
    description: 'Protocol marketplace architecture, manifest schemas, and developer integration guide.',
    path: '/launcher/whitepaper'
  },
  nexusWhitepaper: {
    title: 'Nexus Whitepaper - Technical Documentation',
    description: 'End-to-end encryption architecture, hybrid Kyber + NaCl, and blockchain anchoring.',
    path: '/launcher/nexus-whitepaper'
  },
  protocolWhitepaper: {
    title: 'P3 Protocol Whitepaper - Technical Documentation',
    description: 'Complete protocol specification: substrate mesh, wallet SSO, DAO governance, and cross-chain settlement.',
    path: '/launcher/protocol-whitepaper'
  },
  sdk: {
    title: 'Developer Kit - P3 SDK',
    description: 'Build on P3 Protocol with comprehensive SDK modules for anchoring, messaging, payments, and governance.',
    path: '/launcher/sdk'
  },
  about: {
    title: 'About P3 Protocol',
    description: 'Learn about the team and mission behind P3 Protocol - building the Web3 Mesh Operating System.',
    path: '/about'
  }
};

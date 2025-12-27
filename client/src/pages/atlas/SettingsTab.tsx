import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import DeveloperSettings from '@/components/atlas/DeveloperSettings';
import ControlPanel from '@/components/atlas/ControlPanel';
import AtlasArchitecture from '@/components/atlas/AtlasArchitecture';
import { 
  Wallet,
  Shield,
  LogOut,
  ExternalLink,
  Check,
  Copy,
  RefreshCw,
  Loader2,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Moon,
  Smartphone,
  Watch,
  Speaker,
  Monitor,
  Trash2,
  Plus,
  Code,
  Link2,
  ChevronRight,
  Info,
  Palette,
  Eye,
  Mic,
  MessageSquare,
  Sparkles,
  Circle,
  Globe,
  Waves,
  Grid3X3,
  Sun,
  Type,
  Stars,
  Target,
  Droplets,
  Ribbon,
  Play,
  RotateCcw,
  User,
  Terminal,
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Activity
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useAtlasSettings, useSetTheme, useSetColor, useUpdateVisualization } from '@/hooks/useAtlasVisualization';
import { useAtlasStore } from '@/state/useAtlasStore';
import type { VisualizationTheme } from '@/components/atlas/faces/types';
import { AtlasFace, DEFAULT_VISUALIZATION_SETTINGS, DEFAULT_ATLAS_STATE } from '@/components/atlas/AtlasFace';

interface Session {
  wallet: string;
  grants: string[];
  roles: string[];
  expiresAt: number;
}

interface PrivacySettings {
  proximitySurfacingEnabled: boolean;
  voiceAnnounce: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  contentMinimization: boolean;
}

interface Device {
  deviceId: string;
  deviceType: string;
  label: string;
  status: string;
  lastSeenAt?: string;
}

type SettingsSection = 'wallet' | 'privacy' | 'notifications' | 'visualization' | 'node' | 'endpoints' | 'devices' | 'developer' | 'connectors' | 'onboarding' | 'about';

const SECTIONS: { id: SettingsSection; label: string; icon: typeof Wallet; description: string }[] = [
  { id: 'wallet', label: 'Wallet & Session', icon: Wallet, description: 'Connection and grants' },
  { id: 'privacy', label: 'Privacy', icon: Shield, description: 'Announcements and visibility' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Push notification preferences' },
  { id: 'visualization', label: 'Visualization', icon: Palette, description: 'Face themes and colors' },
  { id: 'node', label: 'Node Mode', icon: Activity, description: 'Mesh participation and diagnostics' },
  { id: 'endpoints', label: 'Endpoints', icon: Zap, description: 'Personal Atlas Pulse' },
  { id: 'devices', label: 'Devices', icon: Smartphone, description: 'Paired device management' },
  { id: 'developer', label: 'Developer', icon: Code, description: 'AI providers and keys' },
  { id: 'connectors', label: 'Connectors', icon: Link2, description: 'OAuth integrations' },
  { id: 'onboarding', label: 'Onboarding', icon: Play, description: 'Replay and customize' },
  { id: 'about', label: 'About Atlas', icon: Info, description: 'Architecture and info' },
];

const THEME_OPTIONS: { value: VisualizationTheme; label: string; icon: typeof Circle; description: string }[] = [
  { value: 'line', label: 'Line', icon: Waves, description: 'Calm baseline with subtle undulation' },
  { value: 'globe', label: 'Globe', icon: Globe, description: 'Squishy orb reacting to voice' },
  { value: 'avatar', label: 'Avatar', icon: Eye, description: 'Custom avatar with glow effects' },
  { value: 'particles', label: 'Particles', icon: Sparkles, description: 'Particle field intensifying when speaking' },
  { value: 'wave_orb', label: 'Wave Orb', icon: Droplets, description: 'Liquid sphere rippling with amplitude' },
  { value: 'lattice', label: 'Lattice', icon: Grid3X3, description: 'Geometric mesh shifting softly' },
  { value: 'aura', label: 'Aura', icon: Sun, description: 'Diffuse glow band expanding/contracting' },
  { value: 'minimal_dot', label: 'Minimal Dot', icon: Circle, description: 'Single glowing dot for focus modes' },
  { value: 'typography_face', label: 'Typography', icon: Type, description: 'Animated ATLAS wordmark' },
  { value: 'constellation', label: 'Constellation', icon: Stars, description: 'Points and lines connecting' },
  { value: 'halo_rings', label: 'Halo Rings', icon: Target, description: 'Concentric circles pulsing gently' },
  { value: 'liquid_tile', label: 'Liquid Tile', icon: Droplets, description: 'Glassmorphism with inner fluid motion' },
  { value: 'ribbon_field', label: 'Ribbon Field', icon: Ribbon, description: 'Horizontal ribbons bending with voice' },
];

const COLOR_PRESETS = [
  { name: 'Cyan', primary: '#5CC8FF', accent: '#00D4FF' },
  { name: 'Purple', primary: '#A855F7', accent: '#C084FC' },
  { name: 'Emerald', primary: '#10B981', accent: '#34D399' },
  { name: 'Amber', primary: '#F59E0B', accent: '#FBBF24' },
  { name: 'Rose', primary: '#F43F5E', accent: '#FB7185' },
  { name: 'Blue', primary: '#3B82F6', accent: '#60A5FA' },
];

function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const deviceIcons: Record<string, typeof Smartphone> = {
  phone: Smartphone,
  watch: Watch,
  echo: Speaker,
  browser: Monitor,
  tablet: Monitor,
};

export default function SettingsTab({ 
  session, 
  onSessionChange 
}: { 
  session: Session;
  onSessionChange: () => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [activeSection, setActiveSection] = useState<SettingsSection | null>('wallet');
  
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [loadingEndpoints, setLoadingEndpoints] = useState(true);
  const [newEndpointUrl, setNewEndpointUrl] = useState('');
  const [newEndpointName, setNewEndpointName] = useState('');
  const [addingEndpoint, setAddingEndpoint] = useState(false);
  
  const [settings, setSettings] = useState<PrivacySettings>({
    proximitySurfacingEnabled: true,
    voiceAnnounce: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    contentMinimization: true,
  });
  
  const [onboardingState, setOnboardingState] = useState<{
    completed: boolean;
    path: 'end_user' | 'developer' | null;
    completedAt: number | null;
  }>({
    completed: false,
    path: null,
    completedAt: null,
  });
  const [resettingOnboarding, setResettingOnboarding] = useState(false);
  const [updatingOnboardingPath, setUpdatingOnboardingPath] = useState(false);
  
  const [nodeDiagnostics, setNodeDiagnostics] = useState<{
    signalStrength: number;
    peersConnected: number;
    tasksCompleted: number;
    bandwidthSaved: number;
    contributionLevel: number;
    status: string;
  }>({
    signalStrength: 0,
    peersConnected: 0,
    tasksCompleted: 0,
    bandwidthSaved: 0,
    contributionLevel: 0,
    status: 'connecting',
  });
  
  const [notificationPrefs, setNotificationPrefs] = useState<{
    enabled: boolean;
    messages: boolean;
    news: boolean;
    wikipedia: boolean;
  }>(() => {
    const saved = localStorage.getItem(`atlas.notifications.${session.wallet}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { }
    }
    return { enabled: false, messages: true, news: true, wikipedia: true };
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribing, setSubscribing] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  
  const { visualization: storeVisualization, visualizationLoaded, setMode, setPulseView, setWallet, loadOnboardingState: _loadOnboardingState, resetOnboarding: resetStoreOnboarding, nodeMode, setNodeModeEnabled, setGlobalRelayEnabled } = useAtlasStore();
  const vizSettings = visualizationLoaded ? storeVisualization : DEFAULT_VISUALIZATION_SETTINGS;
  const [vizPreviewState, setVizPreviewState] = useState(DEFAULT_ATLAS_STATE);
  
  useAtlasSettings(session.wallet);
  const setThemeMutation = useSetTheme(session.wallet);
  const setColorMutation = useSetColor(session.wallet);
  const updateVizMutation = useUpdateVisualization(session.wallet);

  useEffect(() => {
    fetchSettings();
    fetchDevices();
    fetchEndpoints();
    fetchNodeDiagnostics();
    checkNotificationPermission();
  }, [session.wallet]);
  
  function checkNotificationPermission() {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    setNotificationPermission(Notification.permission);
  }
  
  async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      toast({ title: 'Browser does not support notifications', variant: 'destructive' });
      return false;
    }
    
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === 'granted';
    } catch (err) {
      console.error('Failed to request notification permission:', err);
      toast({ title: 'Failed to request permission', variant: 'destructive' });
      return false;
    }
  }
  
  async function subscribeToNotifications(topics: string[]) {
    setSubscribing(true);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast({ title: 'Push notifications not supported in this browser', variant: 'destructive' });
        return false;
      }
      
      const vapidRes = await fetch('/api/notifications/vapid-public-key');
      const vapidData = await vapidRes.json();
      if (!vapidData.publicKey) {
        toast({ title: 'Failed to get server key', variant: 'destructive' });
        return false;
      }
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });
      
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-wallet-address': session.wallet,
        },
        body: JSON.stringify({
          wallet: session.wallet,
          subscription: subscription.toJSON(),
          topics,
        }),
      });
      
      const data = await res.json();
      if (data.ok) {
        toast({ title: 'Notifications enabled' });
        return true;
      } else {
        toast({ title: data.error || 'Failed to subscribe', variant: 'destructive' });
        return false;
      }
    } catch (err) {
      console.error('Failed to subscribe:', err);
      toast({ title: 'Failed to enable notifications', variant: 'destructive' });
      return false;
    } finally {
      setSubscribing(false);
    }
  }
  
  async function unsubscribeFromNotifications() {
    setSubscribing(true);
    try {
      const res = await fetch('/api/notifications/unsubscribe', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'x-wallet-address': session.wallet,
        },
        body: JSON.stringify({ wallet: session.wallet }),
      });
      
      const data = await res.json();
      if (data.ok) {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
          }
        }
        toast({ title: 'Notifications disabled' });
        return true;
      } else {
        toast({ title: data.error || 'Failed to unsubscribe', variant: 'destructive' });
        return false;
      }
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      toast({ title: 'Failed to disable notifications', variant: 'destructive' });
      return false;
    } finally {
      setSubscribing(false);
    }
  }
  
  async function updateNotificationTopics(newPrefs: typeof notificationPrefs) {
    const topics: string[] = [];
    if (newPrefs.messages) topics.push('messages');
    if (newPrefs.news) topics.push('news');
    if (newPrefs.wikipedia) topics.push('wikipedia');
    
    try {
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-wallet-address': session.wallet,
        },
        body: JSON.stringify({
          wallet: session.wallet,
          topics,
          updateTopicsOnly: true,
        }),
      });
      
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem(`atlas.notifications.${session.wallet}`, JSON.stringify(newPrefs));
        toast({ title: 'Notification preferences updated' });
      }
    } catch (err) {
      console.error('Failed to update topics:', err);
    }
  }
  
  async function sendTestNotification() {
    setTestingNotification(true);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-wallet-address': session.wallet,
        },
        body: JSON.stringify({ wallet: session.wallet }),
      });
      
      const data = await res.json();
      if (data.ok) {
        toast({ title: 'Test notification sent!' });
      } else {
        toast({ title: data.error || 'Failed to send test', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Failed to send test notification:', err);
      toast({ title: 'Failed to send test notification', variant: 'destructive' });
    } finally {
      setTestingNotification(false);
    }
  }
  
  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
  
  async function handleMasterToggle(enabled: boolean) {
    if (enabled) {
      if (notificationPermission !== 'granted') {
        const granted = await requestNotificationPermission();
        if (!granted) return;
      }
      
      const topics: string[] = [];
      if (notificationPrefs.messages) topics.push('messages');
      if (notificationPrefs.news) topics.push('news');
      if (notificationPrefs.wikipedia) topics.push('wikipedia');
      
      const success = await subscribeToNotifications(topics);
      if (success) {
        const newPrefs = { ...notificationPrefs, enabled: true };
        setNotificationPrefs(newPrefs);
        localStorage.setItem(`atlas.notifications.${session.wallet}`, JSON.stringify(newPrefs));
      }
    } else {
      const success = await unsubscribeFromNotifications();
      if (success) {
        const newPrefs = { ...notificationPrefs, enabled: false };
        setNotificationPrefs(newPrefs);
        localStorage.setItem(`atlas.notifications.${session.wallet}`, JSON.stringify(newPrefs));
      }
    }
  }
  
  function handleTopicToggle(topic: 'messages' | 'news' | 'wikipedia', enabled: boolean) {
    const newPrefs = { ...notificationPrefs, [topic]: enabled };
    setNotificationPrefs(newPrefs);
    
    if (notificationPrefs.enabled) {
      updateNotificationTopics(newPrefs);
    } else {
      localStorage.setItem(`atlas.notifications.${session.wallet}`, JSON.stringify(newPrefs));
    }
  }
  
  useEffect(() => {
    if (nodeMode.enabled) {
      const interval = setInterval(fetchNodeDiagnostics, 30000);
      return () => clearInterval(interval);
    }
  }, [nodeMode.enabled]);
  
  const diagnosticsAbortRef = useRef<AbortController | null>(null);
  
  async function fetchNodeDiagnostics() {
    if (diagnosticsAbortRef.current) {
      diagnosticsAbortRef.current.abort();
    }
    diagnosticsAbortRef.current = new AbortController();
    
    try {
      const res = await fetch('/api/atlas/pulse/node/diagnostics', {
        headers: { 'x-wallet-address': session.wallet },
        signal: diagnosticsAbortRef.current.signal
      });
      const data = await res.json();
      if (data.success && data.diagnostics) {
        const d = data.diagnostics;
        const signalStrength = typeof d.connectivity?.signalStrength === 'number' 
          ? Math.max(0, Math.min(100, Math.round(d.connectivity.signalStrength * 100))) 
          : 0;
        const peersConnected = Math.max(0, d.mesh?.peersConnected || 0);
        const tasksCompleted = Math.max(0, d.mesh?.tasksCompleted || 0);
        const bandwidthContributed = Math.max(0, d.mesh?.bandwidthContributed || 0);
        
        setNodeDiagnostics({
          signalStrength,
          peersConnected,
          tasksCompleted,
          bandwidthSaved: Math.round(bandwidthContributed / 1000),
          contributionLevel: Math.min(100, Math.max(0, Math.round((tasksCompleted / 200) * 100))),
          status: d.connectivity?.status || 'connecting',
        });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Failed to fetch node diagnostics:', err);
      }
    }
  }
  
  useEffect(() => {
    return () => {
      if (diagnosticsAbortRef.current) {
        diagnosticsAbortRef.current.abort();
      }
    };
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch(`/api/atlas/settings?wallet=${session.wallet}`);
      const data = await res.json();
      if (data.ok && data.settings) {
        setSettings({
          proximitySurfacingEnabled: data.settings.proximitySurfacingEnabled ?? true,
          voiceAnnounce: data.settings.voiceAnnounce ?? false,
          quietHoursStart: data.settings.quietHoursStart,
          quietHoursEnd: data.settings.quietHoursEnd,
          contentMinimization: data.settings.contentMinimization ?? true,
        });
        setOnboardingState({
          completed: data.settings.onboardingCompleted ?? false,
          path: data.settings.onboardingPath ?? null,
          completedAt: data.settings.onboardingCompletedAt ?? null,
        });
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }

  async function fetchDevices() {
    setLoadingDevices(true);
    try {
      const res = await fetch(`/api/atlas/devices?wallet=${session.wallet}`);
      const data = await res.json();
      if (data.ok) {
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  }

  async function fetchEndpoints() {
    setLoadingEndpoints(true);
    try {
      const res = await fetch(`/api/atlas/endpoints?wallet=${session.wallet}`);
      const data = await res.json();
      if (data.ok) setEndpoints(data.endpoints || []);
    } catch (e) { 
      console.error('Failed to fetch endpoints:', e); 
    }
    setLoadingEndpoints(false);
  }

  async function addEndpoint() {
    if (!newEndpointUrl.trim()) {
      toast({ title: 'Endpoint URL is required', variant: 'destructive' });
      return;
    }
    setAddingEndpoint(true);
    try {
      const res = await fetch('/api/atlas/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: session.wallet,
          endpointUrl: newEndpointUrl.trim(),
          displayName: newEndpointName.trim() || newEndpointUrl.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: 'Endpoint added' });
        setNewEndpointUrl('');
        setNewEndpointName('');
        fetchEndpoints();
      } else {
        toast({ title: data.error || 'Failed to add endpoint', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Failed to add endpoint:', err);
      toast({ title: 'Failed to add endpoint', variant: 'destructive' });
    } finally {
      setAddingEndpoint(false);
    }
  }

  async function validateEndpoint(endpointId: string) {
    try {
      const res = await fetch(`/api/atlas/endpoints/${endpointId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: session.wallet }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: 'Endpoint validated' });
        fetchEndpoints();
      } else {
        toast({ title: data.error || 'Validation failed', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Failed to validate endpoint:', err);
      toast({ title: 'Validation failed', variant: 'destructive' });
    }
  }

  async function deleteEndpoint(endpointId: string) {
    try {
      const res = await fetch(`/api/atlas/endpoints/${endpointId}?wallet=${session.wallet}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: 'Endpoint removed' });
        setEndpoints(prev => prev.filter(e => e.id !== endpointId));
      } else {
        toast({ title: data.error || 'Failed to delete endpoint', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Failed to delete endpoint:', err);
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  }

  async function updateSettings(updates: Partial<PrivacySettings>) {
    setSavingSettings(true);
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    
    try {
      const res = await fetch('/api/atlas/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: session.wallet,
          ...newSettings,
        }),
      });
      
      const data = await res.json();
      if (data.ok) {
        toast({ title: 'Settings saved' });
      } else {
        toast({ title: 'Failed to save', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  }

  async function registerCurrentDevice() {
    try {
      const { generateDeviceKeyPair, generateDeviceId } = await import('@/lib/atlasCrypto');
      const deviceId = generateDeviceId();
      const keyPair = await generateDeviceKeyPair();
      
      const res = await fetch('/api/atlas/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: session.wallet,
          deviceId,
          deviceType: 'browser',
          publicKey: JSON.stringify(keyPair.publicKey),
          fingerprint: keyPair.fingerprint,
          capabilities: ['display.banner', 'messages.read'],
          label: 'Web Browser',
        }),
      });
      
      const data = await res.json();
      if (data.ok) {
        toast({ title: 'Device registered' });
        fetchDevices();
      } else {
        toast({ title: data.error || 'Registration failed', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Device registration failed:', err);
      toast({ title: 'Registration failed', variant: 'destructive' });
    }
  }

  async function revokeDevice(deviceId: string) {
    try {
      const res = await fetch(`/api/atlas/devices/${deviceId}?wallet=${session.wallet}`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      if (data.ok) {
        toast({ title: 'Device revoked' });
        setDevices(prev => prev.filter(d => d.deviceId !== deviceId));
      }
    } catch (err) {
      console.error('Failed to revoke device:', err);
      toast({ title: 'Failed to revoke', variant: 'destructive' });
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(session.wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Address copied' });
    } catch (err) {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const { disconnectBridge } = await import('@/lib/sessionBridgeV2');
      await disconnectBridge();
      localStorage.removeItem('walletAddress');
      localStorage.removeItem('p3.bridge.session');
      localStorage.removeItem('token');
      localStorage.removeItem('atlas_session_token');
      
      setWallet(null);
      
      toast({ 
        title: 'Wallet Disconnected',
        description: 'Your wallet has been safely unplugged from Atlas.',
      });
      onSessionChange();
    } catch (err) {
      console.error('Disconnect failed:', err);
      toast({ title: 'Disconnect failed', variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  }

  function openInNewWindow() {
    console.log('[Settings] openInNewWindow triggered');
    const width = 420;
    const height = 700;
    const left = window.screen.width - width - 20;
    const top = 100;
    
    console.log('[Settings] Attempting window.open with:', {
      url: '/atlas',
      name: 'P3Atlas',
      features: `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    });
    
    const newWindow = window.open(
      '/atlas',
      'P3Atlas',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    
    if (newWindow) {
      console.log('[Settings] window.open SUCCESS - popup opened');
      toast({ title: 'Atlas opened in new window' });
    } else {
      console.log('[Settings] window.open FAILED - popup blocked or not supported');
      toast({ 
        title: 'Popup blocked', 
        description: 'Please allow popups for this site',
        variant: 'destructive' 
      });
    }
  }

  const expiresIn = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 60000));
  const currentSectionMeta = SECTIONS.find(s => s.id === activeSection);

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'wallet':
        return (
          <div className="space-y-4">
            <div className="glass-panel rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-400">Connected Wallet</p>
                  <p className="text-white font-mono truncate">{truncateAddress(session.wallet)}</p>
                </div>
                <Button
                  data-testid="button-copy-address"
                  variant="ghost"
                  size="icon"
                  onClick={copyAddress}
                  className="text-slate-400 hover:text-white hover:bg-white/10 flex-shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {session.roles.map(role => (
                  <Badge 
                    key={role}
                    className={`${
                      role === 'admin' 
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : role === 'moderator'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    }`}
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    {role}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3">Session Grants</h3>
              <div className="flex flex-wrap gap-2">
                {session.grants.map(grant => (
                  <Badge 
                    key={grant}
                    variant="outline"
                    className="text-xs border-purple-500/30 text-purple-300"
                  >
                    {grant}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Session expires in {expiresIn} minutes
              </p>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Button
                  data-testid="button-popout"
                  variant="outline"
                  onClick={openInNewWindow}
                  className="w-full justify-start border-white/10 text-slate-300 hover:bg-white/10"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in New Window
                </Button>
                <Button
                  data-testid="button-refresh-session"
                  variant="outline"
                  onClick={onSessionChange}
                  className="w-full justify-start border-white/10 text-slate-300 hover:bg-white/10"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Session
                </Button>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4 border-red-500/20">
              <h3 className="text-sm font-medium text-red-400 mb-3">Danger Zone</h3>
              <Button
                data-testid="button-disconnect"
                variant="outline"
                onClick={disconnect}
                disabled={disconnecting}
                className="w-full justify-start border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4 mr-2" />
                )}
                Disconnect Wallet
              </Button>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-4">
            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-purple-400" />
                Privacy & Announcements
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {settings.proximitySurfacingEnabled ? (
                      <Bell className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <BellOff className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-white">Proximity Surfacing</p>
                      <p className="text-xs text-slate-500 truncate">Announce when devices are nearby</p>
                    </div>
                  </div>
                  <Switch
                    data-testid="switch-proximity"
                    checked={settings.proximitySurfacingEnabled}
                    onCheckedChange={(checked) => updateSettings({ proximitySurfacingEnabled: checked })}
                    disabled={savingSettings}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {settings.voiceAnnounce ? (
                      <Volume2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-white">Voice Announcements</p>
                      <p className="text-xs text-slate-500 truncate">Speak updates on Echo devices</p>
                    </div>
                  </div>
                  <Switch
                    data-testid="switch-voice"
                    checked={settings.voiceAnnounce}
                    onCheckedChange={(checked) => updateSettings({ voiceAnnounce: checked })}
                    disabled={savingSettings}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Moon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-white">Content Minimization</p>
                      <p className="text-xs text-slate-500 truncate">Show counts only, hide names</p>
                    </div>
                  </div>
                  <Switch
                    data-testid="switch-minimization"
                    checked={settings.contentMinimization}
                    onCheckedChange={(checked) => updateSettings({ contentMinimization: checked })}
                    disabled={savingSettings}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-4">
            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-purple-400" />
                Push Notifications
              </h3>
              
              {notificationPermission === 'unsupported' ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-red-300">Not Supported</p>
                    <p className="text-xs text-slate-400">Your browser doesn't support push notifications</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 mb-4">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      notificationPermission === 'granted' ? 'bg-emerald-400' :
                      notificationPermission === 'denied' ? 'bg-red-400' : 'bg-yellow-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">Permission Status</p>
                      <p className="text-xs text-slate-500 capitalize">{notificationPermission}</p>
                    </div>
                    {notificationPermission === 'denied' && (
                      <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">
                        Blocked
                      </Badge>
                    )}
                  </div>
                  
                  {notificationPermission === 'denied' ? (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-sm text-yellow-300">Notifications Blocked</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Please enable notifications in your browser settings to receive updates.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {notificationPrefs.enabled ? (
                            <Bell className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <BellOff className="w-5 h-5 text-slate-500 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm text-white font-medium">Enable Notifications</p>
                            <p className="text-xs text-slate-400 truncate">Receive push notifications from Atlas</p>
                          </div>
                        </div>
                        <Switch
                          data-testid="switch-notifications-master"
                          checked={notificationPrefs.enabled}
                          onCheckedChange={handleMasterToggle}
                          disabled={subscribing}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {notificationPermission !== 'unsupported' && notificationPermission !== 'denied' && (
              <div className="glass-panel rounded-xl p-4">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  Notification Topics
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <MessageSquare className={`w-4 h-4 flex-shrink-0 ${notificationPrefs.messages ? 'text-purple-400' : 'text-slate-500'}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-white">Messages</p>
                        <p className="text-xs text-slate-500 truncate">New messages and conversations</p>
                      </div>
                    </div>
                    <Switch
                      data-testid="switch-notifications-messages"
                      checked={notificationPrefs.messages}
                      onCheckedChange={(checked) => handleTopicToggle('messages', checked)}
                      disabled={!notificationPrefs.enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Globe className={`w-4 h-4 flex-shrink-0 ${notificationPrefs.news ? 'text-purple-400' : 'text-slate-500'}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-white">News</p>
                        <p className="text-xs text-slate-500 truncate">News updates and announcements</p>
                      </div>
                    </div>
                    <Switch
                      data-testid="switch-notifications-news"
                      checked={notificationPrefs.news}
                      onCheckedChange={(checked) => handleTopicToggle('news', checked)}
                      disabled={!notificationPrefs.enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Sparkles className={`w-4 h-4 flex-shrink-0 ${notificationPrefs.wikipedia ? 'text-purple-400' : 'text-slate-500'}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-white">Random Wikipedia</p>
                        <p className="text-xs text-slate-500 truncate">Daily random knowledge snippets</p>
                      </div>
                    </div>
                    <Switch
                      data-testid="switch-notifications-wikipedia"
                      checked={notificationPrefs.wikipedia}
                      onCheckedChange={(checked) => handleTopicToggle('wikipedia', checked)}
                      disabled={!notificationPrefs.enabled}
                    />
                  </div>
                </div>
              </div>
            )}

            {notificationPrefs.enabled && (
              <div className="glass-panel rounded-xl p-4">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  Test Notifications
                </h3>
                
                <Button
                  data-testid="button-test-notification"
                  onClick={sendTestNotification}
                  disabled={testingNotification}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {testingNotification ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Send Test Notification
                    </>
                  )}
                </Button>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  This will send a test notification to verify your setup
                </p>
              </div>
            )}

            <div className="glass-panel rounded-xl p-4 border-purple-500/20">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-medium">Privacy Note</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Notification subscriptions are stored securely and linked to your wallet. You can unsubscribe at any time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'visualization':
        return (
          <div className="space-y-4">
            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-400" />
                Atlas Face Preview
              </h3>
              <div 
                className="relative rounded-xl overflow-hidden bg-black/40 border border-white/5"
                onMouseEnter={() => setVizPreviewState(s => ({ ...s, listening: true, idle: false }))}
                onMouseLeave={() => setVizPreviewState(DEFAULT_ATLAS_STATE)}
              >
                <AtlasFace settings={vizSettings} state={vizPreviewState} />
                <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-slate-500">
                  Hover to preview listening state
                </p>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-purple-400" />
                Face Theme
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {THEME_OPTIONS.map(theme => {
                  const Icon = theme.icon;
                  const isActive = vizSettings.theme === theme.value;
                  return (
                    <button
                      key={theme.value}
                      data-testid={`theme-${theme.value}`}
                      onClick={() => {
                        setThemeMutation.mutate(theme.value);
                        toast({ title: `Theme: ${theme.label}` });
                      }}
                      disabled={setThemeMutation.isPending}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                        isActive
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{theme.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-400" />
                Color Theme
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                {COLOR_PRESETS.map(preset => {
                  const isActive = vizSettings.colorPrimary === preset.primary;
                  return (
                    <button
                      key={preset.name}
                      data-testid={`color-${preset.name.toLowerCase()}`}
                      onClick={() => {
                        setColorMutation.mutate({ colorPrimary: preset.primary, colorAccent: preset.accent });
                        toast({ title: `Color: ${preset.name}` });
                      }}
                      disabled={setColorMutation.isPending}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                        isActive
                          ? 'border-white/50'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }}
                      />
                      <span className="text-xs text-slate-400">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Effects
              </h3>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">Glow Intensity</span>
                    <span className="text-xs text-slate-500">{Math.round(vizSettings.glowIntensity * 100)}%</span>
                  </div>
                  <Slider
                    data-testid="slider-glow"
                    value={[vizSettings.glowIntensity]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueCommit={(vals: number[]) => {
                      updateVizMutation.mutate({ glowIntensity: vals[0] });
                    }}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">Motion Level</span>
                    <span className="text-xs text-slate-500">{Math.round(vizSettings.motionLevel * 100)}%</span>
                  </div>
                  <Slider
                    data-testid="slider-motion"
                    value={[vizSettings.motionLevel]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueCommit={(vals: number[]) => {
                      updateVizMutation.mutate({ motionLevel: vals[0] });
                    }}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mic className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm text-white">Listening Reactive</p>
                      <p className="text-xs text-slate-500">Glow when listening</p>
                    </div>
                  </div>
                  <Switch
                    data-testid="switch-listening-reactive"
                    checked={vizSettings.listeningReactive}
                    onCheckedChange={(checked) => {
                      updateVizMutation.mutate({ listeningReactive: checked });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm text-white">Speaking Reactive</p>
                      <p className="text-xs text-slate-500">Animate when speaking</p>
                    </div>
                  </div>
                  <Switch
                    data-testid="switch-speaking-reactive"
                    checked={vizSettings.speakingReactive}
                    onCheckedChange={(checked) => {
                      updateVizMutation.mutate({ speakingReactive: checked });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'node':
        return (
          <div className="space-y-4">
            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Node Mode
              </h3>
              
              <p className="text-xs text-slate-400 mb-4">
                Node Mode lets your device participate in the P3 mesh network, contributing to validation, relay, and caching tasks. It's enabled by default to help Atlas monitor and stabilize your connection.
              </p>

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white">Enable Node Mode</p>
                    <p className="text-xs text-slate-500">Participate in mesh network</p>
                  </div>
                </div>
                <Switch
                  data-testid="switch-node-mode"
                  checked={nodeMode.enabled}
                  onCheckedChange={(checked) => {
                    setNodeModeEnabled(checked);
                    toast({
                      title: checked ? 'Node Mode enabled' : 'Node Mode disabled',
                      description: checked 
                        ? 'You are now contributing to the P3 mesh network.'
                        : 'You have opted out of mesh participation.',
                    });
                  }}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Connection Status</span>
                  <span className={`flex items-center gap-1 ${nodeDiagnostics.status === 'connected' ? 'text-cyan-400' : 'text-amber-400'}`}>
                    {nodeDiagnostics.status === 'connected' ? (
                      <><CheckCircle2 className="w-3 h-3" /> Connected</>
                    ) : (
                      <><AlertCircle className="w-3 h-3" /> {nodeDiagnostics.status}</>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Signal Strength</span>
                  <span className="text-white">{nodeDiagnostics.signalStrength}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Peers Connected</span>
                  <span className="text-white">{nodeDiagnostics.peersConnected}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Tasks Completed</span>
                  <span className="text-white">{nodeDiagnostics.tasksCompleted}</span>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                Contribution Metrics
              </h3>
              
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">Bandwidth Saved</span>
                    <span className="text-cyan-400">{Math.min(100, Math.round(nodeDiagnostics.bandwidthSaved / 10))}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round(nodeDiagnostics.bandwidthSaved / 10))}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">Contribution Level</span>
                    <span className="text-purple-400">{nodeDiagnostics.contributionLevel}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500" style={{ width: `${nodeDiagnostics.contributionLevel}%` }} />
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-3">
                Your device is actively helping validate content and relay messages across the mesh.
              </p>
            </div>

            <div className="glass-panel rounded-xl p-4 border-purple-500/20">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" />
                Global Relay Network
              </h3>
              
              <p className="text-xs text-slate-400 mb-4">
                Join the global P3 mesh network to relay across all P3-based apps. Your node will connect with nodes from other apps using the protocol, creating a unified decentralized network.
              </p>

              <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg mb-4 border border-purple-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white">Global Relay</p>
                    <p className="text-xs text-slate-500">Cross-app mesh participation</p>
                  </div>
                </div>
                <Switch
                  data-testid="switch-global-relay"
                  checked={nodeMode.globalRelayEnabled}
                  disabled={!nodeMode.enabled}
                  onCheckedChange={async (checked) => {
                    try {
                      const { setGlobalRelayEnabled: setMeshGlobalRelay } = await import('@/lib/meshClient');
                      const { signMessage, getWCSession } = await import('@/lib/walletConnect');
                      
                      let signFn: ((msg: string) => Promise<string>) | undefined;
                      const wcSession = getWCSession();
                      
                      if (checked && wcSession?.connected) {
                        signFn = async (msg: string) => {
                          const sig = await signMessage(msg);
                          if (!sig) throw new Error('User rejected signature');
                          return sig;
                        };
                      } else if (checked && !wcSession?.connected) {
                        toast({
                          title: 'Wallet Required',
                          description: 'Connect your wallet to join the global relay network.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      
                      const result = await setMeshGlobalRelay(checked, signFn, wcSession?.address);
                      if (result.success) {
                        setGlobalRelayEnabled(checked, result.nodeId || null);
                        toast({
                          title: checked ? 'Global Relay enabled' : 'Global Relay disabled',
                          description: checked 
                            ? 'You are now part of the global P3 mesh network.'
                            : 'You have left the global mesh network.',
                        });
                      } else {
                        toast({
                          title: 'Failed to toggle Global Relay',
                          description: result.error || 'Please try again.',
                          variant: 'destructive',
                        });
                      }
                    } catch (err) {
                      console.error('Failed to toggle global relay:', err);
                      toast({
                        title: 'Error',
                        description: 'Failed to toggle Global Relay',
                        variant: 'destructive',
                      });
                    }
                  }}
                />
              </div>

              {nodeMode.globalRelayEnabled && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status</span>
                    <span className="text-purple-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Connected
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Foundation Lanes</span>
                    <span className="text-white">v1.0.0</span>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 mt-3">
                Foundation lanes (handshake, identity, keepalive, telemetry) work universally across all P3 apps regardless of custom lane configurations.
              </p>
            </div>
          </div>
        );

      case 'endpoints':
        return (
          <div className="space-y-4">
            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                Add New Endpoint
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Endpoint URL</label>
                  <Input
                    data-testid="input-endpoint-url"
                    type="url"
                    placeholder="https://api.example.com/metrics"
                    value={newEndpointUrl}
                    onChange={(e) => setNewEndpointUrl(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Display Name (optional)</label>
                  <Input
                    data-testid="input-endpoint-name"
                    type="text"
                    placeholder="My API Endpoint"
                    value={newEndpointName}
                    onChange={(e) => setNewEndpointName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>
                <Button
                  data-testid="button-add-endpoint"
                  onClick={addEndpoint}
                  disabled={addingEndpoint || !newEndpointUrl.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {addingEndpoint ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Endpoint
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                Your Endpoints
              </h3>
              
              {loadingEndpoints ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                </div>
              ) : endpoints.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No endpoints configured yet
                </p>
              ) : (
                <div className="space-y-3">
                  {endpoints.map(endpoint => (
                    <div 
                      key={endpoint.id}
                      data-testid={`card-endpoint-${endpoint.id}`}
                      className="rounded-lg bg-white/5 border border-white/5 overflow-hidden"
                    >
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white font-medium truncate">
                              {endpoint.displayName || endpoint.endpointUrl}
                            </p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {endpoint.endpointUrl}
                            </p>
                          </div>
                          <Badge 
                            data-testid={`badge-status-${endpoint.id}`}
                            className={`flex-shrink-0 text-xs ${
                              endpoint.status === 'validated' 
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : endpoint.status === 'failed'
                                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                            }`}
                          >
                            {endpoint.status === 'validated' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {endpoint.status === 'failed' && <AlertCircle className="w-3 h-3 mr-1" />}
                            {endpoint.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                            {endpoint.status || 'pending'}
                          </Badge>
                        </div>
                        
                        {endpoint.lastValidatedAt && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                            <Clock className="w-3 h-3" />
                            Last validated: {new Date(endpoint.lastValidatedAt).toLocaleDateString()} at {new Date(endpoint.lastValidatedAt).toLocaleTimeString()}
                          </p>
                        )}
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Button
                            data-testid={`button-validate-${endpoint.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => validateEndpoint(endpoint.id)}
                            className="w-full border-white/10 text-slate-300 hover:bg-white/10 text-xs py-2"
                          >
                            <RefreshCw className="w-3 h-3 mr-1 flex-shrink-0" />
                            <span className="truncate">Validate</span>
                          </Button>
                          <Button
                            data-testid={`button-metrics-${endpoint.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMode('pulse');
                              setPulseView('personal');
                            }}
                            disabled={endpoint.status !== 'validated'}
                            className="w-full border-white/10 text-slate-300 hover:bg-white/10 text-xs py-2 disabled:opacity-50"
                          >
                            <BarChart3 className="w-3 h-3 mr-1 flex-shrink-0" />
                            <span className="truncate">Metrics</span>
                          </Button>
                          <Button
                            data-testid={`button-delete-${endpoint.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => deleteEndpoint(endpoint.id)}
                            className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs py-2"
                          >
                            <Trash2 className="w-3 h-3 mr-1 flex-shrink-0" />
                            <span className="truncate">Delete</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-xl p-4 border-purple-500/20">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-medium">Privacy Note</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Metrics are computed locally and not exposed externally. Your endpoint data stays private and secure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'devices':
        return (
          <div className="space-y-4">
            <div className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                  Paired Devices
                </h3>
                <Button
                  data-testid="button-add-device"
                  variant="ghost"
                  size="sm"
                  onClick={registerCurrentDevice}
                  className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add This Device
                </Button>
              </div>
              
              {loadingDevices ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                </div>
              ) : devices.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No devices paired yet
                </p>
              ) : (
                <div className="space-y-2">
                  {devices.map(device => {
                    const DeviceIcon = deviceIcons[device.deviceType] || Monitor;
                    return (
                      <div 
                        key={device.deviceId}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <DeviceIcon className="w-5 h-5 text-purple-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{device.label}</p>
                            <p className="text-xs text-slate-500">{device.deviceId.slice(0, 8)}...</p>
                          </div>
                        </div>
                        <Button
                          data-testid={`button-revoke-${device.deviceId}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => revokeDevice(device.deviceId)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );

      case 'developer':
        return (
          <div className="glass-panel rounded-xl p-4">
            <DeveloperSettings />
          </div>
        );

      case 'connectors':
        return (
          <div className="glass-panel rounded-xl p-4">
            <ControlPanel />
          </div>
        );

      case 'onboarding':
        return (
          <div className="space-y-4">
            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Play className="w-4 h-4 text-purple-400" />
                Onboarding Status
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${onboardingState.completed ? 'bg-green-400' : 'bg-yellow-400'}`} />
                    <div>
                      <p className="text-sm text-white">
                        {onboardingState.completed ? 'Onboarding Completed' : 'Not Completed'}
                      </p>
                      {onboardingState.completedAt && (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(onboardingState.completedAt).toLocaleDateString()} at {new Date(onboardingState.completedAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {onboardingState.path === 'developer' ? 'Developer' : onboardingState.path === 'end_user' ? 'End User' : 'Not Set'}
                  </Badge>
                </div>

                <Button
                  data-testid="button-replay-onboarding"
                  onClick={async () => {
                    setResettingOnboarding(true);
                    try {
                      const res = await fetch('/api/atlas/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          wallet: session.wallet,
                          onboardingCompleted: false,
                          onboardingPath: null,
                          onboardingCompletedAt: null,
                        }),
                      });
                      const data = await res.json();
                      if (data.ok) {
                        setOnboardingState({
                          completed: false,
                          path: null,
                          completedAt: null,
                        });
                        resetStoreOnboarding();
                        localStorage.removeItem(`atlas.onboarding.${session.wallet}`);
                        toast({ title: 'Onboarding reset. Refresh to replay.' });
                      } else {
                        toast({ title: 'Failed to reset onboarding', variant: 'destructive' });
                      }
                    } catch (err) {
                      console.error('Failed to reset onboarding:', err);
                      toast({ title: 'Failed to reset onboarding', variant: 'destructive' });
                    } finally {
                      setResettingOnboarding(false);
                    }
                  }}
                  disabled={resettingOnboarding || !onboardingState.completed}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {resettingOnboarding ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Replay Onboarding
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-purple-400" />
                User Path
              </h3>
              
              <p className="text-xs text-slate-400 mb-4">
                Choose your experience path. This affects onboarding content and feature recommendations.
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  data-testid="button-path-end-user"
                  onClick={async () => {
                    setUpdatingOnboardingPath(true);
                    try {
                      const res = await fetch('/api/atlas/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          wallet: session.wallet,
                          onboardingPath: 'end_user',
                        }),
                      });
                      const data = await res.json();
                      if (data.ok) {
                        setOnboardingState(prev => ({ ...prev, path: 'end_user' }));
                        toast({ title: 'Path updated to End User' });
                      }
                    } catch (err) {
                      console.error('Failed to update path:', err);
                      toast({ title: 'Failed to update path', variant: 'destructive' });
                    } finally {
                      setUpdatingOnboardingPath(false);
                    }
                  }}
                  disabled={updatingOnboardingPath}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                    onboardingState.path === 'end_user'
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                >
                  <User className={`w-6 h-6 ${onboardingState.path === 'end_user' ? 'text-purple-400' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${onboardingState.path === 'end_user' ? 'text-white' : 'text-slate-300'}`}>
                    End User
                  </span>
                  <span className="text-xs text-slate-500 text-center">
                    Focus on using Atlas for daily tasks
                  </span>
                </button>

                <button
                  data-testid="button-path-developer"
                  onClick={async () => {
                    setUpdatingOnboardingPath(true);
                    try {
                      const res = await fetch('/api/atlas/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          wallet: session.wallet,
                          onboardingPath: 'developer',
                        }),
                      });
                      const data = await res.json();
                      if (data.ok) {
                        setOnboardingState(prev => ({ ...prev, path: 'developer' }));
                        toast({ title: 'Path updated to Developer' });
                      }
                    } catch (err) {
                      console.error('Failed to update path:', err);
                      toast({ title: 'Failed to update path', variant: 'destructive' });
                    } finally {
                      setUpdatingOnboardingPath(false);
                    }
                  }}
                  disabled={updatingOnboardingPath}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                    onboardingState.path === 'developer'
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                >
                  <Terminal className={`w-6 h-6 ${onboardingState.path === 'developer' ? 'text-purple-400' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${onboardingState.path === 'developer' ? 'text-white' : 'text-slate-300'}`}>
                    Developer
                  </span>
                  <span className="text-xs text-slate-500 text-center">
                    Access APIs and build integrations
                  </span>
                </button>
              </div>
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="glass-panel rounded-xl p-4">
            <AtlasArchitecture />
          </div>
        );

      default:
        return null;
    }
  };

  const renderExpandableSection = (section: typeof SECTIONS[0]) => {
    const Icon = section.icon;
    const isExpanded = activeSection === section.id;
    
    return (
      <div key={section.id} className="glass-panel rounded-xl overflow-hidden">
        <button
          onClick={() => setActiveSection(isExpanded ? (null as any) : section.id)}
          data-testid={`section-header-${section.id}`}
          className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
            isExpanded
              ? 'bg-purple-500/20 text-purple-300'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Icon className={`w-5 h-5 ${isExpanded ? 'text-purple-400' : 'text-slate-400'}`} />
          <div className="flex-1 text-left">
            <div className="text-sm font-medium">{section.label}</div>
            <div className="text-xs text-slate-500">{section.description}</div>
          </div>
          <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>
        
        {isExpanded && (
          <div className="px-4 py-3 border-t border-white/5">
            {renderSectionContent()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">{currentSectionMeta?.label || 'Settings'}</h2>
          <p className="text-xs text-slate-500">{currentSectionMeta?.description}</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <nav className="hidden md:flex flex-col w-56 border-r border-white/5 p-3 space-y-1 overflow-y-auto">
          {SECTIONS.map(section => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                data-testid={`nav-section-${section.id}`}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                  isActive
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{section.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="hidden md:block flex-1 overflow-y-auto p-4">
          {renderSectionContent()}
        </div>

        <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-2">
          {SECTIONS.map(section => renderExpandableSection(section))}
        </div>
      </div>

      <style>{`
        .glass-panel {
          background: rgba(30, 30, 30, 0.8);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}

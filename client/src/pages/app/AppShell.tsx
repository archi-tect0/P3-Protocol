import { useState, useEffect } from "react";
import { Route, Switch } from "wouter";
import EnhancedTopbar from "@/components/EnhancedTopbar";
import BottomCarouselNav from "@/components/BottomCarouselNav";
import AppSidebar from "./AppSidebar";
import AppLanding from "./AppLanding";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import Toasts from "@/components/Toasts";
import { lazy, Suspense } from "react";
import { usePWA } from "@/hooks/use-pwa";
import { startBackgroundSync, stopBackgroundSync } from "@/lib/backgroundSync";
import { BrowserHandoffButton, useAutoPopout } from "@/components/BrowserHandoffButton";
import { useSessionRestore } from "@/hooks/use-session-restore";
import { getSession, type BridgeSession } from "@/lib/sessionBridgeV2";

// SECURITY: Clear admin credentials when entering wallet app
// This is a defense-in-depth measure
function clearAdminCredentials() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUser');
  localStorage.removeItem('adminEmail');
}

const HomePage = lazy(() => import("@/pages/HomePage"));
const MessagesPage = lazy(() => import("@/pages/MessagesPage"));
const VoiceCall = lazy(() => import("@/pages/VoiceCall"));
const PaymentsPage = lazy(() => import("@/pages/PaymentsPage"));
const ExplorerPage = lazy(() => import("@/pages/ExplorerPage"));
const NotesPage = lazy(() => import("@/pages/NotesPage"));
const DirectoryPage = lazy(() => import("@/pages/DirectoryPage"));
const InboxPage = lazy(() => import("@/pages/InboxPage"));
const Receipts = lazy(() => import("@/pages/Receipts"));
const Ledger = lazy(() => import("@/pages/Ledger"));
const DAOPage = lazy(() => import("@/pages/DAOPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AtlasOnePage = lazy(() => import("@/components/atlas/modes/AtlasOneMode"));
const GameDeckPage = lazy(() => import("@/pages/game-deck"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-purple-200 dark:border-purple-800" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-purple-600 animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPWAPrompt, setShowPWAPrompt] = useState(true);
  const [session, setSession] = useState<BridgeSession | null>(null);
  
  usePWA('app');
  useAutoPopout({ isPrimaryRoute: true }); // Nexus is a primary entry point
  const { restoredWallet } = useSessionRestore();
  
  // Check for existing session on mount
  useEffect(() => {
    const existingSession = getSession();
    if (existingSession?.connected) {
      setSession(existingSession);
    } else {
      // Fallback: check localStorage for wallet address
      const walletAddress = localStorage.getItem("walletAddress");
      if (walletAddress) {
        setSession({ address: walletAddress, connected: true } as BridgeSession);
      }
    }
  }, []);

  // SECURITY: Clear any stale admin credentials when entering wallet app
  useEffect(() => {
    clearAdminCredentials();
  }, []);

  // Handle session restoration from install_token
  useEffect(() => {
    if (restoredWallet && !session) {
      console.log('[AppShell] Session restored from install_token:', restoredWallet);
      const existingSession = getSession();
      if (existingSession?.connected) {
        setSession(existingSession);
      } else {
        // Set minimal session with restored wallet
        localStorage.setItem('walletAddress', restoredWallet);
        setSession({ address: restoredWallet, connected: true } as BridgeSession);
      }
    }
  }, [restoredWallet, session]);

  // Initialize background sync for offline anchor queue
  useEffect(() => {
    startBackgroundSync(30000);
    return () => stopBackgroundSync();
  }, []);

  // If no wallet connection at all, show landing page with handoff button
  if (!session?.address) {
    return (
      <>
        <AppLanding />
        <BrowserHandoffButton />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[hsl(220,20%,7%)]">
      <EnhancedTopbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0 smooth-scroll">
          <Suspense fallback={<LoadingFallback />}>
            <Switch>
              <Route path="/app" component={HomePage} />
              <Route path="/app/messages" component={MessagesPage} />
              <Route path="/app/calls" component={VoiceCall} />
              <Route path="/app/voice" component={VoiceCall} />
              <Route path="/app/payments" component={PaymentsPage} />
              <Route path="/app/notes" component={NotesPage} />
              <Route path="/app/dao" component={DAOPage} />
              <Route path="/app/explorer" component={ExplorerPage} />
              <Route path="/app/directory" component={DirectoryPage} />
              <Route path="/app/inbox" component={InboxPage} />
              <Route path="/app/receipts" component={Receipts} />
              <Route path="/app/ledger" component={Ledger} />
              <Route path="/app/settings" component={SettingsPage} />
              <Route path="/app/atlas-one" component={AtlasOnePage} />
              <Route path="/app/game-deck" component={GameDeckPage} />
            </Switch>
          </Suspense>
        </main>
      </div>

      <BottomCarouselNav />
      
      {showPWAPrompt && (
        <PWAInstallPrompt type="app" onDismiss={() => setShowPWAPrompt(false)} />
      )}
      
      <Toasts />
      <BrowserHandoffButton />
    </div>
  );
}

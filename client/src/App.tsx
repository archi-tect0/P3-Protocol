import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/lib/theme";
import { AdminProvider } from "@/context/AdminContext";
import { Loader2 } from "lucide-react";
import Login from "@/pages/Login";
import LandingPage from "@/pages/LandingPage";

const AboutPage = lazy(() => import("@/pages/AboutPage"));
const AppShell = lazy(() => import("@/pages/app/AppShell"));

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ApacheHubPage = lazy(() => import("@/pages/ApacheHubPage"));
const ApacheBridgePage = lazy(() => import("@/pages/ApacheRepoPage"));
const SettingsPage = lazy(() => import("@/pages/admin/SettingsPage"));
const RulesPage = lazy(() => import("@/pages/admin/RulesPage"));
const PluginsPage = lazy(() => import("@/pages/admin/PluginsPage"));
const AuditPage = lazy(() => import("@/pages/admin/AuditPage"));
const HealthPage = lazy(() => import("@/pages/admin/HealthPage"));
const RBACPage = lazy(() => import("@/pages/admin/RBACPage"));
const ZKManagementPage = lazy(() => import("@/pages/admin/ZKManagementPage"));
const CrossChainPage = lazy(() => import("@/pages/admin/CrossChainPage"));
const AdminDAOPage = lazy(() => import("@/pages/admin/DAOPage"));
const EnterprisePage = lazy(() => import("@/pages/admin/EnterprisePage"));
const ApiKeysPage = lazy(() => import("@/pages/admin/ApiKeysPage"));
const BillingPage = lazy(() => import("@/pages/admin/BillingPage"));
const AlertsPage = lazy(() => import("@/pages/admin/AlertsPage"));
const SlaPage = lazy(() => import("@/pages/admin/SlaPage"));
const PrivacyPage = lazy(() => import("@/pages/admin/PrivacyPage"));

const LauncherPage = lazy(() => import("@/pages/launcher/LauncherPage"));
const HubAboutPage = lazy(() => import("@/pages/launcher/HubAboutPage"));
const WhitepaperPage = lazy(() => import("@/pages/launcher/WhitepaperPage"));
const NexusWhitepaperPage = lazy(() => import("@/pages/launcher/NexusWhitepaperPage"));
const ProtocolWhitepaperPage = lazy(() => import("@/pages/launcher/ProtocolWhitepaperPage"));
const AtlasWhitepaperPage = lazy(() => import("@/pages/launcher/AtlasWhitepaperPage"));
const AtlasOneWhitepaperPage = lazy(() => import("@/pages/launcher/AtlasOneWhitepaperPage"));
const UseCasesPage = lazy(() => import("@/pages/launcher/UseCasesPage"));
const SDKPage = lazy(() => import("@/pages/launcher/SDKPage"));
const AtlasAPI2Page = lazy(() => import("@/pages/launcher/AtlasAPI2Page"));
const AtlasAPI2WhitepaperPage = lazy(() => import("@/pages/launcher/AtlasAPI2WhitepaperPage"));
const AppStorePage = lazy(() => import("@/pages/launcher/AppStorePage"));
const MessagingMiniApp = lazy(() => import("@/pages/launcher/modules/MessagingMiniApp"));
const VideoMiniApp = lazy(() => import("@/pages/launcher/modules/VideoMiniApp"));
const DaoMiniApp = lazy(() => import("@/pages/launcher/modules/DaoMiniApp"));
const SettingsMiniApp = lazy(() => import("@/pages/launcher/modules/SettingsMiniApp"));
const AdminMiniApp = lazy(() => import("@/pages/launcher/AdminMiniApp"));
const StandaloneApp = lazy(() => import("@/pages/standalone/StandaloneApp"));
const ModeratorPanel = lazy(() => import("@/pages/mod/ModeratorPanel"));
const AtlasShell = lazy(() => import("@/pages/atlas/AtlasShell"));
const AtlasCanvas = lazy(() => import("@/pages/AtlasPage"));
const TicketPage = lazy(() => import("@/pages/TicketPage"));
const SDKDocsPage = lazy(() => import("@/pages/sdk-docs"));
const GameDeckPage = lazy(() => import("@/pages/game-deck"));
const AtlasOneLandingPage = lazy(() => import("@/pages/atlas-one"));

const SessionBridgeGuide = lazy(() => import("@/pages/docs/SessionBridgeGuide"));
const EncryptionGuide = lazy(() => import("@/pages/docs/EncryptionGuide"));
const AtlasApiGuide = lazy(() => import("@/pages/docs/AtlasApiGuide"));
const NexusGuide = lazy(() => import("@/pages/docs/NexusGuide"));
const CanvasModesGuide = lazy(() => import("@/pages/docs/CanvasModesGuide"));
const BlockchainGuide = lazy(() => import("@/pages/docs/BlockchainGuide"));
const MeshOsGuide = lazy(() => import("@/pages/docs/MeshOsGuide"));
const ApiBridgeGuide = lazy(() => import("@/pages/docs/ApiBridgeGuide"));
const InfrastructureGuide = lazy(() => import("@/pages/docs/InfrastructureGuide"));
const CrossChainGuide = lazy(() => import("@/pages/docs/CrossChainGuide"));
const P3HubGuide = lazy(() => import("@/pages/docs/P3HubGuide"));
const ApiExplorerPage = lazy(() => import("@/pages/docs/ApiExplorerPage"));

const MessagingPanel = lazy(() => import("@/pages/hub/MessagingPanel"));
const CallsPanel = lazy(() => import("@/pages/hub/CallsPanel"));
const NotesPanel = lazy(() => import("@/pages/hub/NotesPanel"));
const InboxPanel = lazy(() => import("@/pages/hub/InboxPanel"));
const DirectoryPanel = lazy(() => import("@/pages/hub/DirectoryPanel"));
const ReceiptsPanel = lazy(() => import("@/pages/hub/ReceiptsPanel"));

const EbookHome = lazy(() => import("@/pages/marketplace/ebook/Home"));
const EbookDetail = lazy(() => import("@/pages/marketplace/ebook/Detail"));
const EbookReader = lazy(() => import("@/pages/marketplace/ebook/Reader"));
const EbookAuthorPortal = lazy(() => import("@/pages/marketplace/ebook/AuthorPortal"));

const MusicHome = lazy(() => import("@/pages/marketplace/music/Home"));
const MusicTrackDetail = lazy(() => import("@/pages/marketplace/music/TrackDetail"));
const MusicPlayer = lazy(() => import("@/pages/marketplace/music/Player"));
const MusicArtistStudio = lazy(() => import("@/pages/marketplace/music/ArtistStudio"));

const VideoHome = lazy(() => import("@/pages/marketplace/video/Home"));
const VideoDetail = lazy(() => import("@/pages/marketplace/video/Detail"));
const VideoPlayer = lazy(() => import("@/pages/marketplace/video/Player"));
const VideoCreatorStudio = lazy(() => import("@/pages/marketplace/video/CreatorStudio"));

const ArtGallery = lazy(() => import("@/pages/marketplace/art/Gallery"));
const ArtDetail = lazy(() => import("@/pages/marketplace/art/Detail"));
const ArtViewer = lazy(() => import("@/pages/marketplace/art/Viewer"));
const ArtistStudio = lazy(() => import("@/pages/marketplace/art/ArtistStudio"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
        <p className="text-sm text-slate-600 dark:text-slate-400">Loading...</p>
      </div>
    </div>
  );
}


function ProtectedAppRoute() {
  // CRITICAL: Sync walletAddress from session if missing (before any render)
  const walletAddress = localStorage.getItem('walletAddress');
  const bridgeSession = localStorage.getItem('p3.bridge.session');
  
  if (!walletAddress && bridgeSession) {
    try {
      const session = JSON.parse(bridgeSession);
      if (session.address) {
        localStorage.setItem('walletAddress', session.address);
      }
    } catch (e) {
      // Silent fail for session parsing
    }
  }
  
  // Clear admin credentials when entering wallet app
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUser');
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AppShell />
    </Suspense>
  );
}

// Redirect /dashboard based on auth context
function DashboardRedirect() {
  const [, setLocation] = useLocation();
  const walletAddress = localStorage.getItem("walletAddress");
  const adminToken = localStorage.getItem("adminToken");
  const walletAdminToken = localStorage.getItem("p3_admin_token");
  
  const hasAdminAccess = adminToken || (walletAddress && walletAdminToken);
  
  useEffect(() => {
    if (hasAdminAccess) {
      setLocation("/admin/dashboard");
    } else if (walletAddress) {
      setLocation("/app");
    } else {
      setLocation("/login");
    }
  }, [hasAdminAccess, walletAddress, setLocation]);
  
  return <LoadingFallback />;
}

function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8 max-w-md">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold mb-2 text-foreground">Access Denied</h1>
        <p className="text-muted-foreground mb-6">
          This area is restricted to authorized administrators only.
        </p>
        <a
          href="/atlas"
          className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          data-testid="link-go-to-atlas"
        >
          Go to Atlas
        </a>
      </div>
    </div>
  );
}

function ProtectedAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const [authState, setAuthState] = useState<'checking' | 'authorized' | 'denied'>('checking');
  const adminToken = localStorage.getItem("adminToken");
  const walletAdminToken = localStorage.getItem("p3_admin_token");
  const walletAddress = localStorage.getItem("walletAddress");
  
  const hasLocalAdminAccess = adminToken || (walletAddress && walletAdminToken);
  
  useEffect(() => {
    async function verifyAdminAccess() {
      if (!hasLocalAdminAccess) {
        setAuthState('denied');
        return;
      }
      
      try {
        const res = await fetch('/api/admin/profile', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${adminToken || walletAdminToken}`
          }
        });
        
        if (res.ok) {
          setAuthState('authorized');
        } else {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('p3_admin_token');
          setAuthState('denied');
        }
      } catch {
        setAuthState('denied');
      }
    }
    
    verifyAdminAccess();
  }, [hasLocalAdminAccess, adminToken, walletAdminToken]);
  
  if (authState === 'checking') {
    return <LoadingFallback />;
  }
  
  if (authState === 'denied') {
    return <AccessDeniedPage />;
  }
  
  return (
    <AdminProvider>
      <Component />
    </AdminProvider>
  );
}

function AppContent() {
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Switch>
        {/* Landing page - marketing/intro page */}
        <Route path="/" component={LandingPage} />
        {/* Atlas Shell available at /atlas */}
        <Route path="/about" component={() => <Suspense fallback={<LoadingFallback />}><AboutPage /></Suspense>} />
        <Route path="/login" component={Login} />
        <Route path="/test" component={() => <div className="p-8 text-2xl text-green-600">✓ Routing works!</div>} />
        
        <Route path="/apache" component={() => <Suspense fallback={<LoadingFallback />}><ApacheHubPage /></Suspense>} />
        <Route path="/apache/bridge" component={() => <Suspense fallback={<LoadingFallback />}><ApacheBridgePage /></Suspense>} />
        
        {/* SECURITY: /dashboard redirects based on auth context */}
        <Route path="/dashboard" component={DashboardRedirect} />
        
        <Route path="/app" component={ProtectedAppRoute} />
        <Route path="/app/:rest*" component={ProtectedAppRoute} />
        
        <Route path="/launcher" component={() => <Suspense fallback={<LoadingFallback />}><LauncherPage /></Suspense>} />
        <Route path="/launcher/about" component={() => <Suspense fallback={<LoadingFallback />}><HubAboutPage /></Suspense>} />
        <Route path="/launcher/whitepaper" component={() => <Suspense fallback={<LoadingFallback />}><WhitepaperPage /></Suspense>} />
        <Route path="/launcher/nexus-whitepaper" component={() => <Suspense fallback={<LoadingFallback />}><NexusWhitepaperPage /></Suspense>} />
        <Route path="/launcher/protocol-whitepaper" component={() => <Suspense fallback={<LoadingFallback />}><ProtocolWhitepaperPage /></Suspense>} />
        <Route path="/launcher/atlas-whitepaper" component={() => <Suspense fallback={<LoadingFallback />}><AtlasWhitepaperPage /></Suspense>} />
        <Route path="/launcher/atlas-one-whitepaper" component={() => <Suspense fallback={<LoadingFallback />}><AtlasOneWhitepaperPage /></Suspense>} />
        <Route path="/launcher/usecases" component={() => <Suspense fallback={<LoadingFallback />}><UseCasesPage /></Suspense>} />
        <Route path="/launcher/sdk" component={() => <Suspense fallback={<LoadingFallback />}><SDKPage /></Suspense>} />
        <Route path="/launcher/appstore" component={() => <Suspense fallback={<LoadingFallback />}><AppStorePage /></Suspense>} />
        <Route path="/launcher/messaging" component={() => <Suspense fallback={<LoadingFallback />}><MessagingMiniApp /></Suspense>} />
        <Route path="/launcher/video" component={() => <Suspense fallback={<LoadingFallback />}><VideoMiniApp /></Suspense>} />
        <Route path="/launcher/dao" component={() => <Suspense fallback={<LoadingFallback />}><DaoMiniApp /></Suspense>} />
        <Route path="/launcher/settings" component={() => <Suspense fallback={<LoadingFallback />}><SettingsMiniApp /></Suspense>} />
        <Route path="/launcher/admin" component={() => <Suspense fallback={<LoadingFallback />}><AdminMiniApp /></Suspense>} />
        
        {/* Hub Panels - Core Mini-Apps */}
        <Route path="/hub/messaging" component={() => <Suspense fallback={<LoadingFallback />}><MessagingPanel /></Suspense>} />
        <Route path="/hub/calls" component={() => <Suspense fallback={<LoadingFallback />}><CallsPanel /></Suspense>} />
        <Route path="/hub/notes" component={() => <Suspense fallback={<LoadingFallback />}><NotesPanel /></Suspense>} />
        <Route path="/hub/inbox" component={() => <Suspense fallback={<LoadingFallback />}><InboxPanel /></Suspense>} />
        <Route path="/hub/directory" component={() => <Suspense fallback={<LoadingFallback />}><DirectoryPanel /></Suspense>} />
        <Route path="/hub/receipts" component={() => <Suspense fallback={<LoadingFallback />}><ReceiptsPanel /></Suspense>} />
        
        {/* Moderator Panel */}
        <Route path="/mod" component={() => <Suspense fallback={<LoadingFallback />}><ModeratorPanel /></Suspense>} />
        
        {/* Atlas - Conversational Agent */}
        <Route path="/atlas" component={() => <Suspense fallback={<LoadingFallback />}><AtlasShell /></Suspense>} />
        <Route path="/atlas/canvas" component={() => <Suspense fallback={<LoadingFallback />}><AtlasCanvas /></Suspense>} />
        
        {/* Ticket Gate */}
        <Route path="/ticket" component={() => <Suspense fallback={<LoadingFallback />}><TicketPage /></Suspense>} />
        
        {/* SDK Documentation */}
        <Route path="/sdk" component={() => <Suspense fallback={<LoadingFallback />}><SDKDocsPage /></Suspense>} />
        
        {/* Atlas API 2.0 Protocol */}
        <Route path="/protocol" component={() => <Suspense fallback={<LoadingFallback />}><AtlasAPI2Page /></Suspense>} />
        <Route path="/protocol/whitepaper" component={() => <Suspense fallback={<LoadingFallback />}><AtlasAPI2WhitepaperPage /></Suspense>} />
        
        {/* Game Deck */}
        <Route path="/game-deck" component={() => <Suspense fallback={<LoadingFallback />}><GameDeckPage /></Suspense>} />
        
        {/* Atlas One Landing */}
        <Route path="/atlas-one" component={() => <Suspense fallback={<LoadingFallback />}><AtlasOneLandingPage /></Suspense>} />
        
        {/* Implementation Guide Docs */}
        <Route path="/docs/session-bridge" component={() => <Suspense fallback={<LoadingFallback />}><SessionBridgeGuide /></Suspense>} />
        <Route path="/docs/encryption" component={() => <Suspense fallback={<LoadingFallback />}><EncryptionGuide /></Suspense>} />
        <Route path="/docs/atlas-api" component={() => <Suspense fallback={<LoadingFallback />}><AtlasApiGuide /></Suspense>} />
        <Route path="/docs/nexus" component={() => <Suspense fallback={<LoadingFallback />}><NexusGuide /></Suspense>} />
        <Route path="/docs/canvas-modes" component={() => <Suspense fallback={<LoadingFallback />}><CanvasModesGuide /></Suspense>} />
        <Route path="/docs/blockchain" component={() => <Suspense fallback={<LoadingFallback />}><BlockchainGuide /></Suspense>} />
        <Route path="/docs/mesh-os" component={() => <Suspense fallback={<LoadingFallback />}><MeshOsGuide /></Suspense>} />
        <Route path="/docs/api-bridge" component={() => <Suspense fallback={<LoadingFallback />}><ApiBridgeGuide /></Suspense>} />
        <Route path="/docs/infrastructure" component={() => <Suspense fallback={<LoadingFallback />}><InfrastructureGuide /></Suspense>} />
        <Route path="/docs/cross-chain" component={() => <Suspense fallback={<LoadingFallback />}><CrossChainGuide /></Suspense>} />
        <Route path="/docs/p3-hub" component={() => <Suspense fallback={<LoadingFallback />}><P3HubGuide /></Suspense>} />
        <Route path="/docs/api" component={() => <Suspense fallback={<LoadingFallback />}><ApiExplorerPage /></Suspense>} />
        
        {/* Ebook Marketplace Routes */}
        <Route path="/marketplace/ebook" component={() => <Suspense fallback={<LoadingFallback />}><EbookHome /></Suspense>} />
        <Route path="/marketplace/ebook/author" component={() => <Suspense fallback={<LoadingFallback />}><EbookAuthorPortal /></Suspense>} />
        <Route path="/marketplace/ebook/read/:id" component={() => <Suspense fallback={<LoadingFallback />}><EbookReader /></Suspense>} />
        <Route path="/marketplace/ebook/:id" component={() => <Suspense fallback={<LoadingFallback />}><EbookDetail /></Suspense>} />
        
        {/* Music Marketplace Routes */}
        <Route path="/marketplace/music" component={() => <Suspense fallback={<LoadingFallback />}><MusicHome /></Suspense>} />
        <Route path="/marketplace/music/studio" component={() => <Suspense fallback={<LoadingFallback />}><MusicArtistStudio /></Suspense>} />
        <Route path="/marketplace/music/player/:id" component={() => <Suspense fallback={<LoadingFallback />}><MusicPlayer /></Suspense>} />
        <Route path="/marketplace/music/:id" component={() => <Suspense fallback={<LoadingFallback />}><MusicTrackDetail /></Suspense>} />
        
        {/* Video Marketplace Routes */}
        <Route path="/marketplace/video" component={() => <Suspense fallback={<LoadingFallback />}><VideoHome /></Suspense>} />
        <Route path="/marketplace/video/studio" component={() => <Suspense fallback={<LoadingFallback />}><VideoCreatorStudio /></Suspense>} />
        <Route path="/marketplace/video/player/:id" component={() => <Suspense fallback={<LoadingFallback />}><VideoPlayer /></Suspense>} />
        <Route path="/marketplace/video/:id" component={() => <Suspense fallback={<LoadingFallback />}><VideoDetail /></Suspense>} />
        
        {/* Art/NFT Marketplace Routes */}
        <Route path="/marketplace/art" component={() => <Suspense fallback={<LoadingFallback />}><ArtGallery /></Suspense>} />
        <Route path="/marketplace/art/studio" component={() => <Suspense fallback={<LoadingFallback />}><ArtistStudio /></Suspense>} />
        <Route path="/marketplace/art/view/:id" component={() => <Suspense fallback={<LoadingFallback />}><ArtViewer /></Suspense>} />
        <Route path="/marketplace/art/:id" component={() => <Suspense fallback={<LoadingFallback />}><ArtDetail /></Suspense>} />
        
        {/* Standalone PWA routes for all mini-apps */}
        <Route path="/standalone/:appId" component={() => <Suspense fallback={<LoadingFallback />}><StandaloneApp /></Suspense>} />
        
        {/* Admin base route - redirect to dashboard or show access denied */}
        <Route path="/admin">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={Dashboard} />
            </Suspense>
          )}
        </Route>
        
        <Route path="/admin/dashboard">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={Dashboard} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/settings">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={SettingsPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/dao">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={AdminDAOPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/rbac">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={RBACPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/audit">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={AuditPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/health">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={HealthPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/rules">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={RulesPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/plugins">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={PluginsPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/zk">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={ZKManagementPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/crosschain">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={CrossChainPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/enterprise">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={EnterprisePage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/api-keys">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={ApiKeysPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/billing">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={BillingPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/alerts">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={AlertsPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/sla">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={SlaPage} />
            </Suspense>
          )}
        </Route>
        <Route path="/admin/privacy">
          {() => (
            <Suspense fallback={<LoadingFallback />}>
              <ProtectedAdminRoute component={PrivacyPage} />
            </Suspense>
          )}
        </Route>
      </Switch>
    </div>
  );
}

function App() {
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

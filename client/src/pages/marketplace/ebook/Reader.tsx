import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams, useSearch } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Settings,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Bookmark,
  List,
  Moon,
  Sun,
  Type,
} from 'lucide-react';
import { type License, type DownloadResult } from '@/lib/sdk/marketplace';

type ReaderTheme = 'light' | 'sepia' | 'dark';
type LicenseState = 'verifying' | 'valid' | 'invalid' | 'expired';

export default function EbookReader() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const searchParams = new URLSearchParams(useSearch());
  const licenseId = searchParams.get('license');

  const [licenseState, setLicenseState] = useState<LicenseState>('verifying');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages] = useState(100);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState<ReaderTheme>('dark');
  const [fontSize, setFontSize] = useState(16);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { data: license, isLoading: isLoadingLicense } = useQuery<License>({
    queryKey: ['/api/marketplace/gate/license', licenseId],
    enabled: !!licenseId,
  });

  const { data: content, isLoading: isLoadingContent } = useQuery<DownloadResult>({
    queryKey: ['/api/marketplace/content/download', licenseId],
    enabled: licenseState === 'valid' && !!licenseId,
  });

  useEffect(() => {
    if (!licenseId) {
      setLicenseState('invalid');
      return;
    }

    if (isLoadingLicense) {
      setLicenseState('verifying');
      return;
    }

    if (!license) {
      setLicenseState('invalid');
      return;
    }

    if (license.status === 'expired') {
      setLicenseState('expired');
      return;
    }

    if (license.status === 'revoked') {
      setLicenseState('invalid');
      return;
    }

    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      setLicenseState('expired');
      return;
    }

    setLicenseState('valid');
  }, [license, licenseId, isLoadingLicense]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((p) => p + 1);
    }
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(z - 10, 50));
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const themeStyles: Record<ReaderTheme, string> = {
    light: 'bg-white text-slate-900',
    sepia: 'bg-amber-50 text-amber-900',
    dark: 'bg-[#1a1a1a] text-slate-200',
  };

  if (licenseState === 'verifying') {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-purple-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Verifying License
          </h2>
          <p className="text-slate-400 mb-4">
            Checking your access rights on the protocol...
          </p>
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin mx-auto" />
        </Card>
      </div>
    );
  }

  if (licenseState === 'invalid') {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Invalid License
          </h2>
          <p className="text-slate-400 mb-6">
            You don't have a valid license to read this ebook. Please purchase or
            borrow it first.
          </p>
          <Button
            data-testid="button-purchase"
            onClick={() => setLocation(`/marketplace/ebook/${params.id}`)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600"
          >
            Get This Ebook
          </Button>
        </Card>
      </div>
    );
  }

  if (licenseState === 'expired') {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            License Expired
          </h2>
          <p className="text-slate-400 mb-6">
            Your borrowing period has ended. Renew your license or purchase the
            ebook to continue reading.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              data-testid="button-renew"
              onClick={() => setLocation(`/marketplace/ebook/${params.id}`)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600"
            >
              Renew License
            </Button>
            <Button
              data-testid="button-back-catalog"
              variant="outline"
              onClick={() => setLocation('/marketplace/ebook')}
              className="border-white/10 text-white hover:bg-white/5"
            >
              Back to Catalog
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#141414]' : theme === 'sepia' ? 'bg-amber-100' : 'bg-slate-100'}`}>
      <header className={`sticky top-0 z-50 border-b ${theme === 'dark' ? 'bg-[#1a1a1a]/95 border-white/5' : theme === 'sepia' ? 'bg-amber-50/95 border-amber-200' : 'bg-white/95 border-slate-200'} backdrop-blur-xl`}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              data-testid="button-back"
              variant="ghost"
              size="icon"
              onClick={() => setLocation(`/marketplace/ebook/${params.id}`)}
              className={theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-green-500/20 text-green-400 border-0"
              >
                <ShieldCheck className="w-3 h-3 mr-1" />
                Licensed
              </Badge>
              {license?.expiresAt && (
                <Badge
                  variant="secondary"
                  className="bg-amber-500/20 text-amber-400 border-0"
                >
                  Expires: {new Date(license.expiresAt).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              data-testid="button-toc"
              variant="ghost"
              size="icon"
              onClick={() => setShowToc(!showToc)}
              className={theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
            >
              <List className="w-5 h-5" />
            </Button>
            <Button
              data-testid="button-bookmark"
              variant="ghost"
              size="icon"
              className={theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
            >
              <Bookmark className="w-5 h-5" />
            </Button>
            <Button
              data-testid="button-settings"
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className={theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {showSettings && (
          <div className={`px-4 py-3 border-t ${theme === 'dark' ? 'border-white/5 bg-[#252525]/50' : theme === 'sepia' ? 'border-amber-200 bg-amber-100/50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Theme:</span>
                <div className="flex gap-1">
                  <Button
                    data-testid="button-theme-light"
                    variant={theme === 'light' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setTheme('light')}
                    className={theme !== 'light' ? 'text-slate-400' : ''}
                  >
                    <Sun className="w-4 h-4" />
                  </Button>
                  <Button
                    data-testid="button-theme-sepia"
                    variant={theme === 'sepia' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setTheme('sepia')}
                    className={theme !== 'sepia' ? 'text-amber-600' : 'bg-amber-600 text-white'}
                  >
                    Sepia
                  </Button>
                  <Button
                    data-testid="button-theme-dark"
                    variant={theme === 'dark' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                    className={theme !== 'dark' ? 'text-slate-400' : ''}
                  >
                    <Moon className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Type className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`} />
                <Button
                  data-testid="button-font-decrease"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFontSize((s) => Math.max(s - 2, 12))}
                  className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}
                >
                  A-
                </Button>
                <span className={`text-sm w-8 text-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {fontSize}
                </span>
                <Button
                  data-testid="button-font-increase"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFontSize((s) => Math.min(s + 2, 24))}
                  className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}
                >
                  A+
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  data-testid="button-zoom-out"
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  className={theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className={`text-sm w-12 text-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {zoom}%
                </span>
                <Button
                  data-testid="button-zoom-in"
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  className={theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>

              <Button
                data-testid="button-fullscreen"
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className={theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </header>

      <div className="flex">
        {showToc && (
          <aside className={`w-64 border-r ${theme === 'dark' ? 'bg-[#1a1a1a]/80 border-white/5' : theme === 'sepia' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'} p-4 h-[calc(100vh-57px)] overflow-y-auto`}>
            <h3 className={`font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Table of Contents
            </h3>
            <nav className="space-y-2">
              {[
                'Chapter 1: Introduction',
                'Chapter 2: Getting Started',
                'Chapter 3: Core Concepts',
                'Chapter 4: Advanced Topics',
                'Chapter 5: Best Practices',
                'Chapter 6: Case Studies',
                'Chapter 7: Conclusion',
              ].map((chapter, idx) => (
                <button
                  key={idx}
                  data-testid={`button-chapter-${idx + 1}`}
                  onClick={() => {
                    setCurrentPage((idx + 1) * 10);
                    setShowToc(false);
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    theme === 'dark'
                      ? 'text-slate-400 hover:text-white hover:bg-white/5'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {chapter}
                </button>
              ))}
            </nav>
          </aside>
        )}

        <main className="flex-1 p-8">
          <div
            className={`max-w-3xl mx-auto p-8 rounded-2xl shadow-xl ${themeStyles[theme]}`}
            style={{
              fontSize: `${fontSize}px`,
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
          >
            {isLoadingContent ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : (
              <div data-testid="reader-content" className="prose prose-lg max-w-none">
                <h2 className={theme === 'dark' ? 'text-white' : ''}>
                  Chapter {Math.ceil(currentPage / 10)}: Sample Content
                </h2>
                <p className="leading-relaxed">
                  This is a placeholder for ebook content. In a production
                  environment, this would render the actual epub or PDF content
                  from the encrypted IPFS source.
                </p>
                <p className="leading-relaxed">
                  The content is securely fetched using your verified license
                  token. The decryption happens client-side using the protocol's
                  envelope encryption system ({content?.envelopeMeta?.alg || 'AES-256-GCM'}).
                </p>
                <p className="leading-relaxed">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                  eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                  enim ad minim veniam, quis nostrud exercitation ullamco laboris
                  nisi ut aliquip ex ea commodo consequat.
                </p>
                <p className="leading-relaxed">
                  Duis aute irure dolor in reprehenderit in voluptate velit esse
                  cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
                  cupidatat non proident, sunt in culpa qui officia deserunt
                  mollit anim id est laborum.
                </p>
                <p className="leading-relaxed">
                  Page {currentPage} of {totalPages}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className={`fixed bottom-0 left-0 right-0 border-t ${theme === 'dark' ? 'bg-[#1a1a1a]/95 border-white/5' : theme === 'sepia' ? 'bg-amber-50/95 border-amber-200' : 'bg-white/95 border-slate-200'} backdrop-blur-xl`}>
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            data-testid="button-prev-page"
            variant="ghost"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className={theme === 'dark' ? 'text-slate-400 hover:text-white disabled:text-slate-600' : 'text-slate-600 hover:text-slate-900 disabled:text-slate-300'}
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Previous
          </Button>

          <div className="flex items-center gap-4">
            <input
              type="range"
              data-testid="input-page-slider"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => setCurrentPage(parseInt(e.target.value))}
              className="w-48 accent-purple-500"
            />
            <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {currentPage} / {totalPages}
            </span>
          </div>

          <Button
            data-testid="button-next-page"
            variant="ghost"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className={theme === 'dark' ? 'text-slate-400 hover:text-white disabled:text-slate-600' : 'text-slate-600 hover:text-slate-900 disabled:text-slate-300'}
          >
            Next
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import ePub, { Book, Rendition, NavItem } from 'epubjs';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAtlasStore } from '@/state/useAtlasStore';

interface EpubViewerProps {
  epubUrl: string;
  onTocLoaded?: (toc: { title: string; page: number; href: string }[]) => void;
  onLocationChange?: (location: { cfi: string; percentage: number; page: number }) => void;
  onReady?: () => void;
  onError?: (error: string) => void;
  navigateTo?: string;
  theme?: 'light' | 'sepia' | 'dark';
  fontSize?: number;
}

const themeStyles = {
  light: { bg: '#ffffff', text: '#1a1a1a', link: '#6366f1' },
  sepia: { bg: '#f4ecd8', text: '#5c4b37', link: '#8b5a2b' },
  dark: { bg: '#1a1a2e', text: '#e8e8e8', link: '#a78bfa' },
};

export default function EpubViewer({
  epubUrl,
  onTocLoaded,
  onLocationChange,
  onReady,
  onError,
  navigateTo,
  theme = 'dark',
  fontSize = 100,
}: EpubViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyTheme = useCallback((rendition: Rendition, theme: 'light' | 'sepia' | 'dark', fontSize: number) => {
    const styles = themeStyles[theme];
    rendition.themes.default({
      body: {
        background: `${styles.bg} !important`,
        color: `${styles.text} !important`,
        'font-size': `${fontSize}% !important`,
        'line-height': '1.6 !important',
        padding: '20px !important',
      },
      a: {
        color: `${styles.link} !important`,
      },
      'p, div, span, h1, h2, h3, h4, h5, h6': {
        color: `${styles.text} !important`,
      },
    });
  }, []);

  const loadBook = useCallback(async () => {
    if (!viewerRef.current || !epubUrl) return;

    try {
      setLoading(true);
      setError(null);

      if (renditionRef.current) {
        renditionRef.current.destroy();
      }
      if (bookRef.current) {
        bookRef.current.destroy();
      }

      // Fetch EPUB with wallet header for authentication
      const wallet = useAtlasStore.getState().wallet;
      const response = await fetch(epubUrl, {
        headers: wallet ? { 'x-wallet-address': wallet } : {},
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to load book: ${response.status}`);
      }
      
      const epubBlob = await response.arrayBuffer();
      const book = ePub(epubBlob);
      bookRef.current = book;

      await book.ready;

      const navigation = await book.loaded.navigation;
      if (onTocLoaded && navigation.toc) {
        const tocItems = navigation.toc.map((item: NavItem, index: number) => ({
          title: item.label.trim(),
          page: index + 1,
          href: item.href,
        }));
        onTocLoaded(tocItems);
      }

      const rendition = book.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
      });
      renditionRef.current = rendition;

      applyTheme(rendition, theme, fontSize);

      rendition.on('locationChanged', (location: any) => {
        if (onLocationChange && book.locations) {
          const percentage = book.locations.percentageFromCfi(location.start.cfi);
          onLocationChange({
            cfi: location.start.cfi,
            percentage: Math.round((percentage || 0) * 100),
            page: location.start.displayed?.page || 1,
          });
        }
      });

      rendition.on('keyup', (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') {
          rendition.prev();
        } else if (e.key === 'ArrowRight') {
          rendition.next();
        }
      });

      await book.locations.generate(1024);
      await rendition.display();

      setLoading(false);
      onReady?.();
    } catch (err) {
      console.error('Failed to load EPUB:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to load book';
      setError(errorMsg);
      setLoading(false);
      onError?.(errorMsg);
    }
  }, [epubUrl, theme, fontSize, onTocLoaded, onLocationChange, onReady, onError, applyTheme]);

  useEffect(() => {
    loadBook();

    return () => {
      if (renditionRef.current) {
        renditionRef.current.destroy();
      }
      if (bookRef.current) {
        bookRef.current.destroy();
      }
    };
  }, [epubUrl]);

  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current, theme, fontSize);
    }
  }, [theme, fontSize, applyTheme]);

  useEffect(() => {
    if (navigateTo && renditionRef.current) {
      renditionRef.current.display(navigateTo);
    }
  }, [navigateTo]);

  const handlePrev = () => {
    renditionRef.current?.prev();
  };

  const handleNext = () => {
    renditionRef.current?.next();
  };

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6" data-testid="epub-viewer-error">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-white/70 text-center">Unable to load book content.</p>
        <p className="text-white/50 text-sm mt-2 text-center max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col relative"
      style={{ backgroundColor: themeStyles[theme].bg }}
      data-testid="epub-viewer"
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-3" />
            <p className="text-white">Loading book...</p>
          </div>
        </div>
      )}

      <div
        ref={viewerRef}
        className="flex-1 relative"
        style={{ backgroundColor: themeStyles[theme].bg }}
      />

      {!loading && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/20 hover:bg-black/40 transition-colors z-10"
            data-testid="button-epub-prev"
          >
            <ChevronLeft className="w-6 h-6" style={{ color: themeStyles[theme].text }} />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/20 hover:bg-black/40 transition-colors z-10"
            data-testid="button-epub-next"
          >
            <ChevronRight className="w-6 h-6" style={{ color: themeStyles[theme].text }} />
          </button>
        </>
      )}
    </div>
  );
}

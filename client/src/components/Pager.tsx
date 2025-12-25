import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';

const SWIPE_THRESHOLD = 60;
const TRANSITION_DURATION = 220;
const DIRECTION_LOCK_THRESHOLD = 10;

interface PagerProps {
  children: ReactNode[];
  defaultIndex?: number;
  onPageChange?: (index: number) => void;
}

export function Pager({ children, defaultIndex = 1, onPageChange }: PagerProps) {
  const [currentIndex, setCurrentIndex] = useState(defaultIndex);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const isDragging = useRef(false);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const pageCount = children.length;

  const goToPage = useCallback((index: number) => {
    if (index < 0 || index >= pageCount || isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex(index);
    onPageChange?.(index);
    setTimeout(() => setIsAnimating(false), TRANSITION_DURATION);
  }, [pageCount, isAnimating, onPageChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isAnimating) return;
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchCurrentX.current = e.touches[0].clientX;
      isDragging.current = true;
      isHorizontalSwipe.current = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      
      if (isHorizontalSwipe.current === null) {
        const deltaX = Math.abs(currentX - touchStartX.current);
        const deltaY = Math.abs(currentY - touchStartY.current);
        
        if (deltaX > DIRECTION_LOCK_THRESHOLD || deltaY > DIRECTION_LOCK_THRESHOLD) {
          isHorizontalSwipe.current = deltaX > deltaY;
        }
      }
      
      if (isHorizontalSwipe.current === true) {
        touchCurrentX.current = currentX;
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;

      if (isHorizontalSwipe.current !== true) {
        isHorizontalSwipe.current = null;
        return;
      }

      const deltaX = touchCurrentX.current - touchStartX.current;
      
      if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
        if (deltaX > 0 && currentIndex > 0) {
          goToPage(currentIndex - 1);
        } else if (deltaX < 0 && currentIndex < pageCount - 1) {
          goToPage(currentIndex + 1);
        }
      }
      
      isHorizontalSwipe.current = null;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isAnimating, currentIndex, pageCount, goToPage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPage(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        goToPage(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, goToPage]);

  return (
    <div className="relative flex flex-col h-full">
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        data-testid="pager-container"
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
            transition: `transform ${TRANSITION_DURATION}ms ease-out`,
          }}
        >
          {children.map((child, index) => (
            <div
              key={index}
              className="w-full flex-shrink-0 h-full overflow-y-auto overscroll-contain"
              style={{
                WebkitOverflowScrolling: 'touch',
              }}
              data-testid={`pager-page-${index}`}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      <PagerDots
        count={pageCount}
        activeIndex={currentIndex}
        onDotClick={goToPage}
      />
    </div>
  );
}

interface PagerDotsProps {
  count: number;
  activeIndex: number;
  onDotClick: (index: number) => void;
}

function PagerDots({ count, activeIndex, onDotClick }: PagerDotsProps) {
  return (
    <div 
      className="flex items-center justify-center py-3"
      style={{ gap: '8px' }}
      data-testid="pager-dots"
    >
      {Array.from({ length: count }).map((_, index) => (
        <button
          key={index}
          onClick={() => onDotClick(index)}
          className="p-0 border-0 bg-transparent cursor-pointer transition-colors duration-150"
          aria-label={`Go to page ${index + 1}`}
          data-testid={`pager-dot-${index}`}
        >
          <div
            className="rounded-full transition-colors duration-150"
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: index === activeIndex ? '#ffffff' : '#666666',
            }}
          />
        </button>
      ))}
    </div>
  );
}

export default Pager;

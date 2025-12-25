import { useState, useEffect, useRef, Suspense, lazy, ComponentType } from 'react';

export function LazyTile<P>({ 
  loader, 
  fallback, 
  ...props 
}: { loader: () => Promise<{ default: ComponentType<P> }>, fallback: React.ReactNode } & P) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '100px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  
  const Component = lazy(loader);
  
  return (
    <div ref={ref}>
      {isVisible ? (
        <Suspense fallback={fallback}>
          <Component {...props as any} />
        </Suspense>
      ) : fallback}
    </div>
  );
}

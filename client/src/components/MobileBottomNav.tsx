import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { MessageSquare, FileText, Wallet, Vote, Video, Phone, Search, Settings } from "lucide-react";
import { MotionDiv } from "@/lib/motion";

const navItems = [
  { path: "/app/messages", icon: MessageSquare, label: "Messages" },
  { path: "/app/notes", icon: FileText, label: "Notes" },
  { path: "/app/payments", icon: Wallet, label: "Payments" },
  { path: "/app/dao", icon: Vote, label: "DAO" },
  { path: "/app/calls", icon: Video, label: "Video" },
  { path: "/app/voice", icon: Phone, label: "Voice" },
  { path: "/app/explorer", icon: Search, label: "Explorer" },
  { path: "/app/settings", icon: Settings, label: "Settings" },
];

export default function MobileBottomNav() {
  const [location, setLocation] = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const thumbRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const idx = navItems.findIndex(item => 
      location === item.path || (item.path === "/app/messages" && location === "/app")
    );
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [location]);

  useEffect(() => {
    if (thumbRef.current) {
      const itemWidth = 100 / navItems.length;
      thumbRef.current.style.transform = `translateX(${activeIndex * 100}%)`;
      thumbRef.current.style.width = `${itemWidth}%`;
    }
  }, [activeIndex]);

  const startInactivityTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      if (window.scrollY > 50) {
        setIsVisible(false);
      }
    }, 2000);
  }, []);

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    const scrollingDown = currentScrollY > lastScrollY.current;
    const scrollDelta = Math.abs(currentScrollY - lastScrollY.current);
    
    if (scrollDelta > 10) {
      if (scrollingDown && currentScrollY > 50) {
        setIsVisible(false);
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
      } else {
        setIsVisible(true);
        startInactivityTimer();
      }
    }
    
    lastScrollY.current = currentScrollY;
  }, [startInactivityTimer]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const handleNavClick = useCallback((path: string) => {
    setIsVisible(true);
    startInactivityTimer();
    setLocation(path);
  }, [setLocation, startInactivityTimer]);

  return (
    <MotionDiv
      initial={{ y: 0 }}
      animate={{ 
        y: isVisible ? 0 : 100,
        opacity: isVisible ? 1 : 0
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      style={{ pointerEvents: isVisible ? 'auto' : 'none' }}
    >
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        data-testid="nav-mobile-bottom"
      >
        <div className="relative grid grid-cols-8 h-16">
          {navItems.map((item, idx) => {
            const isActive = idx === activeIndex;
            const Icon = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ${
                  isActive 
                    ? "text-blue-500 dark:text-blue-400" 
                    : "text-slate-500 dark:text-slate-400"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? "scale-110" : ""}`} />
                <span className="text-[9px] font-medium">{item.label}</span>
              </button>
            );
          })}
          
          <div 
            ref={thumbRef}
            className="absolute bottom-0 h-[3px] bg-gradient-to-r from-blue-400 to-blue-600 transition-transform duration-300 ease-out"
            style={{ width: `${100 / navItems.length}%` }}
          />
        </div>
      </nav>
    </MotionDiv>
  );
}

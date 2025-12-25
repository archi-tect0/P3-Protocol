import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  MessageSquare, 
  FileText, 
  CreditCard, 
  Users, 
  Video, 
  Phone, 
  Compass, 
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const navItems = [
  { key: "messages", label: "Messages", icon: MessageSquare, href: "/app/messages" },
  { key: "notes", label: "Notes", icon: FileText, href: "/app/notes" },
  { key: "payments", label: "Payments", icon: CreditCard, href: "/app/payments" },
  { key: "dao", label: "DAO", icon: Users, href: "/app/dao" },
  { key: "video", label: "Video", icon: Video, href: "/app/calls" },
  { key: "voice", label: "Voice", icon: Phone, href: "/app/voice" },
  { key: "explorer", label: "Explorer", icon: Compass, href: "/app/explorer" },
  { key: "settings", label: "Settings", icon: Settings, href: "/app/settings" }
];

export default function BottomCarouselNav() {
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  
  const getCurrentIndex = () => {
    const idx = navItems.findIndex(item => 
      location === item.href || 
      (item.href === "/app/messages" && location === "/app")
    );
    return idx >= 0 ? idx : 0;
  };
  
  const [activeIndex, setActiveIndex] = useState(getCurrentIndex);

  useEffect(() => {
    setActiveIndex(getCurrentIndex());
  }, [location]);

  const goLeft = () => {
    const newIndex = activeIndex > 0 ? activeIndex - 1 : navItems.length - 1;
    setActiveIndex(newIndex);
    if (navigator.vibrate) navigator.vibrate(15);
    setLocation(navItems[newIndex].href);
  };

  const goRight = () => {
    const newIndex = activeIndex < navItems.length - 1 ? activeIndex + 1 : 0;
    setActiveIndex(newIndex);
    if (navigator.vibrate) navigator.vibrate(15);
    setLocation(navItems[newIndex].href);
  };

  const handleItemClick = (index: number) => {
    setActiveIndex(index);
    if (navigator.vibrate) navigator.vibrate(15);
    setLocation(navItems[index].href);
  };

  const getVisibleItems = () => {
    const items = [];
    for (let i = -1; i <= 1; i++) {
      let idx = activeIndex + i;
      if (idx < 0) idx = navItems.length + idx;
      if (idx >= navItems.length) idx = idx - navItems.length;
      items.push({ ...navItems[idx], originalIndex: idx, position: i });
    }
    return items;
  };

  const visibleItems = getVisibleItems();

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        height: 72,
        background: "linear-gradient(to top, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.95) 100%)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(148, 163, 184, 0.1)",
      }}
    >
      <div className="h-full flex items-center justify-between px-2">
        <button
          onClick={goLeft}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/50 active:bg-slate-700/50 transition-colors"
          data-testid="nav-left"
        >
          <ChevronLeft className="w-5 h-5 text-slate-400" />
        </button>

        <div className="flex-1 flex items-center justify-center gap-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isCenter = item.position === 0;
            
            return (
              <button
                key={`${item.key}-${item.position}`}
                onClick={() => handleItemClick(item.originalIndex)}
                className={`
                  flex flex-col items-center justify-center transition-all duration-200
                  ${isCenter ? "opacity-100" : "opacity-50"}
                `}
                style={{
                  width: isCenter ? 72 : 56,
                  height: 60,
                  transform: isCenter ? "scale(1)" : "scale(0.85)",
                }}
                data-testid={`nav-${item.key}`}
              >
                <div 
                  className={`
                    flex items-center justify-center rounded-xl transition-all duration-200
                    ${isCenter 
                      ? "bg-blue-500/20 shadow-lg shadow-blue-500/20" 
                      : "bg-transparent"
                    }
                  `}
                  style={{
                    width: isCenter ? 44 : 36,
                    height: isCenter ? 44 : 36,
                  }}
                >
                  <Icon 
                    size={isCenter ? 22 : 18} 
                    strokeWidth={isCenter ? 2.5 : 2}
                    className={`transition-colors duration-200 ${
                      isCenter ? "text-blue-400" : "text-slate-500"
                    }`}
                  />
                </div>
                <span 
                  className={`
                    mt-0.5 text-center transition-all duration-200
                    ${isCenter 
                      ? "text-[10px] font-semibold text-blue-400" 
                      : "text-[9px] font-medium text-slate-500"
                    }
                  `}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={goRight}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/50 active:bg-slate-700/50 transition-colors"
          data-testid="nav-right"
        >
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
        {navItems.map((_, idx) => (
          <div
            key={idx}
            className={`rounded-full transition-all duration-200 ${
              idx === activeIndex 
                ? "w-3 h-1 bg-blue-400" 
                : "w-1 h-1 bg-slate-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

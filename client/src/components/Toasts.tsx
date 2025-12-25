/**
 * Toasts - In-app notification toasts component
 * Renders floating toast notifications with auto-dismiss
 */

import { useState, useEffect } from 'react';
import { onToast, type Toast } from '@/lib/notify';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const TOAST_ICONS = {
  info: Info,
  success: CheckCircle,
  warn: AlertTriangle,
  error: AlertCircle,
};

const TOAST_COLORS = {
  info: 'bg-slate-800/90 border-slate-600/50 text-white',
  success: 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100',
  warn: 'bg-amber-900/90 border-amber-500/50 text-amber-100',
  error: 'bg-red-900/90 border-red-500/50 text-red-100',
};

const ICON_COLORS = {
  info: 'text-blue-400',
  success: 'text-emerald-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

export default function Toasts() {
  const [items, setItems] = useState<Toast[]>([]);
  
  useEffect(() => {
    const unsub = onToast((toast) => {
      setItems(list => [...list, toast]);
      
      const duration = toast.duration || 4000;
      setTimeout(() => {
        setItems(list => list.filter(i => i.id !== toast.id));
      }, duration);
    });
    
    return unsub;
  }, []);
  
  const dismiss = (id: string) => {
    setItems(list => list.filter(i => i.id !== id));
  };
  
  if (items.length === 0) return null;
  
  return (
    <div 
      className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
      data-testid="toasts-container"
    >
      {items.map((item) => {
        const Icon = TOAST_ICONS[item.level];
        return (
          <div
            key={item.id}
            data-testid={`toast-${item.id}`}
            className={`
              pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl 
              border backdrop-blur-xl shadow-lg shadow-black/20
              animate-in slide-in-from-right-5 fade-in duration-200
              ${TOAST_COLORS[item.level]}
            `}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${ICON_COLORS[item.level]}`} />
            <p className="flex-1 text-sm font-medium">{item.text}</p>
            <button
              onClick={() => dismiss(item.id)}
              className="flex-shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors"
              data-testid={`button-dismiss-toast-${item.id}`}
            >
              <X className="w-4 h-4 opacity-60" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toasts />
    </>
  );
}

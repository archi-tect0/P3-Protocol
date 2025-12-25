import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { appRegistry } from '@/pages/launcher/appRegistry';
import { DockApp } from '@/lib/hubPreferences';
import { cn } from '@/lib/utils';

interface DockAppPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (appId: string) => void;
  position: number;
  existingDockApps: DockApp[];
}

export function DockAppPicker({
  isOpen,
  onClose,
  onSelect,
  position,
  existingDockApps,
}: DockAppPickerProps) {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const existingIds = new Set(existingDockApps.map(d => d.appId));
  const filteredApps = appRegistry.filter(app => {
    if (existingIds.has(app.id)) return false;
    if (!search) return true;
    return app.name.toLowerCase().includes(search.toLowerCase()) ||
           app.category.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg max-h-[70vh] rounded-t-3xl bg-slate-900 border-t border-slate-700/50 overflow-hidden animate-slide-up">
        <div className="sticky top-0 z-10 bg-slate-900 px-4 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Add to Dock (Slot {position + 1})
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-800 transition-colors"
              data-testid="dock-picker-close"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search apps..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              data-testid="dock-picker-search"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-[50vh] p-4">
          <div className="grid grid-cols-4 gap-3">
            {filteredApps.map((app) => (
              <button
                key={app.id}
                onClick={() => {
                  onSelect(app.id);
                  onClose();
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-800/50 transition-colors"
                data-testid={`dock-picker-app-${app.id}`}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  `bg-gradient-to-br ${app.gradient}`
                )}>
                  <div className="w-6 h-6 text-white [&>svg]:w-full [&>svg]:h-full">{app.icon}</div>
                </div>
                <span className="text-xs text-slate-300 text-center line-clamp-2">
                  {app.name}
                </span>
              </button>
            ))}
          </div>

          {filteredApps.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">No apps found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DockAppPicker;

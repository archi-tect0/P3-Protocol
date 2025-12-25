import { ReactNode, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface NotionLayoutProps {
  sidebar?: ReactNode;
  editor: ReactNode;
  properties?: ReactNode;
  toolbar?: ReactNode;
  sidebarWidth?: string;
  propertiesWidth?: string;
}

export default function NotionLayout({
  sidebar,
  editor,
  properties,
  toolbar,
  sidebarWidth: _sidebarWidth = "280px",
  propertiesWidth = "320px",
}: NotionLayoutProps) {
  const [mobileView, setMobileView] = useState<'sidebar' | 'editor'>('editor');

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-purple-50/30 dark:from-slate-950 dark:to-purple-950/10 overflow-hidden max-w-full">
      {toolbar && (
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex-shrink-0 overflow-x-auto">
          <div className="min-w-max">{toolbar}</div>
        </div>
      )}
      
      {/* Mobile toggle tabs */}
      {sidebar && (
        <div className="md:hidden flex border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60">
          <button
            onClick={() => setMobileView('sidebar')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              mobileView === 'sidebar'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <ChevronLeft className="w-4 h-4 inline mr-1" />
            Quick Actions
          </button>
          <button
            onClick={() => setMobileView('editor')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              mobileView === 'editor'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Main View
            <ChevronRight className="w-4 h-4 inline ml-1" />
          </button>
        </div>
      )}
      
      <div className="flex-1 flex overflow-hidden min-w-0">
        {sidebar && (
          <aside 
            className={`border-r border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 backdrop-blur-md overflow-y-auto flex-shrink-0 ${
              mobileView === 'sidebar' ? 'w-full' : 'hidden'
            } md:block md:w-[280px]`}
          >
            {sidebar}
          </aside>
        )}
        
        <main className={`flex-1 overflow-y-auto min-w-0 ${
          sidebar ? (mobileView === 'editor' ? 'block' : 'hidden') : 'block'
        } md:block`}>
          {editor}
        </main>
        
        {properties && (
          <aside 
            className="hidden xl:block border-l border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 backdrop-blur-md overflow-y-auto flex-shrink-0"
            style={{ width: propertiesWidth }}
          >
            {properties}
          </aside>
        )}
      </div>
    </div>
  );
}

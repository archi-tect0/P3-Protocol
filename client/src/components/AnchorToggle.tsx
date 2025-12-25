import { Anchor, Check } from "lucide-react";

interface AnchorToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export default function AnchorToggle({ checked, onChange, label = "Anchor to blockchain", className = "" }: AnchorToggleProps) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer group ${className}`}>
      <div className={`
        relative w-10 h-6 rounded-full transition-colors
        ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}
      `}>
        <div className={`
          absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform flex items-center justify-center
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}>
          {checked && <Check className="w-3 h-3 text-indigo-600" />}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-sm">
        <Anchor className={`w-4 h-4 ${checked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
        <span className={`${checked ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
          {label}
        </span>
      </div>
      <input 
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
        data-testid="anchor-toggle"
      />
    </label>
  );
}

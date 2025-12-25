import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Check } from 'lucide-react';

interface InstalledToggleProps {
  onChange: (showInstalledOnly: boolean) => void;
  className?: string;
}

export function InstalledToggle({ onChange, className = '' }: InstalledToggleProps) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('p3:ui:showInstalledOnly') === 'true';
    setChecked(saved);
    onChange(saved);
  }, [onChange]);

  const toggle = () => {
    const next = !checked;
    setChecked(next);
    localStorage.setItem('p3:ui:showInstalledOnly', String(next));
    onChange(next);
  };

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
        checked 
          ? 'bg-emerald-500/20 text-emerald-400' 
          : 'bg-white/5 text-slate-400 hover:bg-white/10'
      } ${className}`}
      data-testid="toggle-installed-only"
    >
      {checked && <Check className="w-3 h-3" />}
      <span className="text-xs font-medium">
        {checked ? 'Installed' : 'Show Installed'}
      </span>
    </button>
  );
}

interface InstalledToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function InstalledToggleSwitch({ checked, onChange }: InstalledToggleSwitchProps) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-emerald-500"
        data-testid="switch-installed-only"
      />
      <span className="text-xs text-slate-400">Installed only</span>
    </div>
  );
}

import { useState } from 'react';
import { X, Lock, Eye, EyeOff, CheckCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface HubPasswordSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  hasPassword: boolean;
  onSetPassword: (password: string) => Promise<void>;
  onRemovePassword: () => void;
}

export function HubPasswordSettings({
  isOpen,
  onClose,
  hasPassword,
  onSetPassword,
  onRemovePassword,
}: HubPasswordSettingsProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSetPassword = async () => {
    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password too short',
        description: 'Password must be at least 6 characters.',
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Passwords do not match',
        description: 'Please ensure both passwords are identical.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSetPassword(password);
      setPassword('');
      setConfirmPassword('');
      toast({
        title: 'Password set',
        description: 'Your Hub unlock password has been configured.',
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePassword = () => {
    onRemovePassword();
    toast({
      title: 'Password removed',
      description: 'Hub unlock password has been cleared.',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700/50 overflow-hidden animate-slide-up">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Lock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Hub Unlock Password</h2>
              <p className="text-xs text-slate-500">Optional 2FA for your Hub</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 transition-colors"
            data-testid="password-settings-close"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {hasPassword ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Password Enabled</p>
                  <p className="text-xs text-slate-400">Your Hub is protected with an unlock password</p>
                </div>
              </div>
              
              <Button
                variant="destructive"
                onClick={handleRemovePassword}
                className="w-full"
                data-testid="button-remove-password"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Password
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Set an optional password to unlock your Hub personalization settings. 
                This adds an extra layer of security to your dock and background preferences.
              </p>
              
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (min 6 characters)"
                    className="pr-10 bg-slate-800 border-slate-700"
                    data-testid="input-hub-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="bg-slate-800 border-slate-700"
                  data-testid="input-hub-password-confirm"
                />
                
                <Button
                  onClick={handleSetPassword}
                  disabled={!password || !confirmPassword || isSubmitting}
                  className="w-full bg-purple-500 hover:bg-purple-400"
                  data-testid="button-set-hub-password"
                >
                  {isSubmitting ? 'Setting...' : 'Set Password'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HubPasswordSettings;

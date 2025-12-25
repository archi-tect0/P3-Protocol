import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Unlock, AlertCircle, Check } from 'lucide-react';

interface PinAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  hasPin: boolean;
  isLocked: boolean;
  lockoutRemaining: number;
  onSetupPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  onVerifyPin: (pin: string) => Promise<{ success: boolean; error?: string; attemptsRemaining?: number }>;
}

export function PinAuthDialog({
  open,
  onOpenChange,
  address,
  hasPin,
  isLocked,
  lockoutRemaining,
  onSetupPin,
  onVerifyPin,
}: PinAuthDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'verify' | 'setup'>(hasPin ? 'verify' : 'setup');

  useEffect(() => {
    setMode(hasPin ? 'verify' : 'setup');
    setPin('');
    setConfirmPin('');
    setError('');
  }, [hasPin, open]);

  const handleSetup = async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await onSetupPin(pin);
      if (!result.success) {
        setError(result.error || 'Failed to set PIN');
      }
    } catch (err: any) {
      setError(err?.message || 'Error setting PIN');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (pin.length < 4) {
      setError('Please enter your PIN');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await onVerifyPin(pin);
      if (!result.success) {
        const msg = result.attemptsRemaining !== undefined
          ? `${result.error || 'Invalid PIN'}. ${result.attemptsRemaining} attempts remaining.`
          : result.error || 'Invalid PIN';
        setError(msg);
        setPin('');
      }
    } catch (err: any) {
      setError(err?.message || 'Error verifying PIN');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="pin-auth-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {mode === 'setup' ? 'Set Up Secure PIN' : 'Enter Your PIN'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'setup' 
              ? 'Create a PIN to secure your wallet access. Your PIN is encrypted and never stored in plain text.'
              : `Verify your identity for wallet ${address.slice(0, 6)}...${address.slice(-4)}`
            }
          </DialogDescription>
        </DialogHeader>

        {isLocked ? (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-red-500">Account Locked</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Too many failed attempts. Please try again in {formatTime(lockoutRemaining)}.
            </p>
          </div>
        ) : mode === 'setup' ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pin">Create PIN (4+ digits)</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                data-testid="input-pin-setup"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pin">Confirm PIN</Label>
              <Input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Confirm PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                data-testid="input-pin-confirm"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1" data-testid="text-pin-error">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}
            <Button 
              onClick={handleSetup} 
              disabled={isLoading || pin.length < 4 || confirmPin.length < 4}
              className="w-full"
              data-testid="button-setup-pin"
            >
              {isLoading ? 'Setting Up...' : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Set Up PIN
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="verify-pin">Enter PIN</Label>
              <Input
                id="verify-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter your PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                autoFocus
                data-testid="input-pin-verify"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1" data-testid="text-pin-error">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}
            <Button 
              onClick={handleVerify} 
              disabled={isLoading || pin.length < 4}
              className="w-full"
              data-testid="button-verify-pin"
            >
              {isLoading ? 'Verifying...' : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Unlock
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

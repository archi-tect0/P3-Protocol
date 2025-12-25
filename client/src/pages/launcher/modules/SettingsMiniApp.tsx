import { useState, useRef } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, Shield, Key, Download, Upload, Lock, 
  Fingerprint, Eye, EyeOff, CheckCircle, AlertTriangle, Home
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cryptoService } from '@/lib/crypto';

export default function SettingsMiniApp() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [importKeyData, setImportKeyData] = useState('');
  const [showImportSection, setShowImportSection] = useState(false);
  
  const [decryptPassword, setDecryptPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hasDecryptPassword, setHasDecryptPassword] = useState(
    () => !!localStorage.getItem('p3.decryptPasswordHash')
  );
  
  const [biometricEnabled, setBiometricEnabled] = useState(
    () => localStorage.getItem('p3.biometricEnabled') === 'true'
  );
  const [biometricSupported, setBiometricSupported] = useState(false);

  useState(() => {
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then(available => setBiometricSupported(available))
        .catch(() => setBiometricSupported(false));
    }
  });

  const handleExportKeys = () => {
    try {
      const keyPair = cryptoService.exportKeyPair();
      const exportData = JSON.stringify(keyPair, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `p3-keys-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Keys exported',
        description: 'Store your backup safely - you need it to decrypt messages on other devices.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'Unable to export encryption keys.',
      });
    }
  };

  const handleImportKeys = () => {
    try {
      const keyPair = JSON.parse(importKeyData);
      if (!keyPair.publicKey || !keyPair.secretKey) {
        throw new Error('Invalid key format');
      }
      cryptoService.importKeyPair(keyPair);
      setImportKeyData('');
      setShowImportSection(false);
      toast({
        title: 'Keys imported',
        description: 'Your encryption keys have been updated.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Invalid key data',
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImportKeyData(e.target?.result as string);
        setShowImportSection(true);
      };
      reader.readAsText(file);
    }
  };

  const handleSetDecryptPassword = async () => {
    if (decryptPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password too short',
        description: 'Password must be at least 6 characters.',
      });
      return;
    }
    if (decryptPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Passwords do not match',
        description: 'Please ensure both passwords are identical.',
      });
      return;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(decryptPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    localStorage.setItem('p3.decryptPasswordHash', hashHex);
    setHasDecryptPassword(true);
    setDecryptPassword('');
    setConfirmPassword('');
    
    toast({
      title: 'Password set',
      description: 'Your decrypt password has been configured.',
    });
  };

  const handleRemoveDecryptPassword = () => {
    localStorage.removeItem('p3.decryptPasswordHash');
    setHasDecryptPassword(false);
    toast({
      title: 'Password removed',
      description: 'Decrypt password has been cleared.',
    });
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled && !biometricSupported) {
      toast({
        variant: 'destructive',
        title: 'Not supported',
        description: 'Biometric authentication is not available on this device.',
      });
      return;
    }

    if (enabled) {
      try {
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rp: { name: 'P3 Protocol', id: window.location.hostname },
            user: {
              id: new TextEncoder().encode(localStorage.getItem('walletAddress') || 'user'),
              name: localStorage.getItem('walletAddress') || 'P3 User',
              displayName: 'P3 User',
            },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 60000,
          },
        });
        
        if (credential) {
          localStorage.setItem('p3.biometricEnabled', 'true');
          localStorage.setItem('p3.biometricCredentialId', (credential as any).id);
          setBiometricEnabled(true);
          toast({
            title: 'Biometric enabled',
            description: 'You can now use biometric authentication.',
          });
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Setup failed',
          description: 'Could not enable biometric authentication.',
        });
      }
    } else {
      localStorage.removeItem('p3.biometricEnabled');
      localStorage.removeItem('p3.biometricCredentialId');
      setBiometricEnabled(false);
      toast({
        title: 'Biometric disabled',
        description: 'Biometric authentication has been turned off.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/launcher">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Security Settings</h1>
                <p className="text-xs text-slate-400">Keys, password & biometrics</p>
              </div>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-2 border-white/20 text-slate-300 hover:text-white">
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">P3 Home</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Encryption Keys</h2>
          </div>
          <p className="text-sm text-slate-400 mb-6">
            Your messages are encrypted with keys stored locally. Export them to backup or import from another device.
          </p>
          
          <div className="grid gap-3 sm:grid-cols-2">
            <Button 
              onClick={handleExportKeys}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-export-keys-hub"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Keys
            </Button>
            
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="border-white/20 text-slate-300 hover:text-white hover:bg-white/10"
              data-testid="button-import-keys-hub"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Keys
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {showImportSection && importKeyData && (
            <div className="mt-4 space-y-3">
              <Textarea
                value={importKeyData}
                onChange={(e) => setImportKeyData(e.target.value)}
                className="bg-slate-900/50 border-white/10 text-white font-mono text-xs h-32"
                placeholder="Key data..."
                data-testid="textarea-import-keys-hub"
              />
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">
                  Importing will replace your current keys. Export first if needed.
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleImportKeys}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="button-confirm-import-hub"
                >
                  Confirm Import
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setImportKeyData(''); setShowImportSection(false); }}
                  className="text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Decrypt Password</h2>
            {hasDecryptPassword && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Active
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mb-6">
            Set a password to decrypt messages and attachments. This adds an extra layer of protection.
          </p>

          {hasDecryptPassword ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-emerald-300">Password is set</p>
                  <p className="text-xs text-emerald-400/70">You'll be prompted for this password when decrypting</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleRemoveDecryptPassword}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                data-testid="button-remove-password"
              >
                Remove Password
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={decryptPassword}
                  onChange={(e) => setDecryptPassword(e.target.value)}
                  placeholder="Enter password (min 6 characters)"
                  className="bg-slate-900/50 border-white/10 text-white pr-10"
                  data-testid="input-decrypt-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="bg-slate-900/50 border-white/10 text-white"
                data-testid="input-confirm-password"
              />
              <Button
                onClick={handleSetDecryptPassword}
                disabled={!decryptPassword || !confirmPassword}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-set-password"
              >
                Set Password
              </Button>
            </div>
          )}
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Fingerprint className="w-5 h-5 text-cyan-400" />
              <div>
                <h2 className="text-lg font-semibold text-white">Biometric Authentication</h2>
                <p className="text-sm text-slate-400">
                  {biometricSupported 
                    ? 'Use fingerprint or face to unlock'
                    : 'Not available on this device'}
                </p>
              </div>
            </div>
            <Switch
              checked={biometricEnabled}
              onCheckedChange={handleBiometricToggle}
              disabled={!biometricSupported}
              data-testid="switch-biometric"
            />
          </div>
          
          {biometricEnabled && (
            <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
              <CheckCircle className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-sm font-medium text-cyan-300">Biometric active</p>
                <p className="text-xs text-cyan-400/70">Use your device biometrics for authentication</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

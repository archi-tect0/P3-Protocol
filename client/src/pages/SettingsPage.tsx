import { useState, useRef } from "react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Settings, Bell, Lock, Palette, Shield, Key, Download, Upload,
  Moon, Sun, Globe, ChevronRight, User, Fingerprint, Eye, EyeOff,
  CheckCircle, AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cryptoService } from "@/lib/crypto";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SettingSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const sections: SettingSection[] = [
  { id: "account", title: "Account", icon: User, description: "Wallet and identity settings" },
  { id: "security", title: "Security", icon: Lock, description: "Encryption keys and privacy" },
  { id: "notifications", title: "Notifications", icon: Bell, description: "Push and in-app alerts" },
  { id: "appearance", title: "Appearance", icon: Palette, description: "Theme and display options" },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState("account");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const walletAddress = localStorage.getItem("walletAddress") || "";
  
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
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  useState(() => {
    if (window.PublicKeyCredential) {
      (window.PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then((available: boolean) => setBiometricSupported(available))
        .catch(() => setBiometricSupported(false));
    }
  });

  const handleExportKeys = () => {
    try {
      const keyPair = cryptoService.exportKeyPair();
      const exportData = JSON.stringify(keyPair, null, 2);
      const blob = new Blob([exportData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `p3-keys-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Keys exported",
        description: "Store your backup safely - you'll need it to decrypt messages on other devices.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Unable to export encryption keys.",
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

  const handleRegenerateKeys = () => {
    setShowRegenerateConfirm(true);
  };

  const confirmRegenerateKeys = () => {
    try {
      cryptoService.generateNewKeyPair();
      setShowRegenerateConfirm(false);
      toast({
        title: 'Keys regenerated',
        description: 'New encryption keys have been created. Old encrypted messages cannot be decrypted.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Regeneration failed',
        description: 'Unable to generate new encryption keys.',
      });
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
              id: new TextEncoder().encode(walletAddress || 'user'),
              name: walletAddress || 'P3 User',
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

  const renderContent = () => {
    switch (activeSection) {
      case "account":
        return (
          <div className="space-y-6">
            <div className="glass-card p-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-purple-500/30">
                  {walletAddress.slice(2, 4).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Connected Wallet</p>
                  <p className="font-mono text-sm text-slate-900 dark:text-white" data-testid="text-wallet-address">
                    {walletAddress}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-600" />
                Network
              </h3>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Base Network</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Primary anchoring chain</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Connected</span>
                </div>
              </div>
            </div>
          </div>
        );

      case "security":
        return (
          <div className="space-y-6">
            <div className="glass-card p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-600" />
                Encryption Keys
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Your messages are encrypted with keys stored locally. Export them to backup or import from another device.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={handleExportKeys} data-testid="button-export-keys">
                  <Download className="w-4 h-4 mr-2" />
                  Export Keys
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-import-keys"
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
              
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  variant="outline"
                  onClick={handleRegenerateKeys}
                  className="w-full border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
                  data-testid="button-regenerate-keys"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Regenerate Keys
                </Button>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                  Creates new encryption keys. You'll lose access to old encrypted messages.
                </p>
              </div>

              {showImportSection && importKeyData && (
                <div className="mt-4 space-y-3">
                  <Textarea
                    value={importKeyData}
                    onChange={(e) => setImportKeyData(e.target.value)}
                    className="font-mono text-xs h-32"
                    placeholder="Key data..."
                    data-testid="textarea-import-keys"
                  />
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Importing will replace your current keys. Export first if needed.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleImportKeys} data-testid="button-confirm-import">
                      Confirm Import
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => { setImportKeyData(''); setShowImportSection(false); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold text-slate-900 dark:text-white">Decrypt Password</h3>
                {hasDecryptPassword && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Set a password to decrypt messages and attachments for extra protection.
              </p>

              {hasDecryptPassword ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700">
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Password is set</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">You'll be prompted when decrypting</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleRemoveDecryptPassword}
                    className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                    data-testid="button-remove-password"
                  >
                    Remove Password
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={decryptPassword}
                      onChange={(e) => setDecryptPassword(e.target.value)}
                      placeholder="Enter password (min 6 characters)"
                      className="pr-10"
                      data-testid="input-decrypt-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    data-testid="input-confirm-password"
                  />
                  <Button
                    onClick={handleSetDecryptPassword}
                    disabled={!decryptPassword || !confirmPassword}
                    data-testid="button-set-password"
                  >
                    Set Password
                  </Button>
                </div>
              )}
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-4 h-4 text-purple-600" />
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Biometric Authentication</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
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
                <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-purple-100 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700">
                  <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Biometric active</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">Use your device biometrics for authentication</p>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-card p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600" />
                Privacy
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">End-to-End Encryption</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">All messages are encrypted</p>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Always On
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Zero-PII Design</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">No personal data collected</p>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Active
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-6">
            <div className="glass-card p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-purple-600" />
                Notification Preferences
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Push Notifications</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Get alerts on your device</p>
                  </div>
                  <Switch 
                    checked={pushEnabled} 
                    onCheckedChange={setPushEnabled}
                    data-testid="switch-push-notifications"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Sound Effects</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Play sounds for new messages</p>
                  </div>
                  <Switch 
                    checked={soundEnabled} 
                    onCheckedChange={setSoundEnabled}
                    data-testid="switch-sound-effects"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "appearance":
        return (
          <div className="space-y-6">
            <div className="glass-card p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-600" />
                Theme
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => theme === "dark" && toggleTheme()}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    theme === "light" 
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" 
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                  data-testid="button-theme-light"
                >
                  <Sun className={`w-6 h-6 mx-auto mb-2 ${theme === "light" ? "text-purple-600" : "text-slate-400"}`} />
                  <p className={`text-sm font-medium ${theme === "light" ? "text-purple-700 dark:text-purple-300" : "text-slate-600 dark:text-slate-400"}`}>
                    Light
                  </p>
                </button>
                <button
                  onClick={() => theme === "light" && toggleTheme()}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    theme === "dark" 
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" 
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                  data-testid="button-theme-dark"
                >
                  <Moon className={`w-6 h-6 mx-auto mb-2 ${theme === "dark" ? "text-purple-400" : "text-slate-400"}`} />
                  <p className={`text-sm font-medium ${theme === "dark" ? "text-purple-300" : "text-slate-600 dark:text-slate-400"}`}>
                    Dark
                  </p>
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-full p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Settings className="w-5 h-5 text-white" />
            </div>
            Settings
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Manage your account, security, and preferences
          </p>
        </div>

        <div className="grid md:grid-cols-[240px_1fr] gap-6">
          <div className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
                    activeSection === section.id
                      ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                  data-testid={`settings-tab-${section.id}`}
                >
                  <Icon className="w-5 h-5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{section.title}</p>
                    <p className="text-xs opacity-70">{section.description}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${activeSection === section.id ? "opacity-100" : "opacity-0"}`} />
                </button>
              );
            })}
          </div>

          <div>{renderContent()}</div>
        </div>
      </div>

      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Regenerate Encryption Keys?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will create new encryption keys and cannot be undone. 
              You will <strong>lose access to all previously encrypted messages</strong> unless 
              you have exported your old keys. Make sure to export your current keys first 
              if you need to decrypt old messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRegenerateKeys}
              className="bg-amber-500 hover:bg-amber-600 text-white"
              data-testid="button-confirm-regenerate"
            >
              Yes, Regenerate Keys
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

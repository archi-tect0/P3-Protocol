import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  ImagePlus, 
  Lock, 
  Unlock, 
  Settings, 
  Trash2, 
  Download, 
  Eye, 
  EyeOff, 
  Loader2,
  X,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";
import P3 from "@/lib/sdk";
import {
  deriveKeyFromPassword,
  encryptFile,
  decryptToBlob,
  generateThumbnail,
  generateSalt,
  uint8ToBase64,
  base64ToUint8,
  mergeIvAndCiphertext
} from "@/lib/galleryCrypto";
import {
  saveGalleryItem,
  getGalleryItems,
  deleteGalleryItem,
  saveSettings,
  getSettings,
  type GalleryItem,
  type GallerySettings
} from "@/lib/galleryStore";
import { uploadEncryptedBlob, fetchFromIPFS } from "@/lib/ipfs";

type ViewState = 'unlock' | 'gallery' | 'settings';

interface UploadProgress {
  id: string;
  name: string;
  progress: number;
  status: 'encrypting' | 'uploading' | 'complete' | 'error';
}

export default function EncryptedGalleryTile() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [viewState, setViewState] = useState<ViewState>('unlock');
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [salt, setSalt] = useState<Uint8Array | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [settings, setSettingsState] = useState<GallerySettings | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [decryptedImageUrl, setDecryptedImageUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);

  const checkWalletSession = useCallback(async () => {
    try {
      const session = await P3.SSO.get();
      if (session.authenticated && session.wallet) {
        return session.wallet.toLowerCase();
      }
      const wallet = await P3.wallet();
      if (wallet.connected && wallet.address) {
        return wallet.address.toLowerCase();
      }
    } catch (e) {
      console.warn('Wallet session check failed:', e);
    }
    return '';
  }, []);

  const loadGalleryData = useCallback(async (owner: string) => {
    const gallerySettings = await getSettings(owner);
    setSettingsState(gallerySettings || null);
    
    const galleryItems = await getGalleryItems(owner);
    setItems(galleryItems);
    
    return gallerySettings;
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const address = await checkWalletSession();
      setWalletAddress(address);
      
      if (address) {
        const existingSettings = await loadGalleryData(address);
        
        if (existingSettings) {
          setSalt(base64ToUint8(existingSettings.saltB64));
          if (!existingSettings.requirePasswordOnOpen) {
            setViewState('gallery');
          }
        } else {
          setViewState('unlock');
        }
      }
      
      setIsLoading(false);
    };
    
    init();
  }, [checkWalletSession, loadGalleryData]);

  const handleUnlock = async () => {
    if (!password.trim()) {
      toast({
        title: "Password Required",
        description: "Please enter a password to unlock the gallery",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const address = walletAddress || await checkWalletSession();
      if (!address) {
        throw new Error('Wallet not connected');
      }
      setWalletAddress(address);

      let currentSalt = salt;
      if (!currentSalt) {
        const existingSettings = await getSettings(address);
        if (existingSettings) {
          currentSalt = base64ToUint8(existingSettings.saltB64);
          setSalt(currentSalt);
        } else {
          currentSalt = generateSalt();
          setSalt(currentSalt);
          
          const newSettings: GallerySettings = {
            owner: address,
            saltB64: uint8ToBase64(currentSalt),
            requirePasswordOnOpen: true,
            createdAt: Date.now()
          };
          await saveSettings(newSettings);
          setSettingsState(newSettings);
        }
      }

      const key = await deriveKeyFromPassword(password, currentSalt);
      setCryptoKey(key);
      
      await loadGalleryData(address);
      setViewState('gallery');
      setPassword('');
      
      toast({
        title: "Gallery Unlocked",
        description: "Your encrypted gallery is now accessible"
      });
    } catch (error) {
      console.error('Unlock error:', error);
      toast({
        title: "Unlock Failed",
        description: error instanceof Error ? error.message : "Failed to unlock gallery",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipPassword = async () => {
    setIsLoading(true);
    try {
      const address = walletAddress || await checkWalletSession();
      if (!address) {
        throw new Error('Please connect your wallet first');
      }
      setWalletAddress(address);

      const walletSalt = generateSalt();
      setSalt(walletSalt);
      
      const key = await deriveKeyFromPassword(address, walletSalt);
      setCryptoKey(key);

      const existingSettings = await getSettings(address);
      if (!existingSettings) {
        const newSettings: GallerySettings = {
          owner: address,
          saltB64: uint8ToBase64(walletSalt),
          requirePasswordOnOpen: false,
          createdAt: Date.now()
        };
        await saveSettings(newSettings);
        setSettingsState(newSettings);
      }
      
      await loadGalleryData(address);
      setViewState('gallery');
      
      toast({
        title: "Gallery Ready",
        description: "Using wallet-based encryption"
      });
    } catch (error) {
      console.error('Skip password error:', error);
      toast({
        title: "Setup Failed",
        description: error instanceof Error ? error.message : "Failed to setup gallery",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !cryptoKey) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not an image`,
          variant: "destructive"
        });
        continue;
      }

      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 50MB limit`,
          variant: "destructive"
        });
        continue;
      }

      const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setUploadProgress(prev => [...prev, {
        id: uploadId,
        name: file.name,
        progress: 0,
        status: 'encrypting'
      }]);

      try {
        setUploadProgress(prev => prev.map(p => 
          p.id === uploadId ? { ...p, progress: 10 } : p
        ));
        
        const thumbnail = await generateThumbnail(file);
        
        setUploadProgress(prev => prev.map(p => 
          p.id === uploadId ? { ...p, progress: 30 } : p
        ));
        
        const { encrypted, mimeType } = await encryptFile(file, cryptoKey);
        
        setUploadProgress(prev => prev.map(p => 
          p.id === uploadId ? { ...p, progress: 50, status: 'uploading' } : p
        ));

        let cid: string | undefined;
        let uploadedSize = file.size;
        
        try {
          const result = await uploadEncryptedBlob(encrypted.ciphertext, encrypted.iv, walletAddress);
          cid = result.cid;
          uploadedSize = result.size;
          
          setUploadProgress(prev => prev.map(p => 
            p.id === uploadId ? { ...p, progress: 80 } : p
          ));
        } catch (uploadError) {
          console.warn('IPFS upload failed, storing locally:', uploadError);
        }

        const itemId = `gallery-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const galleryItem: GalleryItem = {
          id: itemId,
          kind: file.size > 1024 * 1024 ? 'large' : 'small',
          cid,
          encryptedBlob: cid ? undefined : uint8ToBase64(mergeIvAndCiphertext(encrypted.iv, encrypted.ciphertext)),
          iv: uint8ToBase64(encrypted.iv),
          thumbnailData: thumbnail,
          mimeType,
          size: uploadedSize,
          timestamp: Date.now(),
          owner: walletAddress,
          status: 'pending'
        };

        await saveGalleryItem(galleryItem);
        
        setUploadProgress(prev => prev.map(p => 
          p.id === uploadId ? { ...p, progress: 100, status: 'complete' } : p
        ));

        setItems(prev => [galleryItem, ...prev]);

        try {
          await P3.proofs.publish("gallery_upload", {
            itemId,
            cid: cid || 'local',
            ts: Date.now()
          });
        } catch (anchorError) {
          console.warn('Anchor failed:', anchorError);
        }

        setTimeout(() => {
          setUploadProgress(prev => prev.filter(p => p.id !== uploadId));
        }, 2000);

      } catch (error) {
        console.error('Upload error:', error);
        setUploadProgress(prev => prev.map(p => 
          p.id === uploadId ? { ...p, status: 'error' } : p
        ));
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive"
        });
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleViewImage = async (item: GalleryItem) => {
    if (!cryptoKey) {
      toast({
        title: "Gallery Locked",
        description: "Please unlock the gallery first",
        variant: "destructive"
      });
      return;
    }

    setSelectedItem(item);
    setShowImageDialog(true);
    setIsDecrypting(true);
    setDecryptedImageUrl(null);

    try {
      let encryptedData: Uint8Array;
      let iv: Uint8Array;

      if (item.cid) {
        const rawData = await fetchFromIPFS(item.cid);
        iv = rawData.slice(0, 12);
        encryptedData = rawData.slice(12);
      } else if (item.encryptedBlob && item.iv) {
        const fullData = base64ToUint8(item.encryptedBlob);
        iv = fullData.slice(0, 12);
        encryptedData = fullData.slice(12);
      } else {
        throw new Error('No encrypted data available');
      }

      const blob = await decryptToBlob(
        uint8ToBase64(encryptedData),
        uint8ToBase64(iv),
        cryptoKey,
        item.mimeType
      );

      const url = URL.createObjectURL(blob);
      setDecryptedImageUrl(url);
    } catch (error) {
      console.error('Decrypt error:', error);
      toast({
        title: "Decryption Failed",
        description: "Could not decrypt the image",
        variant: "destructive"
      });
      setShowImageDialog(false);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!decryptedImageUrl || !selectedItem) return;
    
    const link = document.createElement('a');
    link.href = decryptedImageUrl;
    link.download = `gallery-${selectedItem.id}.${selectedItem.mimeType.split('/')[1] || 'jpg'}`;
    link.click();
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteGalleryItem(itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
      toast({
        title: "Image Deleted",
        description: "The image has been removed from your gallery"
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: "Could not delete the image",
        variant: "destructive"
      });
    }
  };

  const handleSettingsChange = async (requirePassword: boolean) => {
    if (!walletAddress || !salt) return;
    
    const updatedSettings: GallerySettings = {
      owner: walletAddress,
      saltB64: uint8ToBase64(salt),
      requirePasswordOnOpen: requirePassword,
      createdAt: settings?.createdAt || Date.now()
    };
    
    await saveSettings(updatedSettings);
    setSettingsState(updatedSettings);
    
    toast({
      title: "Settings Updated",
      description: requirePassword 
        ? "Password will be required each session" 
        : "Gallery will auto-unlock with wallet"
    });
  };

  const closeImageDialog = () => {
    setShowImageDialog(false);
    if (decryptedImageUrl) {
      URL.revokeObjectURL(decryptedImageUrl);
      setDecryptedImageUrl(null);
    }
    setSelectedItem(null);
  };

  const getStatusIcon = (status: GalleryItem['status']) => {
    switch (status) {
      case 'anchored':
        return <CheckCircle className="w-3 h-3 text-emerald-400" />;
      case 'pending':
      case 'uploading':
        return <Clock className="w-3 h-3 text-amber-400" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-400" />;
      default:
        return null;
    }
  };

  if (isLoading && viewState === 'unlock') {
    return (
      <Card className="glass-card" data-testid="tile-encrypted-gallery">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-pink-400 mb-4" />
            <p className="text-sm text-slate-400">Loading gallery...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card" data-testid="tile-encrypted-gallery">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              {cryptoKey ? (
                <Unlock className="w-5 h-5 text-white" />
              ) : (
                <Lock className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">Encrypted Gallery</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-pink-500/20 text-pink-400 uppercase">
                  Beta
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {cryptoKey ? 'End-to-end encrypted' : 'Unlock to view'}
              </p>
            </div>
          </div>
          
          {viewState === 'gallery' && (
            <button
              onClick={() => setViewState('settings')}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              data-testid="button-gallery-settings"
            >
              <Settings className="w-5 h-5 text-slate-400" />
            </button>
          )}
          
          {viewState === 'settings' && (
            <button
              onClick={() => setViewState('gallery')}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              data-testid="button-back-to-gallery"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>

        {viewState === 'unlock' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Lock className="w-12 h-12 mx-auto mb-3 text-pink-400 opacity-50" />
              <p className="text-sm text-slate-400 mb-4">
                Enter a password to encrypt your images, or use your wallet for automatic encryption.
              </p>
            </div>

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter encryption password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                className="pr-10 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                data-testid="input-gallery-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button
              onClick={handleUnlock}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white"
              data-testid="button-unlock-gallery"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Unlocking...
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4 mr-2" />
                  Unlock Gallery
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-slate-900 text-slate-500">or</span>
              </div>
            </div>

            <Button
              onClick={handleSkipPassword}
              disabled={isLoading}
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="button-wallet-only"
            >
              <Lock className="w-4 h-4 mr-2" />
              Use Wallet-Only Mode
            </Button>
          </div>
        )}

        {viewState === 'settings' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Require Password Each Session</p>
                  <p className="text-xs text-slate-400 mt-1">
                    When enabled, you'll need to enter your password each time
                  </p>
                </div>
                <Switch
                  checked={settings?.requirePasswordOnOpen ?? true}
                  onCheckedChange={handleSettingsChange}
                  data-testid="switch-require-password"
                />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
              <p className="text-xs text-slate-400">
                <span className="font-medium text-slate-300">Owner:</span>{' '}
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                <span className="font-medium text-slate-300">Images:</span> {items.length}
              </p>
            </div>

            <Button
              onClick={() => {
                setCryptoKey(null);
                setViewState('unlock');
              }}
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="button-lock-gallery"
            >
              <Lock className="w-4 h-4 mr-2" />
              Lock Gallery
            </Button>
          </div>
        )}

        {viewState === 'gallery' && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-image-file"
            />

            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white"
              data-testid="button-upload-image"
            >
              <ImagePlus className="w-4 h-4 mr-2" />
              Add Images
            </Button>

            {uploadProgress.length > 0 && (
              <div className="space-y-2">
                {uploadProgress.map((up) => (
                  <div
                    key={up.id}
                    className="p-2 rounded-lg bg-slate-900/50 border border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-300 truncate max-w-[150px]">
                        {up.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {up.status === 'encrypting' && 'Encrypting...'}
                        {up.status === 'uploading' && 'Uploading...'}
                        {up.status === 'complete' && 'Complete'}
                        {up.status === 'error' && 'Failed'}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          up.status === 'error' ? 'bg-red-500' : 'bg-pink-500'
                        }`}
                        style={{ width: `${up.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {items.length === 0 ? (
              <div className="py-8 text-center">
                <ImagePlus className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p className="text-sm text-slate-400">
                  No images yet. Add some to get started!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="relative group aspect-square rounded-lg overflow-hidden bg-slate-800 border border-slate-700 cursor-pointer"
                    onClick={() => handleViewImage(item)}
                    data-testid={`gallery-item-${item.id}`}
                  >
                    {item.thumbnailData ? (
                      <img
                        src={item.thumbnailData}
                        alt="Encrypted thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Lock className="w-6 h-6 text-slate-600" />
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewImage(item);
                        }}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        data-testid={`button-view-${item.id}`}
                      >
                        <Eye className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item.id);
                        }}
                        className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors"
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>

                    <div className="absolute top-1 right-1">
                      {getStatusIcon(item.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Dialog open={showImageDialog} onOpenChange={closeImageDialog}>
          <DialogContent className="bg-slate-950 border-slate-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Unlock className="w-4 h-4 text-pink-400" />
                Decrypted Image
              </DialogTitle>
            </DialogHeader>
            
            <div className="relative min-h-[200px] flex items-center justify-center">
              {isDecrypting ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
                  <p className="text-sm text-slate-400">Decrypting...</p>
                </div>
              ) : decryptedImageUrl ? (
                <img
                  src={decryptedImageUrl}
                  alt="Decrypted"
                  className="max-w-full max-h-[60vh] rounded-lg object-contain"
                  data-testid="decrypted-image"
                />
              ) : null}
            </div>
            
            {decryptedImageUrl && (
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  onClick={handleDownloadImage}
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  data-testid="button-download-image"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  onClick={closeImageDialog}
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                  data-testid="button-close-dialog"
                >
                  Close
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

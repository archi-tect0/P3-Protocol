import { useState } from 'react';
import { X, Check, Image, Palette, Upload, Loader2 } from 'lucide-react';
import { HubBackground } from '@/lib/hubPreferences';
import { cn } from '@/lib/utils';

interface BackgroundPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (background: HubBackground) => void;
  currentBackground: HubBackground;
}

const gradientPresets = [
  { id: 'default', value: 'from-slate-900 via-purple-900/20 to-slate-900', name: 'Default Purple' },
  { id: 'midnight', value: 'from-slate-950 via-indigo-950 to-slate-950', name: 'Midnight Indigo' },
  { id: 'ocean', value: 'from-slate-900 via-cyan-900/30 to-slate-900', name: 'Ocean Depths' },
  { id: 'forest', value: 'from-slate-900 via-emerald-900/20 to-slate-900', name: 'Forest Night' },
  { id: 'sunset', value: 'from-slate-900 via-orange-900/20 to-rose-950', name: 'Sunset Glow' },
  { id: 'aurora', value: 'from-violet-950 via-purple-900/30 to-teal-950', name: 'Northern Aurora' },
  { id: 'nebula', value: 'from-indigo-950 via-pink-900/20 to-purple-950', name: 'Cosmic Nebula' },
  { id: 'shadow', value: 'from-zinc-950 via-slate-900 to-zinc-950', name: 'Dark Shadow' },
];

const imagePresets = [
  { id: 'abstract-1', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80', name: 'Abstract Flow' },
  { id: 'gradient-mesh', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80', name: 'Gradient Mesh' },
  { id: 'space-1', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=800&q=80', name: 'Deep Space' },
  { id: 'neon-city', url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80', name: 'Neon City' },
  { id: 'mountains', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80', name: 'Mountains' },
  { id: 'aurora-sky', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&q=80', name: 'Aurora Sky' },
];

export function BackgroundPicker({
  isOpen,
  onClose,
  onSelect,
  currentBackground,
}: BackgroundPickerProps) {
  const [tab, setTab] = useState<'gradients' | 'images' | 'upload'>('gradients');
  const [uploadUrl, setUploadUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleGradientSelect = (gradient: typeof gradientPresets[0]) => {
    onSelect({ type: 'gradient', value: gradient.value });
    onClose();
  };

  const handleImageSelect = (image: typeof imagePresets[0]) => {
    onSelect({ type: 'image', value: image.url });
    onClose();
  };

  const handleUploadUrl = () => {
    if (uploadUrl.trim()) {
      setIsLoading(true);
      const img = new window.Image();
      img.onload = () => {
        onSelect({ type: 'image', value: uploadUrl.trim() });
        setIsLoading(false);
        setUploadUrl('');
        onClose();
      };
      img.onerror = () => {
        setIsLoading(false);
      };
      img.src = uploadUrl.trim();
    }
  };

  const isCurrentGradient = (value: string) => 
    currentBackground.type === 'gradient' && currentBackground.value === value;
  
  const isCurrentImage = (url: string) => 
    currentBackground.type === 'image' && currentBackground.value === url;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg max-h-[80vh] rounded-t-3xl bg-slate-900 border-t border-slate-700/50 overflow-hidden animate-slide-up">
        <div className="sticky top-0 z-10 bg-slate-900 px-4 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Choose Background
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-800 transition-colors"
              data-testid="bg-picker-close"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setTab('gradients')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === 'gradients' 
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" 
                  : "bg-slate-800/50 text-slate-400 hover:text-white"
              )}
              data-testid="tab-gradients"
            >
              <Palette className="w-4 h-4" />
              Gradients
            </button>
            <button
              onClick={() => setTab('images')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === 'images' 
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" 
                  : "bg-slate-800/50 text-slate-400 hover:text-white"
              )}
              data-testid="tab-images"
            >
              <Image className="w-4 h-4" />
              Gallery
            </button>
            <button
              onClick={() => setTab('upload')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === 'upload' 
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" 
                  : "bg-slate-800/50 text-slate-400 hover:text-white"
              )}
              data-testid="tab-upload"
            >
              <Upload className="w-4 h-4" />
              Custom
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[55vh] p-4">
          {tab === 'gradients' && (
            <div className="grid grid-cols-2 gap-3">
              {gradientPresets.map((gradient) => (
                <button
                  key={gradient.id}
                  onClick={() => handleGradientSelect(gradient)}
                  className={cn(
                    "relative aspect-video rounded-xl overflow-hidden border-2 transition-all",
                    isCurrentGradient(gradient.value)
                      ? "border-purple-500 ring-2 ring-purple-500/30"
                      : "border-slate-700/50 hover:border-slate-600"
                  )}
                  data-testid={`bg-gradient-${gradient.id}`}
                >
                  <div className={cn("absolute inset-0 bg-gradient-to-br", gradient.value)} />
                  {isCurrentGradient(gradient.value) && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60">
                    <span className="text-xs text-white font-medium">{gradient.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === 'images' && (
            <div className="grid grid-cols-2 gap-3">
              {imagePresets.map((image) => (
                <button
                  key={image.id}
                  onClick={() => handleImageSelect(image)}
                  className={cn(
                    "relative aspect-video rounded-xl overflow-hidden border-2 transition-all",
                    isCurrentImage(image.url)
                      ? "border-purple-500 ring-2 ring-purple-500/30"
                      : "border-slate-700/50 hover:border-slate-600"
                  )}
                  data-testid={`bg-image-${image.id}`}
                >
                  <img 
                    src={image.url} 
                    alt={image.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                  {isCurrentImage(image.url) && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60">
                    <span className="text-xs text-white font-medium">{image.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === 'upload' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <p className="text-sm text-slate-400 mb-3">
                  Enter an image URL to use as your background
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={uploadUrl}
                    onChange={(e) => setUploadUrl(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                    data-testid="input-bg-url"
                  />
                  <button
                    onClick={handleUploadUrl}
                    disabled={!uploadUrl.trim() || isLoading}
                    className="px-4 py-2.5 rounded-lg bg-purple-500 text-white font-medium text-sm hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    data-testid="button-apply-url"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                  </button>
                </div>
              </div>
              
              {currentBackground.type === 'image' && (
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-2">Current background</p>
                  <div className="relative aspect-video rounded-lg overflow-hidden">
                    <img 
                      src={currentBackground.value} 
                      alt="Current background"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BackgroundPicker;

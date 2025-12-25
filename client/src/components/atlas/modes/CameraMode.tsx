import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  Camera, RefreshCw, AlertCircle, Loader2, Upload, Trash2,
  FileText, Calculator, Scan, Grid, List, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CameraCapture {
  id: string;
  name: string;
  path: string;
  mimeType: string | null;
  sizeBytes: number | null;
  source: string | null;
  hasOcr: boolean;
  hasEquations: boolean;
  hasAnnotations: boolean;
  createdAt: string;
}

interface CaptureDetail {
  id: string;
  name: string;
  path: string;
  mimeType: string | null;
  sizeBytes: number | null;
  source: string | null;
  annotations: any[] | null;
  ocrResult: { text: string; blocks?: any[]; raw?: boolean } | null;
  recognizedEquations: Array<{ raw: string; latex: string; description?: string }> | null;
  providerMeta: { provider: string; model?: string; processedAt?: string } | null;
  createdAt: string;
}

interface CapturesResponse {
  captures: CameraCapture[];
  count: number;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function CameraMode() {
  const wallet = useAtlasStore(s => s.wallet);
  const pushReceipt = useAtlasStore(s => s.pushReceipt);
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCapture, setSelectedCapture] = useState<CaptureDetail | null>(null);

  const { data, isLoading, error, refetch } = useQuery<CapturesResponse>({
    queryKey: ['/api/system/camera', wallet],
    enabled: !!wallet,
  });

  const uploadCapture = useMutation({
    mutationFn: async (file: File) => {
      const walletAddress = localStorage.getItem('walletAddress') || wallet;
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      const formData = new FormData();
      formData.append('image', file);
      formData.append('name', file.name);
      formData.append('source', 'upload');

      const response = await fetch('/api/system/camera/capture', {
        method: 'POST',
        headers: { 'x-wallet-address': walletAddress },
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/system/camera'] });
      toast({ title: 'Image captured' });
      pushReceipt({
        id: `receipt-camera-${data.capture.id}`,
        hash: data.receipt.hash,
        scope: 'atlas.camera.capture',
        endpoint: '/api/system/camera/capture',
        timestamp: Date.now(),
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    },
  });

  const processCapture = useMutation({
    mutationFn: async ({ id, ocr, equations }: { id: string; ocr: boolean; equations: boolean }) => {
      return apiRequest(`/api/system/camera/${id}/annotate`, {
        method: 'POST',
        body: JSON.stringify({ 
          processOcr: ocr, 
          recognizeEquations: equations,
          provider: 'openai',
        }),
      }) as Promise<{ capture: CaptureDetail }>;
    },
    onSuccess: (data) => {
      setSelectedCapture(data.capture);
      queryClient.invalidateQueries({ queryKey: ['/api/system/camera'] });
      toast({ title: 'Processing complete' });
    },
    onError: (err: Error) => {
      toast({ title: 'Processing failed', description: err.message, variant: 'destructive' });
    },
  });

  const deleteCapture = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/system/camera/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system/camera'] });
      setSelectedCapture(null);
      toast({ title: 'Capture deleted' });
    },
    onError: (err: Error) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadCapture.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadCaptureDetail = async (id: string) => {
    try {
      const data = await apiRequest(`/api/system/camera/${id}`, { method: 'GET' });
      setSelectedCapture(data.capture);
    } catch (err) {
      toast({ title: 'Failed to load capture', variant: 'destructive' });
    }
  };

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="camera-no-wallet">
        <Camera className="w-12 h-12 text-white/30" />
        <p className="text-white/60 text-center">Connect wallet to use Camera</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="camera-loading">
        <MotionDiv
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="camera-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load camera captures</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-camera-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const captures = data?.captures || [];

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="camera-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400/20 to-blue-400/20">
            <Camera className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-xl font-light text-white/80" data-testid="text-camera-title">
            Camera
          </h2>
          <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-400/20 text-cyan-400">
            OS-Native
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40'}`}
              data-testid="button-view-grid"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40'}`}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => refetch()}
            className="text-white/60 hover:text-white p-2"
            data-testid="button-camera-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-file-upload"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadCapture.isPending}
        className="w-full mb-6 p-6 rounded-xl border-2 border-dashed border-white/20 hover:border-cyan-400/40 transition-colors flex flex-col items-center gap-3 bg-white/5"
        data-testid="button-upload-capture"
      >
        {uploadCapture.isPending ? (
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        ) : (
          <Upload className="w-8 h-8 text-white/40" />
        )}
        <div className="text-center">
          <p className="text-white/60">Click to upload an image</p>
          <p className="text-xs text-white/40 mt-1">PNG, JPEG, WebP up to 20MB</p>
        </div>
      </button>

      <AnimatePresence mode="wait">
        {selectedCapture ? (
          <MotionDiv
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mb-6"
          >
            <CaptureDetailCard
              capture={selectedCapture}
              onClose={() => setSelectedCapture(null)}
              onProcess={(ocr, equations) => processCapture.mutate({ 
                id: selectedCapture.id, ocr, equations 
              })}
              onDelete={() => deleteCapture.mutate(selectedCapture.id)}
              isProcessing={processCapture.isPending}
              isDeleting={deleteCapture.isPending}
            />
          </MotionDiv>
        ) : captures.length === 0 ? (
          <MotionDiv
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
            data-testid="camera-empty"
          >
            <Camera className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 mb-2">No captures yet</p>
            <p className="text-white/40 text-sm max-w-md mx-auto">
              Upload an image to capture, then use AI to extract text, recognize equations, or annotate regions.
            </p>
          </MotionDiv>
        ) : (
          <MotionDiv
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={viewMode === 'grid' 
              ? 'grid grid-cols-2 md:grid-cols-3 gap-4' 
              : 'space-y-2'}
            data-testid="captures-list"
          >
            {captures.map((capture) => (
              <CaptureCard
                key={capture.id}
                capture={capture}
                viewMode={viewMode}
                onClick={() => loadCaptureDetail(capture.id)}
              />
            ))}
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}

function CaptureCard({
  capture,
  viewMode,
  onClick,
}: {
  capture: CameraCapture;
  viewMode: 'grid' | 'list';
  onClick: () => void;
}) {
  const imageUrl = `/api/system/camera/${capture.id}/image`;

  if (viewMode === 'grid') {
    return (
      <MotionDiv
        whileHover={{ scale: 1.02 }}
        onClick={onClick}
        className="cursor-pointer rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-cyan-400/30 transition-colors"
        data-testid={`capture-card-${capture.id}`}
      >
        <div className="aspect-square bg-black/20 relative">
          <img
            src={imageUrl}
            alt={capture.name}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute top-2 right-2 flex gap-1">
            {capture.hasOcr && (
              <span className="p-1 rounded bg-black/60 text-cyan-400">
                <FileText className="w-3 h-3" />
              </span>
            )}
            {capture.hasEquations && (
              <span className="p-1 rounded bg-black/60 text-purple-400">
                <Calculator className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
        <div className="p-2">
          <p className="text-xs text-white/70 truncate">{capture.name}</p>
          <p className="text-xs text-white/40">{formatTimeAgo(capture.createdAt)}</p>
        </div>
      </MotionDiv>
    );
  }

  return (
    <MotionDiv
      whileHover={{ x: 4 }}
      onClick={onClick}
      className="cursor-pointer p-3 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/30 transition-colors flex items-center gap-3"
      data-testid={`capture-card-${capture.id}`}
    >
      <div className="w-12 h-12 rounded-lg bg-black/20 overflow-hidden flex-shrink-0">
        <img
          src={imageUrl}
          alt={capture.name}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/70 truncate">{capture.name}</p>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>{formatFileSize(capture.sizeBytes)}</span>
          <span>{formatTimeAgo(capture.createdAt)}</span>
        </div>
      </div>
      <div className="flex gap-1">
        {capture.hasOcr && <FileText className="w-4 h-4 text-cyan-400" />}
        {capture.hasEquations && <Calculator className="w-4 h-4 text-purple-400" />}
      </div>
    </MotionDiv>
  );
}

function CaptureDetailCard({
  capture,
  onClose,
  onProcess,
  onDelete,
  isProcessing,
  isDeleting,
}: {
  capture: CaptureDetail;
  onClose: () => void;
  onProcess: (ocr: boolean, equations: boolean) => void;
  onDelete: () => void;
  isProcessing: boolean;
  isDeleting: boolean;
}) {
  const imageUrl = `/api/system/camera/${capture.id}/image`;

  return (
    <div 
      className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
      data-testid={`capture-detail-${capture.id}`}
    >
      <div className="relative">
        <img
          src={imageUrl}
          alt={capture.name}
          className="w-full max-h-64 object-contain bg-black/30"
          crossOrigin="anonymous"
        />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white/70 hover:text-white transition-colors"
          data-testid="button-close-detail"
        >
          ×
        </button>
      </div>

      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-medium text-white/80 mb-1">{capture.name}</h3>
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span>{formatFileSize(capture.sizeBytes)}</span>
          <span>{capture.mimeType}</span>
          <span>{new Date(capture.createdAt).toLocaleString()}</span>
        </div>
      </div>

      <div className="p-4 border-b border-white/10 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onProcess(true, false)}
          disabled={isProcessing}
          className="border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10"
          data-testid="button-process-ocr"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Scan className="w-4 h-4 mr-1.5" />}
          Extract Text (OCR)
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onProcess(false, true)}
          disabled={isProcessing}
          className="border-purple-400/30 text-purple-400 hover:bg-purple-400/10"
          data-testid="button-process-equations"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Calculator className="w-4 h-4 mr-1.5" />}
          Recognize Equations
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onProcess(true, true)}
          disabled={isProcessing}
          className="border-white/20 text-white/60 hover:bg-white/10"
          data-testid="button-process-all"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          Full Analysis
        </Button>
      </div>

      {capture.ocrResult && (
        <div className="p-4 border-b border-white/10 bg-cyan-500/5">
          <h4 className="text-xs text-cyan-400 uppercase mb-2 flex items-center gap-1.5">
            <FileText className="w-3 h-3" /> Extracted Text
          </h4>
          <p className="text-sm text-white/70 whitespace-pre-wrap" data-testid="text-ocr-result">
            {capture.ocrResult.text || 'No text detected'}
          </p>
        </div>
      )}

      {capture.recognizedEquations && capture.recognizedEquations.length > 0 && (
        <div className="p-4 border-b border-white/10 bg-purple-500/5">
          <h4 className="text-xs text-purple-400 uppercase mb-2 flex items-center gap-1.5">
            <Calculator className="w-3 h-3" /> Recognized Equations
          </h4>
          <div className="space-y-2">
            {capture.recognizedEquations.map((eq, i) => (
              <div key={i} className="p-2 rounded bg-black/20">
                <code className="text-sm text-purple-300 font-mono">{eq.latex || eq.raw}</code>
                {eq.description && (
                  <p className="text-xs text-white/40 mt-1">{eq.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {capture.providerMeta && (
        <div className="p-4 border-b border-white/10">
          <h4 className="text-xs text-white/40 uppercase mb-2">Processing Info</h4>
          <div className="flex items-center gap-3 text-xs text-white/50">
            <span>Provider: {capture.providerMeta.provider}</span>
            {capture.providerMeta.model && <span>Model: {capture.providerMeta.model}</span>}
            {capture.providerMeta.processedAt && (
              <span>{new Date(capture.providerMeta.processedAt).toLocaleString()}</span>
            )}
          </div>
        </div>
      )}

      <div className="p-4 flex justify-between items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="text-red-400 hover:bg-red-400/10"
          data-testid="button-delete-capture"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
          Delete
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="border-white/20 text-white/60"
          data-testid="button-back-to-list"
        >
          Back to gallery
        </Button>
      </div>
    </div>
  );
}

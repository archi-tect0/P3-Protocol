import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams, useSearch } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Repeat,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Maximize2,
  Minimize2,
  Film,
  Settings,
  PictureInPicture2,
  Rewind,
  FastForward,
} from 'lucide-react';
import { type Asset, type License, type StreamManifest } from '@/lib/sdk/marketplace';

type PlayerState = 'loading' | 'verifying' | 'ready' | 'playing' | 'paused' | 'buffering' | 'error';
type LicenseState = 'verifying' | 'valid' | 'invalid' | 'expired';
type QualityLevel = 'auto' | '1080p' | '720p' | '480p' | '360p';

const qualityOptions: { value: QualityLevel; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '1080p', label: '1080p HD' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
  { value: '360p', label: '360p' },
];

export default function VideoPlayer() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const searchParams = new URLSearchParams(useSearch());
  const playId = searchParams.get('play');
  const licenseId = searchParams.get('license');

  const [licenseState, setLicenseState] = useState<LicenseState>('verifying');
  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [quality, setQuality] = useState<QualityLevel>('auto');
  const [showSettings, setShowSettings] = useState(false);
  const [isPiP, setIsPiP] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: video, isLoading: isLoadingVideo } = useQuery<Asset>({
    queryKey: ['/api/marketplace/catalog', params.id],
    enabled: !!params.id,
  });

  const { data: license, isLoading: isLoadingLicense } = useQuery<License>({
    queryKey: ['/api/marketplace/gate/license', playId || licenseId],
    enabled: !!(playId || licenseId),
  });

  const { data: manifest } = useQuery<StreamManifest>({
    queryKey: ['/api/marketplace/content/stream/manifest', params.id, playId || licenseId],
    enabled: licenseState === 'valid' && !!(playId || licenseId),
  });

  useEffect(() => {
    if (!playId && !licenseId) {
      setLicenseState('invalid');
      return;
    }

    if (isLoadingLicense) {
      setLicenseState('verifying');
      return;
    }

    if (!license) {
      setLicenseState('invalid');
      return;
    }

    if (license.status === 'expired') {
      setLicenseState('expired');
      return;
    }

    if (license.status === 'revoked') {
      setLicenseState('invalid');
      return;
    }

    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      setLicenseState('expired');
      return;
    }

    setLicenseState('valid');
  }, [license, playId, licenseId, isLoadingLicense]);

  useEffect(() => {
    if (licenseState === 'valid' && manifest) {
      setPlayerState('ready');
    }
  }, [licenseState, manifest]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };

    const handleEnded = () => {
      if (isRepeat) {
        video.currentTime = 0;
        video.play();
      } else {
        setIsPlaying(false);
        setPlayerState('paused');
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setPlayerState('playing');
    };

    const handlePause = () => {
      setIsPlaying(false);
      setPlayerState('paused');
    };

    const handleWaiting = () => {
      setPlayerState('buffering');
    };

    const handleCanPlay = () => {
      if (playerState === 'buffering') {
        setPlayerState(isPlaying ? 'playing' : 'paused');
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [isRepeat, isPlaying, playerState]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress) return;

    const rect = progress.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * duration;
  }, [duration]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.currentTime + 10, duration);
  }, [duration]);

  const skipBackward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(video.currentTime - 10, 0);
  }, []);

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      console.error('PiP error:', err);
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const hours = Math.floor(time / 3600);
    const mins = Math.floor((time % 3600) / 60);
    const secs = Math.floor(time % 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  if (licenseState === 'verifying' || isLoadingVideo) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-rose-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Verifying Stream Access
          </h2>
          <p className="text-slate-400 mb-4">
            Checking your access rights on the protocol...
          </p>
          <Loader2 className="w-6 h-6 text-rose-400 animate-spin mx-auto" />
        </Card>
      </div>
    );
  }

  if (licenseState === 'invalid') {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Invalid Stream Access
          </h2>
          <p className="text-slate-400 mb-6">
            You don't have a valid stream session. Please rent or purchase the video first.
          </p>
          <Button
            data-testid="button-go-video"
            onClick={() => setLocation(`/marketplace/video/${params.id}`)}
            className="bg-gradient-to-r from-rose-600 to-orange-600"
          >
            Go to Video
          </Button>
        </Card>
      </div>
    );
  }

  if (licenseState === 'expired') {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Access Expired
          </h2>
          <p className="text-slate-400 mb-6">
            Your rental period has ended. Rent again or purchase to continue watching.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              data-testid="button-rent-again"
              onClick={() => setLocation(`/marketplace/video/${params.id}`)}
              className="bg-gradient-to-r from-rose-600 to-orange-600"
            >
              Rent Again
            </Button>
            <Button
              data-testid="button-back-catalog"
              variant="outline"
              onClick={() => setLocation('/marketplace/video')}
              className="border-white/10 text-white hover:bg-white/5"
            >
              Back to Catalog
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`min-h-screen bg-black flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <header className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-4">
          <Button
            data-testid="button-back"
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/marketplace/video/${params.id}`)}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 data-testid="text-video-title" className="text-lg font-semibold text-white">
              {video?.title || 'Loading...'}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-0 text-xs">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Protected Stream
              </Badge>
              <Badge variant="secondary" className="bg-rose-500/20 text-rose-400 border-0 text-xs">
                <Film className="w-3 h-3 mr-1" />
                HLS
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center relative">
        <video
          ref={videoRef}
          src={manifest?.hlsManifestUrl || undefined}
          className="w-full h-full object-contain"
          poster={video?.coverUrl}
          preload="metadata"
          data-testid="video-player"
          onClick={togglePlay}
        />

        {playerState === 'buffering' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-12 h-12 text-rose-400 animate-spin" />
          </div>
        )}

        {!isPlaying && playerState !== 'buffering' && (
          <button
            data-testid="button-center-play"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
          >
            <div className="w-20 h-20 rounded-full bg-rose-500/90 flex items-center justify-center shadow-lg shadow-rose-500/30 hover:scale-110 transition-transform">
              <Play className="w-10 h-10 text-white fill-white ml-1" />
            </div>
          </button>
        )}
      </main>

      <footer className={`absolute bottom-0 left-0 right-0 z-20 px-6 pb-6 pt-16 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="space-y-4">
          <div
            ref={progressRef}
            data-testid="progress-bar"
            className="h-1 bg-white/20 rounded-full cursor-pointer group relative"
            onClick={handleSeek}
          >
            <div
              className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
              style={{ width: `${bufferedPercent}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-orange-500 rounded-full relative transition-all"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span data-testid="text-current-time" className="text-sm text-white font-mono min-w-[60px]">
                {formatTime(currentTime)}
              </span>
              <span className="text-sm text-slate-500">/</span>
              <span data-testid="text-duration" className="text-sm text-slate-400 font-mono min-w-[60px]">
                {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                data-testid="button-rewind"
                variant="ghost"
                size="icon"
                onClick={skipBackward}
                className="text-white hover:bg-white/10"
              >
                <Rewind className="w-5 h-5" />
              </Button>

              <Button
                data-testid="button-play-pause"
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="w-12 h-12 text-white hover:bg-white/10"
              >
                {playerState === 'buffering' ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5 fill-current" />
                )}
              </Button>

              <Button
                data-testid="button-forward"
                variant="ghost"
                size="icon"
                onClick={skipForward}
                className="text-white hover:bg-white/10"
              >
                <FastForward className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 group">
                <Button
                  data-testid="button-mute"
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/10"
                >
                  <VolumeIcon className="w-5 h-5" />
                </Button>
                <input
                  type="range"
                  data-testid="input-volume"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
              </div>

              <div className="relative">
                <Button
                  data-testid="button-settings"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-white hover:bg-white/10"
                >
                  <Settings className="w-5 h-5" />
                </Button>
                {showSettings && (
                  <div className="absolute bottom-12 right-0 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-lg p-3 min-w-[180px]">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-400 mb-2">Quality</p>
                        <Select value={quality} onValueChange={(v) => setQuality(v as QualityLevel)}>
                          <SelectTrigger data-testid="select-quality" className="w-full bg-white/5 border-white/10 text-white text-sm h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1a1a] border-white/10">
                            {qualityOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button
                data-testid="button-repeat"
                variant="ghost"
                size="icon"
                onClick={() => setIsRepeat(!isRepeat)}
                className={`${isRepeat ? 'text-rose-400' : 'text-white'} hover:bg-white/10`}
              >
                <Repeat className="w-5 h-5" />
              </Button>

              <Button
                data-testid="button-pip"
                variant="ghost"
                size="icon"
                onClick={togglePiP}
                className={`${isPiP ? 'text-rose-400' : 'text-white'} hover:bg-white/10`}
              >
                <PictureInPicture2 className="w-5 h-5" />
              </Button>

              <Button
                data-testid="button-fullscreen"
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/10"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-5 h-5" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams, useSearch } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Repeat,
  Shuffle,
  Heart,
  Share2,
  List,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Maximize2,
  Minimize2,
  Radio,
  Disc3,
} from 'lucide-react';
import { type Asset, type License, type StreamManifest } from '@/lib/sdk/marketplace';

type PlayerState = 'loading' | 'verifying' | 'ready' | 'playing' | 'paused' | 'error';
type LicenseState = 'verifying' | 'valid' | 'invalid' | 'expired';

export default function MusicPlayer() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const searchParams = new URLSearchParams(useSearch());
  const playId = searchParams.get('play');

  const [licenseState, setLicenseState] = useState<LicenseState>('verifying');
  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const { data: track, isLoading: isLoadingTrack } = useQuery<Asset>({
    queryKey: ['/api/marketplace/catalog', params.id],
    enabled: !!params.id,
  });

  const { data: license, isLoading: isLoadingLicense } = useQuery<License>({
    queryKey: ['/api/marketplace/gate/license', playId],
    enabled: !!playId,
  });

  const { data: manifest } = useQuery<StreamManifest>({
    queryKey: ['/api/marketplace/content/stream/manifest', params.id, playId],
    enabled: licenseState === 'valid' && !!playId,
  });

  useEffect(() => {
    if (!playId) {
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
  }, [license, playId, isLoadingLicense]);

  useEffect(() => {
    if (licenseState === 'valid' && manifest) {
      setPlayerState('ready');
    }
  }, [licenseState, manifest]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      if (isRepeat) {
        audio.currentTime = 0;
        audio.play();
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

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [isRepeat]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progress = progressRef.current;
    if (!audio || !progress) return;

    const rect = progress.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * duration;
  }, [duration]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const skipForward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(audio.currentTime + 10, duration);
  }, [duration]);

  const skipBackward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(audio.currentTime - 10, 0);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  if (licenseState === 'verifying' || isLoadingTrack) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-cyan-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Verifying Stream Access
          </h2>
          <p className="text-slate-400 mb-4">
            Checking your access rights on the protocol...
          </p>
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
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
            You don't have a valid stream session. Please start a new stream from the track page.
          </p>
          <Button
            data-testid="button-go-track"
            onClick={() => setLocation(`/marketplace/music/${params.id}`)}
            className="bg-gradient-to-r from-cyan-600 to-purple-600"
          >
            Go to Track
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
            Stream Session Expired
          </h2>
          <p className="text-slate-400 mb-6">
            Your stream session has ended. Start a new stream to continue listening.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              data-testid="button-new-stream"
              onClick={() => setLocation(`/marketplace/music/${params.id}`)}
              className="bg-gradient-to-r from-cyan-600 to-purple-600"
            >
              New Stream
            </Button>
            <Button
              data-testid="button-back-catalog"
              variant="outline"
              onClick={() => setLocation('/marketplace/music')}
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
    <div className="min-h-screen bg-[#141414] flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-transparent to-purple-900/20 pointer-events-none" />
      
      {track?.coverUrl && (
        <div 
          className="absolute inset-0 opacity-20 blur-3xl pointer-events-none"
          style={{
            backgroundImage: `url(${track.coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      <audio
        ref={audioRef}
        src={manifest?.hlsManifestUrl || undefined}
        preload="metadata"
        data-testid="audio-player"
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1a1a1a]/50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Button
            data-testid="button-back"
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/marketplace/music/${params.id}`)}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-green-500/20 text-green-400 border-0"
            >
              <ShieldCheck className="w-3 h-3 mr-1" />
              Streaming
            </Badge>
            <Badge
              variant="secondary"
              className="bg-cyan-500/20 text-cyan-400 border-0"
            >
              <Radio className="w-3 h-3 mr-1" />
              HLS
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            data-testid="button-queue"
            variant="ghost"
            size="icon"
            onClick={() => setShowQueue(!showQueue)}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <List className="w-5 h-5" />
          </Button>
          <Button
            data-testid="button-fullscreen"
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-8">
        <div className="max-w-lg w-full space-y-8">
          <div className="relative mx-auto w-64 h-64 md:w-80 md:h-80">
            <div className={`w-full h-full rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden shadow-2xl shadow-cyan-500/20 ${isPlaying ? 'animate-pulse' : ''}`}>
              {track?.coverUrl ? (
                <img
                  src={track.coverUrl}
                  alt={track?.title}
                  className="w-full h-full object-cover"
                  data-testid="img-album-art"
                />
              ) : (
                <div className="relative">
                  <Disc3 className={`w-32 h-32 text-cyan-400 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                </div>
              )}
            </div>
            {isPlaying && (
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-xl -z-10 animate-pulse" />
            )}
          </div>

          <div className="text-center">
            <h1 data-testid="text-track-title" className="text-2xl font-bold text-white mb-2">
              {track?.title || 'Loading...'}
            </h1>
            <p data-testid="text-artist" className="text-slate-400">
              {track?.authorWallet.slice(0, 8)}...{track?.authorWallet.slice(-6)}
            </p>
          </div>

          <div className="space-y-2">
            <div
              ref={progressRef}
              data-testid="progress-bar"
              className="h-2 bg-white/10 rounded-full cursor-pointer group"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full relative transition-all"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="flex justify-between text-sm text-slate-400">
              <span data-testid="text-current-time">{formatTime(currentTime)}</span>
              <span data-testid="text-duration">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button
              data-testid="button-shuffle"
              variant="ghost"
              size="icon"
              onClick={() => setIsShuffle(!isShuffle)}
              className={`${isShuffle ? 'text-cyan-400' : 'text-slate-400'} hover:text-white hover:bg-white/10`}
            >
              <Shuffle className="w-5 h-5" />
            </Button>

            <Button
              data-testid="button-skip-back"
              variant="ghost"
              size="icon"
              onClick={skipBackward}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              <SkipBack className="w-6 h-6" />
            </Button>

            <Button
              data-testid="button-play-pause"
              size="icon"
              onClick={togglePlay}
              disabled={playerState === 'loading'}
              className="w-16 h-16 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white shadow-lg shadow-cyan-500/30"
            >
              {playerState === 'loading' ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-8 h-8" />
              ) : (
                <Play className="w-8 h-8 ml-1 fill-current" />
              )}
            </Button>

            <Button
              data-testid="button-skip-forward"
              variant="ghost"
              size="icon"
              onClick={skipForward}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              <SkipForward className="w-6 h-6" />
            </Button>

            <Button
              data-testid="button-repeat"
              variant="ghost"
              size="icon"
              onClick={() => setIsRepeat(!isRepeat)}
              className={`${isRepeat ? 'text-cyan-400' : 'text-slate-400'} hover:text-white hover:bg-white/10`}
            >
              <Repeat className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <Button
              data-testid="button-like"
              variant="ghost"
              size="icon"
              onClick={() => setIsLiked(!isLiked)}
              className={`${isLiked ? 'text-red-400' : 'text-slate-400'} hover:text-red-400 hover:bg-white/10`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </Button>

            <div className="flex items-center gap-3 flex-1 max-w-[200px] mx-auto">
              <Button
                data-testid="button-mute"
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-slate-400 hover:text-white hover:bg-white/10"
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
                className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </div>

            <Button
              data-testid="button-share"
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </main>

      {showQueue && (
        <aside className="fixed right-0 top-0 bottom-0 w-80 bg-[#1a1a1a]/95 backdrop-blur-xl border-l border-white/5 p-6 z-50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Queue</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQueue(false)}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                {track?.coverUrl ? (
                  <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-5 h-5 text-cyan-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{track?.title}</p>
                <p className="text-sm text-slate-400 truncate">Now Playing</p>
              </div>
              <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-500 text-center py-4">
              Queue is empty
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}

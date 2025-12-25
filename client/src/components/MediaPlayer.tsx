import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface MediaPlayerProps {
  type: 'voice' | 'video';
  src: string;
  duration?: number;
  thumbnail?: string;
  className?: string;
}

export default function MediaPlayer({ type, src, duration, thumbnail, className = '' }: MediaPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(40).fill(0));

  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const setupAudioAnalyzer = () => {
    if (!mediaRef.current || audioContextRef.current) return;

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaElementSource(mediaRef.current);
      
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
    } catch (error) {
      console.error('Error setting up audio analyzer:', error);
    }
  };

  const updateAudioVisualization = () => {
    if (!analyserRef.current || !isPlaying) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const levels = Array.from({ length: 40 }, (_, i) => {
      const index = Math.floor((i / 40) * dataArray.length);
      return (dataArray[index] / 255) * 100;
    });
    
    setAudioLevels(levels);
    animationRef.current = requestAnimationFrame(updateAudioVisualization);
  };

  const togglePlay = () => {
    if (!mediaRef.current) return;

    if (isPlaying) {
      mediaRef.current.pause();
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    } else {
      if (!audioContextRef.current && type === 'voice') {
        setupAudioAnalyzer();
      }
      mediaRef.current.play();
      setIsPlaying(true);
      if (type === 'voice') {
        updateAudioVisualization();
      }
    }
  };

  const toggleMute = () => {
    if (!mediaRef.current) return;
    mediaRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (!mediaRef.current) return;
    setCurrentTime(mediaRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!mediaRef.current) return;
    setTotalDuration(mediaRef.current.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mediaRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    mediaRef.current.currentTime = percent * totalDuration;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <Card className={`p-4 space-y-3 ${className}`} data-testid="card-media-player">
      {type === 'video' ? (
        <div className="relative rounded-lg overflow-hidden bg-black" data-testid="container-video-player">
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={src}
            className="w-full h-48 object-cover"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            playsInline
            poster={thumbnail}
            data-testid="video-player"
          />
          <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm rounded-lg p-2">
            <div className="flex items-center gap-2">
              <Button
                onClick={togglePlay}
                size="sm"
                variant="ghost"
                className="text-white hover:text-white hover:bg-white/20"
                data-testid="button-play-pause"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <div 
                className="flex-1 h-1 bg-white/30 rounded-full cursor-pointer"
                onClick={handleSeek}
                data-testid="progressbar-video"
              >
                <div 
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-white font-mono" data-testid="text-time">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>
              <Button
                onClick={toggleMute}
                size="sm"
                variant="ghost"
                className="text-white hover:text-white hover:bg-white/20"
                data-testid="button-mute"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3" data-testid="container-voice-player">
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={src}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            data-testid="audio-player"
          />
          
          <div className="flex items-center gap-3">
            <Button
              onClick={togglePlay}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-play-pause"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>

            <div className="flex-1 flex items-center gap-1 h-12">
              {audioLevels.map((level, i) => (
                <div
                  key={i}
                  className="flex-1 bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all duration-75"
                  style={{ 
                    height: `${Math.max(4, isPlaying ? level * 0.8 : 20)}px`,
                    opacity: i < (progress / 100) * 40 ? 1 : 0.3
                  }}
                  data-testid={`bar-waveform-${i}`}
                />
              ))}
            </div>

            <span className="text-sm text-slate-600 dark:text-slate-400 font-mono min-w-[80px]" data-testid="text-time">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
          </div>

          <div 
            className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer"
            onClick={handleSeek}
            data-testid="progressbar-audio"
          >
            <div 
              className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

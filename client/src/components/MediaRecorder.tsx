import { useState, useRef, useEffect } from 'react';
import { Mic, Video, Square, Send, X, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface MediaRecorderProps {
  type: 'voice' | 'video';
  onRecordingComplete: (blob: Blob, duration: number, thumbnail?: string) => void;
  onCancel: () => void;
  maxDuration?: number;
}

export default function MediaRecorder({ 
  type, 
  onRecordingComplete, 
  onCancel, 
  maxDuration = 20 
}: MediaRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [thumbnail, setThumbnail] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video' ? { width: 1280, height: 720 } : false,
      });

      streamRef.current = stream;

      if (videoRef.current && type === 'video') {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Setup audio level monitoring
      setupAudioAnalyzer(stream);

      const mimeType = type === 'video' 
        ? 'video/webm;codecs=vp8,opus'
        : 'audio/webm;codecs=opus';

      const mediaRecorder = new (window as any).MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: type === 'video' ? 2500000 : undefined,
      }) as MediaRecorder;

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { 
          type: type === 'video' ? 'video/webm' : 'audio/webm' 
        });
        setRecordedBlob(blob);
        setIsRecording(false);
        
        if (type === 'video' && videoRef.current) {
          captureVideoThumbnail();
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      // Start timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setDuration(elapsed);
        
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 100);

    } catch (error) {
      console.error('Error accessing media devices:', error);
      onCancel();
    }
  };

  const setupAudioAnalyzer = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 256;
    source.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    
    updateAudioLevel();
  };

  const updateAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(Math.min(100, (average / 128) * 100));
    
    animationRef.current = requestAnimationFrame(updateAudioLevel);
  };

  const captureVideoThumbnail = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const thumbnailData = canvas.toDataURL('image/jpeg', 0.7);
      setThumbnail(thumbnailData);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const handleSend = () => {
    if (recordedBlob) {
      onRecordingComplete(recordedBlob, duration, thumbnail);
      cleanup();
    }
  };

  const handleCancel = () => {
    cleanup();
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-6 space-y-4 bg-white dark:bg-slate-800" data-testid="card-media-recorder">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {type === 'voice' ? (
            <Mic className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <Video className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          )}
          <span className="font-medium text-slate-900 dark:text-white">
            {type === 'voice' ? 'Voice Message' : 'Video Message'}
          </span>
        </div>
        <span className="text-2xl font-mono text-slate-700 dark:text-slate-300" data-testid="text-timer">
          {formatTime(duration)} / {formatTime(maxDuration)}
        </span>
      </div>

      {type === 'video' && (
        <div className="relative rounded-lg overflow-hidden bg-black" data-testid="container-video-preview">
          <video
            ref={videoRef}
            className="w-full h-64 object-cover"
            muted
            playsInline
            data-testid="video-preview"
          />
          {recordedBlob && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Play className="w-16 h-16 text-white opacity-80" />
            </div>
          )}
        </div>
      )}

      {type === 'voice' && (
        <div className="space-y-2" data-testid="container-waveform">
          <div className="flex items-center gap-1 h-20 justify-center">
            {Array.from({ length: 40 }).map((_, i) => {
              const barHeight = isRecording 
                ? Math.max(4, (audioLevel / 100) * 80 * (0.5 + Math.random() * 0.5))
                : 4;
              return (
                <div
                  key={i}
                  className="w-1 bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all duration-100"
                  style={{ height: `${barHeight}px` }}
                  data-testid={`bar-waveform-${i}`}
                />
              );
            })}
          </div>
          {isRecording && (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span>Recording...</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {isRecording ? (
          <Button 
            onClick={stopRecording}
            variant="destructive"
            className="flex-1"
            data-testid="button-stop-recording"
          >
            <Square className="w-4 h-4 mr-2" />
            Stop Recording
          </Button>
        ) : recordedBlob ? (
          <>
            <Button 
              onClick={handleCancel}
              variant="outline"
              className="flex-1"
              data-testid="button-cancel"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={handleSend}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-send"
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </>
        ) : null}
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
        {isRecording 
          ? 'Recording will stop automatically at 20s' 
          : 'Preview your recording and send or re-record'
        }
      </div>
    </Card>
  );
}

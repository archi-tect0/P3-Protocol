import { useState, useRef, useCallback, useEffect } from 'react';
import { createDiag } from '@/lib/diag';

const diag = createDiag({ tag: 'SpeechCapture' });

type SpeechState = 'idle' | 'recording' | 'processing';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onspeechstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface UseSpeechCaptureOptions {
  wallet: string;
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
}

interface UseSpeechCaptureResult {
  state: SpeechState;
  interimText: string;
  audioLevel: number;
  isSupported: boolean;
  useBrowserApi: boolean;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
}

export function useSpeechCapture({
  wallet,
  onTranscript,
  onError,
  language = 'en-US',
}: UseSpeechCaptureOptions): UseSpeechCaptureResult {
  const [state, setState] = useState<SpeechState>('idle');
  const [interimText, setInterimText] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechPauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const hasSpeechStartedRef = useRef<boolean>(false);
  
  const SPEECH_PAUSE_TIMEOUT_MS = 1500;
  
  const SpeechRecognition = typeof window !== 'undefined' 
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  
  const isSupported = typeof window !== 'undefined' && 
    !!(navigator.mediaDevices?.getUserMedia);
  
  const useBrowserApi = !!SpeechRecognition;

  const cleanupMediaResources = useCallback(() => {
    if (speechPauseTimeoutRef.current) {
      clearTimeout(speechPauseTimeoutRef.current);
      speechPauseTimeoutRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    analyserRef.current = null;
    accumulatedTranscriptRef.current = '';
    hasSpeechStartedRef.current = false;
    setAudioLevel(0);
  }, []);

  const startAudioLevelMonitor = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      const updateLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 128);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
      
      return stream;
    } catch (err) {
      console.error('Failed to start audio monitor:', err);
      throw err;
    }
  }, []);

  const transcribeWithServer = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('wallet', wallet);
      
      const response = await fetch('/api/atlas/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Transcription failed');
      }
      
      const data = await response.json();
      return data.text || null;
    } catch (err) {
      console.error('Server transcription failed:', err);
      return null;
    }
  }, [wallet]);

  const startBrowserRecognition = useCallback(async () => {
    if (!SpeechRecognition) return;
    
    try {
      await startAudioLevelMonitor();
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;
      
      accumulatedTranscriptRef.current = '';
      hasSpeechStartedRef.current = false;
      
      const autoStopAndProcess = () => {
        diag.log('Auto-stop triggered after speech pause');
        if (speechPauseTimeoutRef.current) {
          clearTimeout(speechPauseTimeoutRef.current);
          speechPauseTimeoutRef.current = null;
        }
        
        const transcript = accumulatedTranscriptRef.current.trim();
        if (transcript && recognitionRef.current) {
          recognitionRef.current.stop();
          cleanupMediaResources();
          recognitionRef.current = null;
          isCapturingRef.current = false;
          setState('idle');
          setInterimText('');
          onTranscript(transcript);
        }
      };
      
      const resetPauseTimeout = () => {
        if (speechPauseTimeoutRef.current) {
          clearTimeout(speechPauseTimeoutRef.current);
        }
        speechPauseTimeoutRef.current = setTimeout(autoStopAndProcess, SPEECH_PAUSE_TIMEOUT_MS);
      };
      
      recognition.onstart = () => {
        diag.log('SpeechRecognition onstart - recording started');
        setState('recording');
      };
      
      recognition.onspeechstart = () => {
        diag.log('SpeechRecognition onspeechstart - user speaking');
        hasSpeechStartedRef.current = true;
        if (speechPauseTimeoutRef.current) {
          clearTimeout(speechPauseTimeoutRef.current);
          speechPauseTimeoutRef.current = null;
        }
      };
      
      recognition.onspeechend = () => {
        diag.log('SpeechRecognition onspeechend - speech pause detected');
        if (hasSpeechStartedRef.current && accumulatedTranscriptRef.current.trim()) {
          resetPauseTimeout();
        }
      };
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        
        if (final) {
          accumulatedTranscriptRef.current += ' ' + final;
        }
        
        const displayText = (accumulatedTranscriptRef.current + ' ' + interim).trim();
        setInterimText(displayText);
        
        if (final) {
          resetPauseTimeout();
        }
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        diag.error('SpeechRecognition onerror', { error: event.error, message: event.message });
        if (speechPauseTimeoutRef.current) {
          clearTimeout(speechPauseTimeoutRef.current);
          speechPauseTimeoutRef.current = null;
        }
        cleanupMediaResources();
        recognitionRef.current = null;
        isCapturingRef.current = false;
        setState('idle');
        setInterimText('');
        if (event.error === 'not-allowed') {
          onError?.('Microphone access denied');
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          onError?.(`Speech recognition error: ${event.error}`);
        }
      };
      
      recognition.onend = () => {
        diag.log('SpeechRecognition onend - recording ended');
        if (speechPauseTimeoutRef.current) {
          clearTimeout(speechPauseTimeoutRef.current);
          speechPauseTimeoutRef.current = null;
        }
        
        const transcript = accumulatedTranscriptRef.current.trim();
        if (transcript) {
          cleanupMediaResources();
          recognitionRef.current = null;
          isCapturingRef.current = false;
          setState('idle');
          setInterimText('');
          onTranscript(transcript);
        } else if (hasSpeechStartedRef.current && mediaStreamRef.current) {
          diag.log('No final transcript - attempting server-side transcription');
          setState('processing');
          cleanupMediaResources();
          recognitionRef.current = null;
          isCapturingRef.current = false;
          setInterimText('');
        } else {
          cleanupMediaResources();
          recognitionRef.current = null;
          isCapturingRef.current = false;
          setState('idle');
          setInterimText('');
        }
      };
      
      recognition.start();
      recognitionRef.current = recognition;
      
    } catch (err: any) {
      console.error('Browser recognition failed:', err);
      cleanupMediaResources();
      onError?.(err.message || 'Failed to start speech recognition');
      setState('idle');
    }
  }, [SpeechRecognition, language, onTranscript, onError, startAudioLevelMonitor, cleanupMediaResources, state]);

  const startFallbackRecording = useCallback(async () => {
    try {
      const stream = await startAudioLevelMonitor();
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        cleanupMediaResources();
        
        if (audioChunksRef.current.length === 0) {
          setState('idle');
          return;
        }
        
        setState('processing');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        
        try {
          const text = await transcribeWithServer(audioBlob);
          
          setState('idle');
          
          if (text) {
            onTranscript(text);
          } else {
            onError?.('Could not transcribe audio. Please try again or type your message.');
          }
        } catch (err) {
          setState('idle');
          onError?.('Transcription failed. Please try again or type your message.');
        }
      };
      
      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setState('recording');
      
    } catch (err: any) {
      console.error('Fallback recording failed:', err);
      cleanupMediaResources();
      onError?.(err.message || 'Microphone access denied');
      setState('idle');
    }
  }, [startAudioLevelMonitor, cleanupMediaResources, transcribeWithServer, onTranscript, onError]);

  const isCapturingRef = useRef(false);
  const lastCaptureAttemptRef = useRef(0);
  const DEBOUNCE_MS = 500; // Prevent rapid-fire clicks on mobile
  
  const startCapture = useCallback(async () => {
    const now = Date.now();
    const timeSinceLast = now - lastCaptureAttemptRef.current;
    
    // Debounce rapid clicks (common on mobile touch events)
    if (timeSinceLast < DEBOUNCE_MS) {
      diag.debug('startCapture debounced', { timeSinceLast, threshold: DEBOUNCE_MS });
      return;
    }
    
    diag.log('startCapture called', { state, isCapturing: isCapturingRef.current, useBrowserApi, isSupported });
    
    if (state !== 'idle' || isCapturingRef.current) {
      diag.warn('startCapture blocked', { state, isCapturing: isCapturingRef.current });
      return;
    }
    
    lastCaptureAttemptRef.current = now;
    isCapturingRef.current = true;
    
    // Reset interimText at the start of a new recording session
    setInterimText('');
    
    // Safety timeout: reset lock after 10 seconds if something hangs
    const safetyTimeout = setTimeout(() => {
      if (isCapturingRef.current) {
        diag.warn('startCapture safety timeout - resetting lock');
        isCapturingRef.current = false;
      }
    }, 10000);
    
    try {
      if (useBrowserApi) {
        diag.log('Using browser SpeechRecognition API');
        await startBrowserRecognition();
      } else {
        diag.log('Using fallback MediaRecorder API');
        await startFallbackRecording();
      }
    } catch (err: any) {
      diag.error('startCapture error', { error: err?.message || String(err) });
      isCapturingRef.current = false;
    } finally {
      clearTimeout(safetyTimeout);
      // Note: Don't reset isCapturingRef here - it's reset when recording actually stops
    }
  }, [state, useBrowserApi, isSupported, startBrowserRecognition, startFallbackRecording]);

  const stopCapture = useCallback(() => {
    diag.log('stopCapture called');
    
    // Reset interimText immediately when stopping to prevent stale text on next recording
    setInterimText('');
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    // Always reset the capturing lock when stopping
    isCapturingRef.current = false;
    
    cleanupMediaResources();
    setState('idle');
  }, [cleanupMediaResources]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      cleanupMediaResources();
    };
  }, [cleanupMediaResources]);

  return {
    state,
    interimText,
    audioLevel,
    isSupported,
    useBrowserApi,
    startCapture,
    stopCapture,
  };
}

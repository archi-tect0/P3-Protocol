import type { RadioStation } from '@/components/atlas/modes/RadioMode';
import { useAtlasStore } from '@/state/useAtlasStore';

type RadioCallback = () => void;
type BufferingCallback = (buffering: boolean) => void;
type ErrorCallback = (message: string) => void;

interface RadioCallbacks {
  onPlaying?: RadioCallback;
  onBuffering?: BufferingCallback;
  onError?: ErrorCallback;
}

class RadioAudioManager {
  private audio: HTMLAudioElement | null = null;
  private currentStationId: string | null = null;
  private currentStreamUrl: string | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private subscribers: Map<string, RadioCallbacks> = new Map();
  private playRequested = false; // Track if playback was requested

  getAudioElement(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.crossOrigin = 'anonymous';
      this.audio.preload = 'none';
      
      this.audio.addEventListener('playing', () => this.handlePlaying());
      this.audio.addEventListener('pause', () => this.handlePause());
      this.audio.addEventListener('waiting', () => this.handleWaiting());
      this.audio.addEventListener('error', () => this.handleError());
      this.audio.addEventListener('ended', () => this.handleEnded());
    }
    return this.audio;
  }

  subscribe(id: string, callbacks: RadioCallbacks): void {
    this.subscribers.set(id, callbacks);
  }

  unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  private notifyPlaying(): void {
    this.subscribers.forEach(cb => cb.onPlaying?.());
  }

  private notifyBuffering(buffering: boolean): void {
    this.subscribers.forEach(cb => cb.onBuffering?.(buffering));
  }

  private notifyError(message: string): void {
    this.subscribers.forEach(cb => cb.onError?.(message));
  }

  private handlePlaying(): void {
    this.retryCount = 0;
    this.playRequested = true;
    // Sync store state when audio actually starts playing
    useAtlasStore.getState().setRadioPlaying(true);
    this.notifyPlaying();
    this.notifyBuffering(false);
  }

  private handlePause(): void {
    // Don't clear playRequested here - only explicit pause() should clear it
    // This prevents station switching from losing the play intent
    // Sync store state when audio actually pauses
    useAtlasStore.getState().setRadioPlaying(false);
  }

  private handleWaiting(): void {
    this.notifyBuffering(true);
  }

  private handleError(): void {
    // Use playRequested flag instead of store state (handles pre-playing errors)
    if (!this.playRequested || !this.currentStreamUrl) return;
    
    this.retryCount++;
    if (this.retryCount <= this.maxRetries) {
      this.notifyError(`Retrying... (${this.retryCount}/${this.maxRetries})`);
      this.retryTimeout = setTimeout(() => {
        if (this.audio && this.currentStreamUrl && this.playRequested) {
          this.audio.src = this.currentStreamUrl;
          this.audio.play().catch(() => {});
        }
      }, 2000);
    } else {
      this.notifyError('Stream unavailable');
      this.playRequested = false;
      useAtlasStore.getState().setRadioPlaying(false);
      this.retryCount = 0;
    }
  }

  private handleEnded(): void {
    // Use playRequested flag instead of store state
    if (!this.playRequested || !this.currentStreamUrl) return;
    
    this.notifyError('Stream ended, reconnecting...');
    this.retryTimeout = setTimeout(() => {
      if (this.audio && this.currentStreamUrl && this.playRequested) {
        this.audio.src = this.currentStreamUrl;
        this.audio.play().catch(() => {});
      }
    }, 1000);
  }

  play(station: RadioStation, streamUrl: string): Promise<void> {
    const audio = this.getAudioElement();
    this.playRequested = true;
    
    if (this.currentStationId !== station.id || this.currentStreamUrl !== streamUrl) {
      this.clearRetry();
      this.retryCount = 0;
      audio.src = streamUrl;
      this.currentStationId = station.id;
      this.currentStreamUrl = streamUrl;
    }
    
    return audio.play();
  }

  pause(): void {
    this.playRequested = false;
    this.clearRetry();
    this.audio?.pause();
    // Audio pause event will update store state
  }

  setVolume(volume: number): void {
    const audio = this.getAudioElement();
    audio.volume = Math.max(0, Math.min(1, volume / 100));
  }

  getCurrentStationId(): string | null {
    return this.currentStationId;
  }

  isPlaying(): boolean {
    return this.audio ? !this.audio.paused : false;
  }

  private clearRetry(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }
}

export const radioAudioManager = new RadioAudioManager();

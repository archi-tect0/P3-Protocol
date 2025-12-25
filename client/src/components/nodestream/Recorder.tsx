import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Circle, Square, Upload, X, Loader2, Check, Play, Pause } from "lucide-react";
import { getMeshClient, generateCID, signData } from "@/lib/meshClient";
import type { StreamManifest, VideoChunk, Session } from "@shared/nodestream-types";

type RecorderState = "preview" | "recording" | "recorded" | "publishing" | "published";

interface RecorderProps {
  onPublished: (manifest: StreamManifest) => void;
  onCancel: () => void;
}

const _CHUNK_DURATION_MS = 5000; void _CHUNK_DURATION_MS;

export default function Recorder({ onPublished, onCancel }: RecorderProps) {
  const [state, setState] = useState<RecorderState>("preview");
  const [error, setError] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [publishProgress, setPublishProgress] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play();
      }
      setError(null);
    } catch (err) {
      console.error("[Recorder] Camera access error:", err);
      setError("Could not access camera/microphone. Please grant permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      setError("No camera stream available");
      return;
    }

    chunksRef.current = [];
    setDuration(0);
    recordingStartRef.current = Date.now();

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setState("recorded");
        stopCamera();
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setState("recording");

      recordingIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartRef.current) / 1000);
        setDuration(elapsed);
      }, 100);
    } catch (err) {
      console.error("[Recorder] MediaRecorder error:", err);
      setError("Failed to start recording");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const handleRecordToggle = useCallback(() => {
    if (state === "preview") {
      startRecording();
    } else if (state === "recording") {
      stopRecording();
    }
  }, [state, startRecording, stopRecording]);

  const togglePlayback = useCallback(() => {
    if (!previewRef.current) return;
    if (isPlaying) {
      previewRef.current.pause();
      setIsPlaying(false);
    } else {
      previewRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleTrimStartChange = useCallback((value: number[]) => {
    const newStart = value[0];
    if (newStart < trimEnd - 5) {
      setTrimStart(newStart);
    }
  }, [trimEnd]);

  const handleTrimEndChange = useCallback((value: number[]) => {
    const newEnd = value[0];
    if (newEnd > trimStart + 5) {
      setTrimEnd(newEnd);
    }
  }, [trimStart]);

  const handlePublish = async () => {
    if (!recordedBlob || !title.trim()) {
      setError("Please provide a title for your video");
      return;
    }

    setState("publishing");
    setPublishProgress(0);
    setError(null);

    try {
      const mockSession: Session = {
        did: `did:key:z6Mk${crypto.randomUUID().replace(/-/g, "")}`,
        token: `token_${Date.now()}`,
        expiresAt: Date.now() + 86400000,
      };

      const meshClient = getMeshClient(mockSession);
      if (!meshClient) {
        throw new Error("MeshClient not available");
      }

      const arrayBuffer = await recordedBlob.arrayBuffer();
      const trimmedStart = Math.floor((trimStart / 100) * arrayBuffer.byteLength);
      const trimmedEnd = Math.floor((trimEnd / 100) * arrayBuffer.byteLength);
      const trimmedBuffer = arrayBuffer.slice(trimmedStart, trimmedEnd);

      const chunkSize = Math.max(1024 * 1024, Math.floor(trimmedBuffer.byteLength / 10));
      const numChunks = Math.ceil(trimmedBuffer.byteLength / chunkSize);
      const chunks: VideoChunk[] = [];
      const chunkDurationMs = Math.floor((duration * 1000 * (trimEnd - trimStart) / 100) / numChunks);

      for (let i = 0; i < numChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, trimmedBuffer.byteLength);
        const chunkData = trimmedBuffer.slice(start, end);
        const cid = await generateCID(chunkData);

        const chunk: VideoChunk = {
          cid,
          owner: mockSession.did,
          seq: i,
          durationMs: chunkDurationMs,
          codec: "vp9",
          resolution: "1280x720",
          checksum: cid.slice(0, 16),
        };

        try {
          await meshClient.disseminateChunk(chunk, chunkData);
        } catch (disseminateError) {
          console.warn("[Recorder] Chunk dissemination warning:", disseminateError);
        }

        chunks.push(chunk);
        setPublishProgress(Math.floor(((i + 1) / numChunks) * 80));
      }

      const streamId = `stream_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

      const manifestData = JSON.stringify({
        streamId,
        owner: mockSession.did,
        chunks: chunks.map((c) => c.cid),
      });
      const signature = await signData(manifestData, mockSession);

      const index: Record<number, number> = {};
      let accumulatedTime = 0;
      chunks.forEach((chunk, idx) => {
        index[accumulatedTime] = idx;
        accumulatedTime += chunk.durationMs;
      });

      const manifest: StreamManifest = {
        streamId,
        owner: mockSession.did,
        createdAt: Date.now(),
        chunks,
        index,
        policy: {
          maxPeers: 50,
          allowEncryption: true,
          allowedRegions: [],
          allowComments: true,
          allowReactions: true,
        },
        signature,
        live: false,
        title: title.trim(),
        description: description.trim(),
        tags,
      };

      setPublishProgress(90);

      try {
        await meshClient.announceManifest(manifest);
      } catch (announceError) {
        console.warn("[Recorder] Manifest announcement warning:", announceError);
      }

      setPublishProgress(100);
      setState("published");

      setTimeout(() => {
        onPublished(manifest);
      }, 1500);
    } catch (err) {
      console.error("[Recorder] Publish error:", err);
      setError(err instanceof Error ? err.message : "Failed to publish video");
      setState("recorded");
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCancel = () => {
    stopCamera();
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    onCancel();
  };

  return (
    <div className="h-full flex flex-col bg-slate-950" data-testid="nodestream-recorder">
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Video className="w-5 h-5 text-purple-400" />
          {state === "published" ? "Published!" : state === "publishing" ? "Publishing..." : "Record Video"}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={state === "publishing"}
          data-testid="button-cancel"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm" data-testid="error-message">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {(state === "preview" || state === "recording") && (
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              data-testid="video-preview"
            />
            {state === "recording" && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 rounded-full px-3 py-1.5">
                <Circle className="w-3 h-3 fill-current text-white animate-pulse" />
                <span className="text-white text-sm font-medium" data-testid="recording-duration">
                  {formatTime(duration)}
                </span>
              </div>
            )}
          </div>
        )}

        {(state === "recorded" || state === "publishing" || state === "published") && recordedUrl && (
          <div className="space-y-4">
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              <video
                ref={previewRef}
                src={recordedUrl}
                className="w-full h-full object-cover"
                onEnded={() => setIsPlaying(false)}
                data-testid="video-recorded"
              />
              <button
                onClick={togglePlayback}
                className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
                disabled={state === "publishing" || state === "published"}
                data-testid="button-playback-toggle"
              >
                {isPlaying ? (
                  <Pause className="w-12 h-12 text-white" />
                ) : (
                  <Play className="w-12 h-12 text-white fill-current" />
                )}
              </button>
            </div>

            {state === "recorded" && (
              <>
                <Card className="bg-slate-900/60 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-300">Trim Video</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 mb-2 block">
                        Start: {Math.floor((trimStart / 100) * duration)}s
                      </label>
                      <Slider
                        value={[trimStart]}
                        onValueChange={handleTrimStartChange}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full"
                        data-testid="slider-trim-start"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-2 block">
                        End: {Math.floor((trimEnd / 100) * duration)}s
                      </label>
                      <Slider
                        value={[trimEnd]}
                        onValueChange={handleTrimEndChange}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full"
                        data-testid="slider-trim-end"
                      />
                    </div>
                    <div className="text-xs text-slate-500">
                      Duration: {formatTime(Math.floor(((trimEnd - trimStart) / 100) * duration))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/60 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-300">Video Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 mb-1.5 block">Title *</label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter video title"
                        className="bg-slate-800/50 border-slate-700"
                        data-testid="input-title"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1.5 block">Description</label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your video"
                        rows={3}
                        className="bg-slate-800/50 border-slate-700 resize-none"
                        data-testid="input-description"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1.5 block">Tags (comma separated)</label>
                      <Input
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="gaming, vlog, tutorial"
                        className="bg-slate-800/50 border-slate-700"
                        data-testid="input-tags"
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {state === "publishing" && (
              <Card className="bg-slate-900/60 border-slate-700">
                <CardContent className="py-6">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                    <span className="text-white">Publishing to mesh network...</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-pink-600 h-full transition-all duration-300"
                      style={{ width: `${publishProgress}%` }}
                      data-testid="progress-publish"
                    />
                  </div>
                  <div className="text-center text-xs text-slate-400 mt-2">{publishProgress}%</div>
                </CardContent>
              </Card>
            )}

            {state === "published" && (
              <Card className="bg-green-900/30 border-green-700/50">
                <CardContent className="py-6 text-center">
                  <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-white mb-1">Published Successfully!</h3>
                  <p className="text-sm text-slate-400">Your video is now live on NodeStream</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800">
        {(state === "preview" || state === "recording") && (
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleRecordToggle}
              className={`rounded-full w-16 h-16 ${
                state === "recording"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              }`}
              data-testid="button-record-toggle"
            >
              {state === "recording" ? (
                <Square className="w-6 h-6 fill-current" />
              ) : (
                <Circle className="w-6 h-6 fill-current" />
              )}
            </Button>
          </div>
        )}

        {state === "recorded" && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-slate-700"
              onClick={() => {
                if (recordedUrl) URL.revokeObjectURL(recordedUrl);
                setRecordedBlob(null);
                setRecordedUrl(null);
                setTrimStart(0);
                setTrimEnd(100);
                setState("preview");
                startCamera();
              }}
              data-testid="button-retake"
            >
              Retake
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              onClick={handlePublish}
              disabled={!title.trim()}
              data-testid="button-publish"
            >
              <Upload className="w-4 h-4 mr-2" />
              Publish
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

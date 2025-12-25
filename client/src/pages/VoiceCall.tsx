import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import NotionLayout from "@/components/NotionLayout";
import AnchorToggle from "@/components/AnchorToggle";
import E2EEBadge from "@/components/E2EEBadge";
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor,
  MonitorOff,
  Download,
  Clock,
  Activity,
  Wifi,
  WifiOff,
  User,
  Users
} from "lucide-react";
import { ulid } from "ulid";
import { apiRequest } from "@/lib/queryClient";

type CallState = "idle" | "connecting" | "connected" | "ended";
type NetworkQuality = "excellent" | "good" | "poor" | "critical";

interface Metrics {
  rtt: number;
  jitter: number;
  packetLoss: number;
  bitrate: number;
  codec: string;
  bandwidth: number;
}

interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  isVideoOn: boolean;
  quality: NetworkQuality;
  stream?: MediaStream;
}

interface CallHistory {
  id: string;
  date: string;
  duration: string;
  quality: NetworkQuality;
}

function VoiceCall() {
  const [callState, setCallState] = useState<CallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [anchorOnBlockchain, setAnchorOnBlockchain] = useState(false);
  const [isRecording, _setIsRecording] = useState(false);
  const [roomId, setRoomId] = useState<string>("");
  const [callDuration, setCallDuration] = useState(0);
  const [activeSpeakerId, _setActiveSpeakerId] = useState<string | null>(null);
  void _setIsRecording;
  void _setActiveSpeakerId;
  
  const [metrics, setMetrics] = useState<Metrics>({
    rtt: 0,
    jitter: 0,
    packetLoss: 0,
    bitrate: 0,
    codec: "opus",
    bandwidth: 0,
  });
  
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>("excellent");
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "local", name: "You", isMuted: false, isVideoOn: true, quality: "excellent" }
  ]);
  
  const [callHistory] = useState<CallHistory[]>([
    { id: "1", date: "Nov 15, 2025 2:30 PM", duration: "45:32", quality: "excellent" },
    { id: "2", date: "Nov 14, 2025 10:15 AM", duration: "23:15", quality: "good" },
    { id: "3", date: "Nov 13, 2025 4:45 PM", duration: "67:41", quality: "excellent" },
  ]);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  void remoteVideoRefs;
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const meetingIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (callState === "connected") {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      setCallDuration(0);
    }
    
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callState]);

  const cleanup = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const initializeWebSocket = (room: string) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws-signaling`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token: "user-token" }));
      ws.send(JSON.stringify({ type: "join", roomId: room }));
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case "offer":
          await handleOffer(message.data);
          break;
        case "answer":
          await handleAnswer(message.data);
          break;
        case "ice":
          await handleIceCandidate(message.data);
          break;
        case "end":
        case "ended":
          handleCallEnd();
          break;
      }
    };

    ws.onerror = () => setCallState("ended");
    ws.onclose = () => {
      if (callState === "connected" || callState === "connecting") {
        setCallState("ended");
      }
    };
  };

  const initializePeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "ice",
          candidate: event.candidate,
          roomId,
        }));
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      const participantId = `remote-${Date.now()}`;
      remoteStreamsRef.current.set(participantId, stream);
      
      setParticipants(prev => [...prev, {
        id: participantId,
        name: "Remote User",
        isMuted: false,
        isVideoOn: true,
        quality: "excellent",
        stream
      }]);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState("connected");
        startStatsCollection();
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setCallState("ended");
      }
    };

    return pc;
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current || initializePeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "answer",
        answer,
        roomId,
      }));
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const handleCallEnd = async () => {
    setCallState("ended");
    cleanup();
    if (meetingIdRef.current) {
      try {
        await apiRequest("/api/meetings/end", {
          method: "POST",
          body: JSON.stringify({ meetingId: meetingIdRef.current }),
        });
      } catch (error) {
        console.error("Failed to end meeting:", error);
      }
    }
  };

  const assessNetworkQuality = (rtt: number, packetLoss: number, jitter: number): NetworkQuality => {
    if (rtt > 400 || packetLoss > 10 || jitter > 100) return "critical";
    if (rtt > 300 || packetLoss > 5 || jitter > 50) return "poor";
    if (rtt > 150 || packetLoss > 2 || jitter > 30) return "good";
    return "excellent";
  };

  const startStatsCollection = () => {
    if (!peerConnectionRef.current) return;

    statsIntervalRef.current = setInterval(async () => {
      if (!peerConnectionRef.current) return;

      try {
        const stats = await peerConnectionRef.current.getStats();
        let rtt = 0, jitter = 0, packetLoss = 0, bitrate = 0, bandwidth = 0;
        let codec = "opus";

        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            rtt = report.currentRoundTripTime * 1000 || 0;
          }
          if (report.type === "inbound-rtp") {
            jitter = report.jitter * 1000 || 0;
            packetLoss = report.packetsLost || 0;
            bitrate = Math.round((report.bytesReceived * 8) / 1000) || 0;
          }
          if (report.type === "codec" && report.mimeType) {
            codec = report.mimeType.split("/")[1] || "opus";
          }
        });

        bandwidth = bitrate;
        const newMetrics = {
          rtt: Math.round(rtt),
          jitter: Math.round(jitter),
          packetLoss: Math.round(packetLoss),
          bitrate,
          codec,
          bandwidth,
        };

        setMetrics(newMetrics);
        setNetworkQuality(assessNetworkQuality(newMetrics.rtt, newMetrics.packetLoss, newMetrics.jitter));
      } catch (error) {
        console.error("Failed to collect stats:", error);
      }
    }, 2000);
  };

  const startCall = async () => {
    try {
      setCallState("connecting");
      const newRoomId = ulid();
      setRoomId(newRoomId);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 1280, height: 720 } 
      });
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      initializeWebSocket(newRoomId);
      const pc = initializePeerConnection();

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "offer",
            offer,
            roomId: newRoomId,
          }));
        }
      }, 500);

      const meetingResponse = await apiRequest("/api/meetings/start", {
        method: "POST",
        body: JSON.stringify({
          roomId: newRoomId,
          anchoredOnBlockchain: anchorOnBlockchain,
        }),
      });
      meetingIdRef.current = meetingResponse.meetingId;
    } catch (error) {
      console.error("Failed to start call:", error);
      setCallState("idle");
    }
  };

  const endCall = async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end", roomId }));
    }
    await handleCallEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        setParticipants(prev => prev.map(p => 
          p.id === "local" ? { ...p, isMuted: !audioTrack.enabled } : p
        ));
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
        setParticipants(prev => prev.map(p => 
          p.id === "local" ? { ...p, isVideoOn: videoTrack.enabled } : p
        ));
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        
        if (peerConnectionRef.current && localStreamRef.current) {
          const videoTrack = screenStream.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        }
        
        setIsScreenSharing(true);
        
        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
      } else {
        stopScreenShare();
      }
    } catch (error) {
      console.error("Failed to share screen:", error);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    if (peerConnectionRef.current && localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }
    }
    
    setIsScreenSharing(false);
  };

  const exportMeetingProof = async () => {
    try {
      const response = await apiRequest(`/api/meetings/${meetingIdRef.current}/export`, {
        method: "POST",
      });
      
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-proof-${meetingIdRef.current}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export meeting proof:", error);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hrs > 0 
      ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQualityIcon = (quality: NetworkQuality) => {
    return quality === "excellent" || quality === "good" ? 
      <Wifi className="w-3 h-3 text-green-500" /> : 
      <WifiOff className="w-3 h-3 text-red-500" />;
  };

  const getQualityColor = (quality: NetworkQuality) => {
    switch (quality) {
      case "excellent": return "text-green-500";
      case "good": return "text-blue-500";
      case "poor": return "text-yellow-500";
      case "critical": return "text-red-500";
      default: return "text-slate-500";
    }
  };

  if (callState === "idle") {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-purple-50/30 dark:from-slate-950 dark:to-purple-950/10">
        <Card className="w-full max-w-md p-8">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 via-purple-500 to-purple-400 flex items-center justify-center">
              <Phone className="w-12 h-12 text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-center mb-2 text-slate-900 dark:text-white">
            Video Call
          </h1>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-8">
            End-to-end encrypted video calls with blockchain anchoring
          </p>

          <div className="space-y-4">
            <AnchorToggle 
              checked={anchorOnBlockchain}
              onChange={setAnchorOnBlockchain}
              className="justify-center"
            />
            
            <Button
              data-testid="button-start-call"
              onClick={startCall}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12"
            >
              <Video className="w-5 h-5 mr-2" />
              Start Video Call
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (callState === "connecting") {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-purple-50/30 dark:from-slate-950 dark:to-purple-950/10">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <Phone className="w-20 h-20 mx-auto text-purple-600" />
          </div>
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">
            Connecting...
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Room ID: {roomId}
          </p>
        </div>
      </div>
    );
  }

  if (callState === "ended") {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-purple-50/30 dark:from-slate-950 dark:to-purple-950/10">
        <Card className="w-full max-w-md p-8">
          <PhoneOff className="w-20 h-20 mx-auto text-slate-400 dark:text-slate-600 mb-6" />
          <h2 className="text-2xl font-semibold text-center text-slate-900 dark:text-white mb-4">
            Call Ended
          </h2>
          <Button
            onClick={() => {
              setCallState("idle");
              setRoomId("");
              setParticipants([{ id: "local", name: "You", isMuted: false, isVideoOn: true, quality: "excellent" }]);
              setMetrics({ rtt: 0, jitter: 0, packetLoss: 0, bitrate: 0, codec: "opus", bandwidth: 0 });
            }}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Phone className="w-4 h-4 mr-2" />
            Start New Call
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <NotionLayout
      toolbar={
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
              callState === "connected" 
                ? "bg-green-50 dark:bg-green-900/20" 
                : "bg-yellow-50 dark:bg-yellow-900/20"
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                callState === "connected" ? "bg-green-500 animate-pulse" : "bg-yellow-500 animate-pulse"
              }`} />
              <span className={`text-sm font-medium ${
                callState === "connected" 
                  ? "text-green-700 dark:text-green-400" 
                  : "text-yellow-700 dark:text-yellow-400"
              }`}>
                {callState === "connected" ? "Connected" : "Connecting"}
              </span>
            </div>
            
            <E2EEBadge variant="shield" size="md" />
            
            {callState === "connected" && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatDuration(callDuration)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <AnchorToggle 
              checked={anchorOnBlockchain}
              onChange={setAnchorOnBlockchain}
              label="Anchor proof"
            />
          </div>
        </div>
      }
      
      sidebar={
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Participants ({participants.length})
            </h3>
          </div>

          {participants.map((participant) => (
            <div
              key={participant.id}
              data-testid={`participant-${participant.id}`}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                {participant.name[0]}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                  {participant.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {participant.isMuted ? (
                    <MicOff className="w-3 h-3 text-red-500" />
                  ) : (
                    <Mic className="w-3 h-3 text-green-500" />
                  )}
                  {participant.isVideoOn ? (
                    <Video className="w-3 h-3 text-green-500" />
                  ) : (
                    <VideoOff className="w-3 h-3 text-red-500" />
                  )}
                  {getQualityIcon(participant.quality)}
                </div>
              </div>
            </div>
          ))}
        </div>
      }
      
      editor={
        <div className="h-full flex flex-col">
          <div className="flex-1 p-6 relative">
            <div className="grid grid-cols-2 gap-4 h-full max-w-6xl mx-auto">
              {participants.slice(0, 6).map((participant, index) => (
                <div
                  key={participant.id}
                  data-testid={`video-tile-${participant.id}`}
                  className={`relative rounded-xl overflow-hidden bg-slate-900 shadow-lg transition-all duration-300 ${
                    activeSpeakerId === participant.id
                      ? 'ring-4 ring-purple-500 shadow-purple-500/50'
                      : 'hover:shadow-xl'
                  } ${index === 0 ? 'col-span-2' : ''}`}
                  style={{
                    background: activeSpeakerId === participant.id
                      ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(109, 40, 217, 0.1))'
                      : undefined
                  }}
                >
                  {participant.id === "local" && localVideoRef.current && (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover transform scale-x-[-1]"
                    />
                  )}
                  
                  {!participant.isVideoOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                      <div className="text-center">
                        <User className="w-20 h-20 mx-auto text-slate-600 mb-2" />
                        <p className="text-slate-400">{participant.name}</p>
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm">
                      <span className="text-white text-sm font-medium">
                        {participant.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {participant.isMuted && (
                        <div className="p-1.5 rounded-full bg-red-500/90 backdrop-blur-sm">
                          <MicOff className="w-4 h-4 text-white" />
                        </div>
                      )}
                      {!participant.isVideoOn && (
                        <div className="p-1.5 rounded-full bg-red-500/90 backdrop-blur-sm">
                          <VideoOff className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  {activeSpeakerId === participant.id && (
                    <div className="absolute top-3 right-3">
                      <div className="px-2 py-1 rounded-full bg-purple-500 text-white text-xs font-medium flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Speaking
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="flex items-center justify-center gap-3">
              <Button
                data-testid="button-mute"
                onClick={toggleMute}
                variant={isMuted ? "destructive" : "outline"}
                size="lg"
                className="rounded-full w-14 h-14"
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>

              <Button
                data-testid="button-video"
                onClick={toggleVideo}
                variant={!isVideoOn ? "destructive" : "outline"}
                size="lg"
                className="rounded-full w-14 h-14"
              >
                {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>

              <Button
                data-testid="button-screen-share"
                onClick={toggleScreenShare}
                variant={isScreenSharing ? "default" : "outline"}
                size="lg"
                className="rounded-full w-14 h-14"
              >
                {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </Button>

              <Button
                data-testid="button-end"
                onClick={endCall}
                variant="destructive"
                size="lg"
                className="rounded-full w-14 h-14 bg-red-500 hover:bg-red-600"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      }
      
      properties={
        <div className="p-4 space-y-6">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Live Telemetry
            </h3>
            
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Latency (RTT)</span>
                  <span data-testid="metrics-rtt" className={`text-sm font-mono font-semibold ${getQualityColor(networkQuality)}`}>
                    {metrics.rtt}ms
                  </span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      metrics.rtt < 50 ? 'bg-green-500' :
                      metrics.rtt < 150 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((metrics.rtt / 300) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Jitter</span>
                  <span data-testid="metrics-jitter" className="text-sm font-mono font-semibold text-slate-900 dark:text-white">
                    {metrics.jitter}ms
                  </span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      metrics.jitter < 20 ? 'bg-green-500' :
                      metrics.jitter < 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((metrics.jitter / 100) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Packet Loss</span>
                  <span data-testid="metrics-loss" className="text-sm font-mono font-semibold text-slate-900 dark:text-white">
                    {metrics.packetLoss}
                  </span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      metrics.packetLoss < 1 ? 'bg-green-500' :
                      metrics.packetLoss < 5 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((metrics.packetLoss / 20) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Bandwidth</span>
                  <span className="text-sm font-mono font-semibold text-slate-900 dark:text-white">
                    {metrics.bandwidth}kbps
                  </span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${Math.min((metrics.bandwidth / 2000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900 dark:text-white">Network Quality</span>
                <span className={`text-sm font-semibold ${getQualityColor(networkQuality)} uppercase`}>
                  {networkQuality}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Call Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Anchored</span>
                <span className={`font-medium ${anchorOnBlockchain ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500'}`}>
                  {anchorOnBlockchain ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Recording</span>
                <span className={`font-medium ${isRecording ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                  {isRecording ? 'Active' : 'Off'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Codec</span>
                <span className="font-medium text-slate-900 dark:text-white uppercase">
                  {metrics.codec}
                </span>
              </div>
            </div>
          </div>

          {anchorOnBlockchain && (
            <Button
              data-testid="button-export-proof"
              onClick={exportMeetingProof}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Meeting Proof
            </Button>
          )}

          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Call History</h3>
            <div className="space-y-2">
              {callHistory.map((call) => (
                <div
                  key={call.id}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {call.date}
                    </span>
                    <span className={`text-xs font-medium ${getQualityColor(call.quality)}`}>
                      {call.quality}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-sm font-mono text-slate-900 dark:text-white">
                      {call.duration}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
      
      sidebarWidth="280px"
      propertiesWidth="320px"
    />
  );
}

export default VoiceCall;

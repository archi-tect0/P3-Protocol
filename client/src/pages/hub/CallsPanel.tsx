import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  User,
  Loader2,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { SDK } from '@/lib/sdk';
import type { Call, CallType } from '@/lib/sdk/modules/calls';

export default function CallsPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [targetWallet, setTargetWallet] = useState('');
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const { data: activeCalls, isLoading } = useQuery({
    queryKey: ['/api/nexus/calls/active'],
    queryFn: () => SDK.calls.getActive(),
    refetchInterval: activeCall ? 5000 : false,
  });

  const startCallMutation = useMutation({
    mutationFn: ({ type, target }: { type: CallType; target: string }) =>
      SDK.calls.start(type, target),
    onSuccess: async (result) => {
      if (result.ok) {
        setActiveCall({
          id: result.callId,
          type: 'video',
          initiator: localStorage.getItem('walletAddress') || '',
          target: targetWallet,
          status: 'pending',
        });
        toast({ title: 'Call started', description: 'Connecting...' });
        await setupWebRTC(result.callId, result.offer);
      }
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Call failed', description: 'Could not start call' });
    },
  });

  const endCallMutation = useMutation({
    mutationFn: (callId: string) => SDK.calls.end(callId),
    onSuccess: () => {
      cleanupCall();
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/calls/active'] });
      toast({ title: 'Call ended' });
    },
  });

  const setupWebRTC = async (callId: string, _offer?: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          SDK.calls.signal(callId, { type: 'ice-candidate', candidate: event.candidate });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await SDK.calls.signal(callId, { type: 'offer', sdp: offer.sdp });
    } catch (error) {
      console.error('WebRTC setup failed:', error);
      toast({
        variant: 'destructive',
        title: 'Camera/Mic access failed',
        description: 'Please allow access to your camera and microphone.',
      });
    }
  };

  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setActiveCall(null);
    setIsMuted(false);
    setIsVideoEnabled(true);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const handleStartCall = (type: CallType) => {
    if (!targetWallet.trim()) {
      toast({ variant: 'destructive', title: 'Enter wallet address' });
      return;
    }
    startCallMutation.mutate({ type, target: targetWallet });
  };

  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, []);

  const callHistory = activeCalls?.calls || [];

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-green-900/10 via-transparent to-teal-900/10 pointer-events-none" />

      <div className="relative z-10 p-4 md:p-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            data-testid="button-back-hub"
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/launcher')}
            className="text-slate-400 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold text-white">Calls</h1>
        </div>

        {activeCall ? (
          <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 overflow-hidden">
            <div className="relative aspect-video bg-black">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                data-testid="video-remote"
              />
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-4 right-4 w-32 h-24 rounded-lg object-cover border-2 border-white/20"
                data-testid="video-local"
              />
              
              <div className="absolute top-4 left-4">
                <Badge className="bg-green-500/20 text-green-300 border-0">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
                  {activeCall.status === 'active' ? 'Connected' : 'Connecting...'}
                </Badge>
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <Button
                  data-testid="button-toggle-mute"
                  onClick={toggleMute}
                  className={`rounded-full w-12 h-12 ${isMuted ? 'bg-red-600' : 'bg-white/10'}`}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                <Button
                  data-testid="button-toggle-video"
                  onClick={toggleVideo}
                  className={`rounded-full w-12 h-12 ${!isVideoEnabled ? 'bg-red-600' : 'bg-white/10'}`}
                >
                  {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>
                <Button
                  data-testid="button-end-call"
                  onClick={() => endCallMutation.mutate(activeCall.id)}
                  disabled={endCallMutation.isPending}
                  className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-500"
                >
                  {endCallMutation.isPending ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <PhoneOff className="w-6 h-6" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6">
            <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-6">
              <h2 className="text-lg font-medium text-white mb-4">Start a Call</h2>
              <div className="flex gap-3 mb-6">
                <Input
                  data-testid="input-target-wallet"
                  placeholder="Enter wallet address..."
                  value={targetWallet}
                  onChange={(e) => setTargetWallet(e.target.value)}
                  className="bg-[#252525] border-white/5 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  data-testid="button-start-voice-call"
                  onClick={() => handleStartCall('voice')}
                  disabled={startCallMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500"
                >
                  {startCallMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Phone className="w-4 h-4 mr-2" />
                  )}
                  Voice Call
                </Button>
                <Button
                  data-testid="button-start-video-call"
                  onClick={() => handleStartCall('video')}
                  disabled={startCallMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
                >
                  {startCallMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Video className="w-4 h-4 mr-2" />
                  )}
                  Video Call
                </Button>
              </div>
            </Card>

            <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-6">
              <h2 className="text-lg font-medium text-white mb-4">Call History</h2>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                </div>
              ) : callHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Phone className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No recent calls</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {callHistory.map((call) => (
                    <div
                      key={call.id}
                      data-testid={`call-history-${call.id}`}
                      className="flex items-center gap-4 p-3 rounded-lg bg-white/5"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">
                          {call.target.slice(0, 6)}...{call.target.slice(-4)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {call.type === 'video' ? (
                            <Video className="w-3 h-3" />
                          ) : (
                            <Phone className="w-3 h-3" />
                          )}
                          <span className="capitalize">{call.type}</span>
                          <span>•</span>
                          <Clock className="w-3 h-3" />
                          <span>{call.status}</span>
                        </div>
                      </div>
                      <Badge
                        className={
                          call.status === 'active'
                            ? 'bg-green-500/20 text-green-300'
                            : call.status === 'ended'
                            ? 'bg-slate-500/20 text-slate-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                        }
                      >
                        {call.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

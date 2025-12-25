import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Video, 
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  Users,
  Copy,
  Check,
  Shield,
  Wifi,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getWalletAddress } from '../config';
import { ulid } from 'ulid';

type CallState = 'idle' | 'connecting' | 'connected' | 'ended';

export default function VideoMiniApp() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [walletAddress] = useState(getWalletAddress());
  const [callState, setCallState] = useState<CallState>('idle');
  const [roomId, setRoomId] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (callState === 'connected') {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (callState === 'idle') {
        setCallDuration(0);
      }
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callState]);

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      const newRoomId = ulid();
      setRoomId(newRoomId);
      setCallState('connecting');
      
      setTimeout(() => {
        setCallState('connected');
        toast({
          title: 'Call started',
          description: 'You can now share the room ID with others.',
        });
      }, 1500);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Camera access denied',
        description: 'Please allow camera and microphone access.',
      });
    }
  };

  const joinCall = async () => {
    if (!joinRoomId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Room ID required',
        description: 'Please enter a valid room ID.',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setRoomId(joinRoomId);
      setCallState('connecting');
      
      setTimeout(() => {
        setCallState('connected');
        toast({
          title: 'Joined call',
          description: 'You have successfully joined the room.',
        });
      }, 1500);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Camera access denied',
        description: 'Please allow camera and microphone access.',
      });
    }
  };

  const endCall = () => {
    cleanup();
    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setRoomId('');
    }, 2000);
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
        track.enabled = !isVideoOn;
      });
      setIsVideoOn(!isVideoOn);
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied!',
      description: 'Room ID copied to clipboard.',
    });
  };

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <Video className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-slate-400 mb-6">
            You need to connect your wallet from the launcher to use video calls.
          </p>
          <Button
            onClick={() => setLocation('/launcher')}
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500"
          >
            Go to Launcher
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-transparent to-blue-900/10 pointer-events-none" />
      
      <div className="relative z-10">
        <header className="p-4 border-b border-white/5 flex items-center justify-between bg-[#1a1a1a]/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Button
              data-testid="button-back-launcher"
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/launcher')}
              className="text-slate-400 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-white">Video Calls</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-300 border-0">
              <Shield className="w-3 h-3 mr-1" />
              E2EE
            </Badge>
            {callState === 'connected' && (
              <>
                <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-0">
                  <Wifi className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
                <Badge variant="secondary" className="bg-slate-500/20 text-slate-300 border-0">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDuration(callDuration)}
                </Badge>
              </>
            )}
          </div>
        </header>

        <div className="p-6">
          {callState === 'idle' && (
            <div className="max-w-2xl mx-auto">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mb-4">
                    <Video className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Start a Call</h3>
                  <p className="text-sm text-slate-400 mb-6">
                    Create a new room and invite others to join with a unique room ID.
                  </p>
                  <Button
                    data-testid="button-start-call"
                    onClick={startCall}
                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500"
                  >
                    Start New Call
                  </Button>
                </Card>

                <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-4">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Join a Call</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Enter a room ID to join an existing call.
                  </p>
                  <div className="space-y-3">
                    <Input
                      data-testid="input-room-id"
                      placeholder="Enter room ID..."
                      value={joinRoomId}
                      onChange={(e) => setJoinRoomId(e.target.value)}
                      className="bg-[#252525] border-white/5 text-white placeholder:text-slate-500"
                    />
                    <Button
                      data-testid="button-join-call"
                      onClick={joinCall}
                      className="w-full bg-purple-600 hover:bg-purple-500"
                    >
                      Join Call
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {(callState === 'connecting' || callState === 'connected' || callState === 'ended') && (
            <div className="max-w-5xl mx-auto">
              <div className="relative aspect-video bg-[#1a1a1a] rounded-2xl overflow-hidden mb-6">
                {callState === 'connecting' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto mb-4" />
                      <p className="text-white">Connecting...</p>
                    </div>
                  </div>
                )}
                
                {callState === 'ended' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <PhoneOff className="w-16 h-16 text-red-400 mx-auto mb-4" />
                      <p className="text-white text-xl">Call Ended</p>
                      <p className="text-slate-400">Duration: {formatDuration(callDuration)}</p>
                    </div>
                  </div>
                )}

                {callState === 'connected' && (
                  <>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover bg-slate-800"
                    />
                    <div className="absolute bottom-4 right-4 w-48 aspect-video rounded-xl overflow-hidden border-2 border-white/20 shadow-xl">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${!isVideoOn ? 'hidden' : ''}`}
                      />
                      {!isVideoOn && (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                          <VideoOff className="w-8 h-8 text-slate-500" />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {roomId && callState === 'connected' && (
                <div className="flex items-center justify-center gap-2 mb-6">
                  <span className="text-slate-400 text-sm">Room ID:</span>
                  <code className="px-3 py-1 bg-[#252525] rounded-lg text-indigo-300 font-mono text-sm">
                    {roomId}
                  </code>
                  <Button
                    data-testid="button-copy-room-id"
                    variant="ghost"
                    size="sm"
                    onClick={copyRoomId}
                    className="text-slate-400 hover:text-white"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              )}

              {callState === 'connected' && (
                <div className="flex items-center justify-center gap-4">
                  <Button
                    data-testid="button-toggle-mute"
                    variant="ghost"
                    size="lg"
                    onClick={toggleMute}
                    className={`rounded-full w-14 h-14 ${
                      isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </Button>
                  <Button
                    data-testid="button-toggle-video"
                    variant="ghost"
                    size="lg"
                    onClick={toggleVideo}
                    className={`rounded-full w-14 h-14 ${
                      !isVideoOn ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                  </Button>
                  <Button
                    data-testid="button-toggle-screen"
                    variant="ghost"
                    size="lg"
                    onClick={() => setIsScreenSharing(!isScreenSharing)}
                    className={`rounded-full w-14 h-14 ${
                      isScreenSharing ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                  </Button>
                  <Button
                    data-testid="button-end-call"
                    size="lg"
                    onClick={endCall}
                    className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-500 text-white"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

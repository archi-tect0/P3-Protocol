export function preferCodecs(pc: RTCPeerConnection) {
  pc.getTransceivers().forEach(t => {
    const caps = RTCRtpReceiver.getCapabilities(t.receiver.track?.kind || 'video');
    if (!caps) return;
    const preferred = caps.codecs.filter(c => 
      c.mimeType === 'video/VP9' || c.mimeType === 'video/H264' || c.mimeType === 'audio/opus'
    );
    if (preferred.length) t.setCodecPreferences(preferred);
  });
}

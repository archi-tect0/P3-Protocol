export function setBitrate(sender: RTCRtpSender, kbps: number) {
  const params = sender.getParameters();
  params.encodings = [{ maxBitrate: kbps * 1000 }];
  sender.setParameters(params);
}

export function throttleOnCongestion(sender: RTCRtpSender, level: 'mild' | 'hard') {
  const params = sender.getParameters();
  const enc = params.encodings?.[0] || {};
  enc.maxBitrate = level === 'mild' ? 500000 : 250000;
  enc.scaleResolutionDownBy = level === 'mild' ? 1.5 : 2.0;
  params.encodings = [enc];
  sender.setParameters(params);
}

export function monitorNetwork(pc: RTCPeerConnection, onThrottle: (level: 'mild' | 'hard') => void) {
  setInterval(async () => {
    const stats = await pc.getStats();
    let outbound: any;
    stats.forEach(s => { if (s.type === 'outbound-rtp' && s.kind === 'video') outbound = s; });
    if (!outbound) return;
    if (outbound.nackCount > 50) onThrottle('mild');
    if (outbound.nackCount > 200) onThrottle('hard');
  }, 3000);
}

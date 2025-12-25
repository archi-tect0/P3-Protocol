export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302'] },
    { urls: ['turn:turn-us.p3protocol.io:3478'], username: 'p3', credential: import.meta.env.VITE_TURN_US || '' },
    { urls: ['turn:turn-eu.p3protocol.io:3478'], username: 'p3', credential: import.meta.env.VITE_TURN_EU || '' },
    { urls: ['turn:turn-ap.p3protocol.io:3478'], username: 'p3', credential: import.meta.env.VITE_TURN_AP || '' }
  ]
};

export const mediaConstraints: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }
};

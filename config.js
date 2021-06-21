module.exports = {
  httpPort: 80,
  mediacodecs: [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: "video",
      mimeType: "video/VP8",
      clockRate: 90000,
      parameters: {
        //                'x-google-start-bitrate': 1000
      },
    },
    {
      kind: "video",
      mimeType: "video/h264",
      clockRate: 90000,
      parameters: {
        "packetization-mode": 1,
        "profile-level-id": "4d0032",
        "level-asymmetry-allowed": 1,
        //						  'x-google-start-bitrate'  : 1000
      },
    },
    {
      kind: "video",
      mimeType: "video/h264",
      clockRate: 90000,
      parameters: {
        "packetization-mode": 1,
        "profile-level-id": "42e01f",
        "level-asymmetry-allowed": 1,
        //						  'x-google-start-bitrate'  : 1000
      },
    },
  ],
  webRtcConfig: {
    listenIps: [
      { ip: "127.0.0.1", announcedIp: null },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true
  }
};

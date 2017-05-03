# Decode Studio Signaling Server

The signaling server for Decode Studio. WebRTC peer connections need at minimum a service that can perform signaling. The signal server facilitates the process of peer discovery. It contains the state for each room including which users have connected and when a new user connects the signaling server tells that user which users have already connected. From their the user will start sending “signals” to the other users in the room in order to establish a connection.

The code that [handles signals in `PeersMesh`][] illustrates the receiving end of the signal process. Look around that file for calls to `signals.send()` to see how signals are generated and sent.

[handles signals in `PeersMesh`]: https://github.com/calebmer/decode-universe/blob/aedcf2c50c7542e002f8ccda1541ef870344fd87/projects/studio-core/src/rtc/PeersMesh.ts#L331-L375

## Development

To start a development instance of `studio-signal-server` run the following:

```bash
./scripts/dev
```

A development instance of `studio-signal-server` is currently required when developing for `studio-desktop` and `studio-web`.

import { SignalClient } from '@decode/studio-signal-exchange/client';

export class PeerMesh {
  private createPeer(address: string): RTCPeerConnection {
    const peer = new RTCPeerConnection({});
    return peer;
  }
}

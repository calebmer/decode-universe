import * as React from 'react';
import { PeerMesh } from './webrtc/PeerMesh';

export class StudioRoom extends React.Component<{}, {}> {
  render() {
    return (
      <PeerMesh
        roomName="hello world"
        render={addresses => (
          <ul>
            {addresses.map(address => (
              <li key={address}>{address}</li>
            ))}
          </ul>
        )}
      />
    );
  }
}

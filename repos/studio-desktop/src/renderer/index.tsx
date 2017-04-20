import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { PeersMesh } from '@decode/studio-ui';
import { MediaStreamsRecorder } from './media/MediaStreamsRecorder';
import { GuestPeer } from './rtc/GuestPeer';
import { App } from './App';

const mesh = new PeersMesh({
  roomName: 'hello world',
  localState: {
    name: '',
  },
  // We assume that all of the peers we connect to as the studio desktop client
  // are guests and not hosts! It is fairly safe to make this assumption because
  // the desktop client provides no way for a user to join an arbitrary room.
  // Each desktop client will create a UUID for each room that it hosts. The
  // only rooms that a desktop client can connect to are the rooms whose UUIDs
  // it generated. This means unless there is a UUID collision we should not
  // have to worry about two hosts in a single room.
  createPeerInstance: config => new GuestPeer(config),
});

// Expose the mesh instance for debugging in development.
if (DEV) {
  (window as any).mesh = mesh;
}

mesh.connect().catch(error => console.error(error));

const recorder = new MediaStreamsRecorder();

ReactDOM.render(
  <App
    mesh={mesh}
    onUserAudioStream={(stream, previousStream) => {
      if (previousStream !== null) {
        mesh.removeLocalStream(previousStream);
        recorder.removeStream(previousStream);
      }
      mesh.addLocalStream(stream);
      recorder.addStream(stream);
    }}
    onUserAudioError={(error, previousStream) => {
      console.error(error);
      if (previousStream !== null) {
        mesh.removeLocalStream(previousStream);
        recorder.removeStream(previousStream);
      }
    }}
    onStartRecording={() => recorder.start()}
    onStopRecording={() => recorder.stop()}
  />,
  document.getElementById('root'),
);

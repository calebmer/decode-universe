import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { HostPeersMesh } from './rtc/HostPeersMesh';
import { App } from './App';

const mesh = new HostPeersMesh({
  roomName: 'hello world',
  localState: {
    name: '',
  },
});

// Expose the mesh instance for debugging in development.
if (DEV) {
  (window as any).mesh = mesh;
}

mesh.connect().catch(error => console.error(error));

ReactDOM.render(
  <App
    mesh={mesh}
    onUserAudioStream={stream => mesh.setLocalStream(stream)}
    onUserAudioError={(error) => {
      console.error(error);
      mesh.unsetLocalStream();
    }}
    onStartRecording={() => {
      mesh.startRecording().catch(error => console.error(error));
    }}
    onStopRecording={() => mesh.stopRecording()}
    onExport={() => console.log('export!')}
  />,
  document.getElementById('root'),
);

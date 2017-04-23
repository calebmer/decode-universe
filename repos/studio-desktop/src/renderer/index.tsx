import * as fs from 'fs';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { HostPeersMesh } from './rtc/HostPeersMesh';
import { ExportRecording } from './rtc/audio/ExportRecording';
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
    onStopRecording={() => {
      mesh.stopRecording().catch(error => console.error(error));
    }}
    onExport={() => {
      const recordingsDirectory = '/Users/calebmer/Desktop/recordings';
      for (const name of fs.readdirSync(recordingsDirectory)) {
        if (name.startsWith('.')) {
          continue;
        }
        ExportRecording.exportWAV(`${recordingsDirectory}/${name}`)
          .catch(error => console.error(error));
      }
    }}
  />,
  document.getElementById('root'),
);

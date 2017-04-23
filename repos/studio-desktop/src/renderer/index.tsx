import * as React from 'react';
import * as ReactDOM from 'react-dom';
// import { RawAudio } from './audio/RawAudio';
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

// const recordingsDirectory = '/Users/calebmer/Desktop/recordings';

// RawAudio.saveRecordingStreams(
//   recordingsDirectory,
//   mesh.recordingStreams,
// ).subscribe({
//   error: error => console.error(error),
// });

ReactDOM.render(
  <App
    mesh={mesh}
    onUserAudioStream={(stream, previousStream) => {
      mesh.addLocalStream(stream);
      if (previousStream !== null) {
        mesh.removeLocalStream(previousStream);
      }
    }}
    onUserAudioError={(error, previousStream) => {
      console.error(error);
      if (previousStream !== null) {
        mesh.removeLocalStream(previousStream);
      }
    }}
    onStartRecording={() => {
      mesh.startRecording().catch(error => console.error(error));
    }}
    onStopRecording={() => mesh.stopRecording()}
    onExport={() => console.log('export!')}
  />,
  document.getElementById('root'),
);

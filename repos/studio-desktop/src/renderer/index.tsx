import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { PeersMesh } from '@decode/studio-ui';
import { MediaStreamsRecorder } from './media/MediaStreamsRecorder';
import { App } from './App';

const mesh = new PeersMesh({ roomName: 'hello world' });

mesh.connect().catch(error => console.error(error));

const recorder = new MediaStreamsRecorder();

ReactDOM.render(
  <App
    mesh={mesh}
    onUserAudioStream={(stream, previousStream) => {
      if (previousStream !== null) {
        mesh.removeStream(previousStream);
        recorder.removeStream(previousStream);
      }
      mesh.addStream(stream);
      recorder.addStream(stream);
    }}
    onUserAudioError={(error, previousStream) => {
      console.error(error);
      if (previousStream !== null) {
        mesh.removeStream(previousStream);
        recorder.removeStream(previousStream);
      }
    }}
    onStartRecording={() => recorder.start()}
    onStopRecording={() => recorder.stop()}
  />,
  document.getElementById('root'),
);

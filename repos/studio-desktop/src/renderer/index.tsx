import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Set } from 'immutable';
import { BehaviorSubject } from 'rxjs';
import { PeersMesh } from '@decode/studio-ui';
import { MediaStreamsRecorder } from './media/MediaStreamsRecorder';
import { App } from './App';

const userStream = new BehaviorSubject<MediaStream | null>(null);

const mesh = new PeersMesh({
  roomName: 'hello world',
  localStreams: userStream.map((stream): Set<MediaStream> =>
    stream === null ? Set<MediaStream>() : Set([stream])
  ),
});

mesh.connect().catch(error => console.error(error));

const recorder = new MediaStreamsRecorder();

ReactDOM.render(
  <App
    mesh={mesh}
    onUserAudioStream={(stream, previousStream) => {
      userStream.next(stream);
      if (previousStream !== null) {
        recorder.removeStream(previousStream);
      }
      recorder.addStream(stream);
    }}
    onUserAudioError={error => {
      console.error(error);
      userStream.next(null);
    }}
    onStartRecording={() => recorder.start()}
    onStopRecording={() => recorder.stop()}
  />,
  document.getElementById('root'),
);

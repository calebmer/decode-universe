import { Stream } from 'xstream';
import * as React from 'react';
import ReactStream from '~/studio/core/stream/ReactStream';
import RecordingStorage from '../storage/RecordingStorage';

export default function DirectoryExportProgress({
  recording,
  progress,
}: {
  recording: RecordingStorage;
  progress: Stream<number>;
}) {
  return (
    <div>
      <p>
        {new Date(recording.startedAt).toDateString()}
      </p>
      {ReactStream.render(progress, progress =>
        <div
          style={{
            width: `${progress * 100}%`,
            height: '1em',
            backgroundColor: 'red',
          }}
        />,
      )}
    </div>
  );
}

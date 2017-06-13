import { Stream } from 'xstream';
import * as React from 'react';
import { ReactStream } from '@decode/studio-core';
import { RecordingStorage } from '../shared/storage/RecordingStorage';

export const DirectoryExportProgress = ({
  recording,
  progress,
}: {
  recording: RecordingStorage;
  progress: Stream<number>;
}) =>
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
  </div>;

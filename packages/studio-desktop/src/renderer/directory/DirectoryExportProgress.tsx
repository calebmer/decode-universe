import { Observable } from 'rxjs';
import * as React from 'react';
import { ReactObservable } from '@decode/studio-core';
import { RecordingStorage } from '../shared/storage/RecordingStorage';

export const DirectoryExportProgress = ({
  recording,
  progress,
}: {
  recording: RecordingStorage;
  progress: Observable<number>;
}) =>
  <div>
    <p>
      {new Date(recording.startedAt).toDateString()}
    </p>
    {ReactObservable.render(progress, progress =>
      <div
        style={{
          width: `${progress * 100}%`,
          height: '1em',
          backgroundColor: 'red',
        }}
      />,
    )}
  </div>;

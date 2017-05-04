import * as React from 'react';
import { Storage } from '../shared/storage/Storage';
import { DirectoryRecording } from './DirectoryRecording';

export const Directory = ({
  storage,
  onCreateRoom,
}: {
  storage: Storage,
  onCreateRoom: () => void,
}) => (
  <div>
    <p>
      <button onClick={onCreateRoom}>
        Start Studio Sesson
      </button>
    </p>
    <ul>
      {storage.directory.getAllRecordings()
        // Sort so that the latest recordings are at the top.
        .sort((a, b) => b.recording.startedAt - a.recording.startedAt)
        .map(({ id, recording }) => (
          <li key={id}>
            <DirectoryRecording
              id={id}
              storage={recording}
            />
          </li>
        ))}
    </ul>
  </div>
);

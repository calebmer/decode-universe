import * as React from 'react';
import { ReactPromise } from '@decode/jsutils/react';
import { RecordingStorage } from '../shared/storage/RecordingStorage';

export const DirectoryRecording = ({
  id,
  storage,
  onExport,
}: {
  id: string,
  storage: RecordingStorage,
  onExport: (storage: RecordingStorage) => void,
}) => (
  <div>
    <div>
      <span>{id}</span>
      {' '}
      <button onClick={() => onExport(storage)}>
        Export
      </button>
      {' '}
      <button>
        Delete
      </button>
    </div>
    <ul>
      <li>Started: {new Date(storage.startedAt).toString()}</li>
      <li>
        Duration:{' '}
        {ReactPromise.render(
          storage.getSecondsLength(),
          seconds => <span>{Math.round(seconds * 100) / 100}s</span>,
        )}
      </li>
      <li>
        <span>Recorders:</span>
        <ul>
          {Array.from(storage.getAllRecorders()).map(([id, recorder]) => (
            <li key={id}>
              <span>{recorder.name}</span>
              <ul>
                <li>Delta: +{recorder.startedAtDelta}ms</li>
                <li>Sample Rate: {recorder.sampleRate}</li>
                <li>
                  Duration:{' '}
                  {ReactPromise.render(
                    recorder.getSampleLength(),
                    sampleLength => (
                      <span>
                        {Math.round((sampleLength / recorder.sampleRate) * 100) / 100}s
                      </span>
                    ),
                  )}
                </li>
                <li>
                  Bytes:{' '}
                  {ReactPromise.render(
                    recorder.getByteLength(),
                    byteLength => <span>{byteLength}</span>,
                  )}
                </li>
              </ul>
            </li>
          ))}
        </ul>
      </li>
    </ul>
  </div>
);

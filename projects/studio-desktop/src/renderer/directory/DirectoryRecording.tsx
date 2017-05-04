import * as React from 'react';
import { ReactPromise } from '@decode/jsutils/react';
import { RecordingStorage } from '../shared/storage/RecordingStorage';

export const DirectoryRecording = ({
  id,
  storage,
}: {
  id: string,
  storage: RecordingStorage,
}) => (
  <div>
    <span>{id}</span>{' '}
    <button>Export WAV</button>{' '}
    <button>Delete</button>
    <ul>
      <li>Started At: {new Date(storage.startedAt).toISOString()}</li>
      <li>
        Duration:{' '}
        {ReactPromise.render(
          storage.getSecondsLength(),
          seconds => <span>{Math.round(seconds * 100) / 100}s</span>
        )}
      </li>
      <li>
        <span>Recorders:</span>
        <ul>
          {storage.getAllRecorders().map(({
            id,
            name,
            startedAtDelta,
            sampleRate,
            storage,
          }) => (
            <li key={id}>
              <span>{name}</span>
              <ul>
                <li>Delta: +{startedAtDelta}ms</li>
                <li>Sample Rate: {sampleRate}</li>
                <li>
                  Duration:{' '}
                  {ReactPromise.render(
                    storage.getSampleLength(),
                    sampleLength => (
                      <span>
                        {Math.round((sampleLength / sampleRate) * 100) / 100}s
                      </span>
                    )
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

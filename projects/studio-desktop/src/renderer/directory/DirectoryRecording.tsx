import * as React from 'react';
import { ReactPromise } from '@decode/react-utils';
import { RecordingStorage } from '../shared/storage/RecordingStorage';

export const DirectoryRecording = ({
  id,
  recording,
  isExporting,
  onExport,
}: {
  id: string;
  recording: RecordingStorage;
  isExporting: boolean;
  onExport: (recording: RecordingStorage) => void;
}) =>
  <div>
    <div>
      <span>{id}</span>
      {' '}
      <button disabled={isExporting} onClick={() => onExport(recording)}>
        Export
      </button>
    </div>
    <ul>
      <li>Started: {new Date(recording.startedAt).toString()}</li>
      <li>
        Duration:{' '}
        {ReactPromise.render(recording.getSecondsLength(), seconds =>
          <span>{Math.round(seconds * 100) / 100}s</span>,
        )}
      </li>
      <li>
        <span>Recorders:</span>
        <ul>
          {Array.from(recording.getAllRecorders()).map(([id, recorder]) =>
            <li key={id}>
              <span>{recorder.name}</span>
              <ul>
                <li>Delta: +{recorder.startedAtDelta}ms</li>
                <li>Sample Rate: {recorder.sampleRate}</li>
                <li>
                  Duration:{' '}
                  {ReactPromise.render(
                    recorder.getSampleLength(),
                    sampleLength =>
                      <span>
                        {Math.round(sampleLength / recorder.sampleRate * 100) /
                          100}s
                      </span>,
                  )}
                </li>
                <li>
                  Bytes:{' '}
                  {ReactPromise.render(recorder.getByteLength(), byteLength =>
                    <span>{byteLength}</span>,
                  )}
                </li>
              </ul>
            </li>,
          )}
        </ul>
      </li>
    </ul>
  </div>;

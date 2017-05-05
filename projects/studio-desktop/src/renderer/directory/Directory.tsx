import { remote } from 'electron';
import { OrderedMap } from 'immutable';
import { Observable } from 'rxjs';
import * as React from 'react';
import { Storage } from '../shared/storage/Storage';
import { RecordingStorage } from '../shared/storage/RecordingStorage';
import { FileSystemUtils as fs } from '../shared/storage/FileSystemUtils';
import { RecordingExporter } from '../shared/storage/RecordingExporter';
import { DirectoryRecording } from './DirectoryRecording';
import { DirectoryExportProgress } from './DirectoryExportProgress';

type Props = {
  storage: Storage,
  onCreateRoom: () => void,
};

type State = {
  exportProgresses: OrderedMap<RecordingStorage, Observable<number>>,
};

export class Directory extends React.PureComponent<Props, State> {
  state: State = {
    exportProgresses: OrderedMap<RecordingStorage, Observable<number>>(),
  };

  private handleExport = (recording: RecordingStorage) => {
    // If we are already exporting this storage then return.
    if (this.state.exportProgresses.has(recording)) {
      return;
    }
    // While we do not yet have a progress observable we still want to reserve
    // the space so that we can’t start another export for this storage.
    this.setState(({ exportProgresses }: State): Partial<State> => ({
      exportProgresses: exportProgresses.set(recording, Observable.never()),
    }));
    // Start the export process.
    startExport(recording)
      .then(progress => {
        // If we got no progress that means the export was cancelled.
        if (progress === undefined) {
          return;
        }
        // Set the actual progress observable in state.
        this.setState(({ exportProgresses }: State): Partial<State> => ({
          exportProgresses: exportProgresses.set(recording, progress),
        }));
        return new Promise<void>((resolve, reject) => {
          progress.subscribe({
            complete: () => resolve(),
            error: error => reject(error),
          });
        });
      })
      // Catch any errors and handle them.
      //
      // TODO: Better error handling.
      .catch(error => console.error(error))
      // Finally delete the export progress entry for this storage.
      .then(() => {
        // Set the actual progress observable in state.
        this.setState(({ exportProgresses }: State): Partial<State> => ({
          exportProgresses: exportProgresses.delete(recording),
        }));
      });
  };

  render() {
    const { storage, onCreateRoom } = this.props;
    const { exportProgresses } = this.state;
    return (
      <div>
        <p>
          <button onClick={onCreateRoom}>
            Start Studio Sesson
          </button>
        </p>
        {exportProgresses.size > 0 && (
          <ul>
            {exportProgresses.map((progress, recording) => (
              <li key={recording.directoryPath}>
                <DirectoryExportProgress
                  recording={recording}
                  progress={progress}
                />
              </li>
            )).toArray()}
          </ul>
        )}
        <ul>
          {storage.directory.getAllRecordings()
            // Sort so that the latest recordings are at the top.
            .sort((a, b) => b.recording.startedAt - a.recording.startedAt)
            .map(({ id, recording }) => (
              <li key={id}>
                <DirectoryRecording
                  id={id}
                  recording={recording}
                  isExporting={exportProgresses.has(recording)}
                  onExport={this.handleExport}
                />
              </li>
            ))}
        </ul>
      </div>
    );
  }
}

async function startExport(recording: RecordingStorage): Promise<Observable<number> | void> {
  // Get a directory from the user using a dialog.
  const exportDirectoryPath = await new Promise<string | undefined>(resolve => {
    // Show an open dialog. The user will select a directory and we will then
    // export the recording to the directory they selected.
    remote.dialog.showOpenDialog(
      // We want the dialog to open in the current widnow.
      remote.getCurrentWindow(),
      // Even though this is an “open” dialog we want to make sure the user
      // knows that we are exporting! Do everything possible to ensure that the
      // user knows this fact.
      {
        title: 'Export Recording',
        buttonLabel: 'Export',
        properties: ['openDirectory', 'createDirectory'],
      },
      // Resolve our promise in the callback with the first file path or
      // undefined if no file paths were provided.
      filePaths => resolve((filePaths || [])[0]),
    );
  });
  // If the user cancelled then we want to stop exporting.
  if (exportDirectoryPath === undefined) {
    return;
  }
  // Get all of the file names in the directory.
  const fileNames = await fs.readDirectory(exportDirectoryPath);
  // Get all of the file names we are going to export.
  const exportFileNames = RecordingExporter.getExportFileNames(recording);
  // For all of the file names in the directory...
  for (const fileName of fileNames) {
    // If this file name is in our set of file names that we will export then we
    // know we will be overwriting some file in the directory. Warn the user.
    if (exportFileNames.has(fileName)) {
      const cancel = await new Promise<boolean>(resolve => {
        // Show a message box and wait for a response.
        remote.dialog.showMessageBox(
          // Show the box on our current window.
          remote.getCurrentWindow(),
          {
            type: 'question',
            title: 'Overwrite Existing Files',
            message:
              'Some existing files will be overwritten. Are you sure you ' +
              'want to continue?',
            buttons: ['Overwrite', 'Cancel'],
            defaultId: 0,
            cancelId: 1,
          },
          // If the user pressed the cancel button then we want to resolve to
          // true.
          response => resolve(response === 1),
        );
      });
      // If the user cancelled then we want to stop exporting. Otherwise we just
      // want to break out of this loop.
      if (cancel === true) {
        return;
      } else {
        break;
      }
    }
  }
  // Actually perform the export and get an observable that represents the
  // export progress.
  const progress = await RecordingExporter.export(recording, exportDirectoryPath);
  // Return the progress observable.
  return progress;
}

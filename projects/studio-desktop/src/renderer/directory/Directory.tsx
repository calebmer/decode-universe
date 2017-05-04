import * as React from 'react';
import { remote } from 'electron';
import { Storage } from '../shared/storage/Storage';
import { RecordingStorage } from '../shared/storage/RecordingStorage';
import { FileSystemUtils as fs } from '../shared/storage/FileSystemUtils';
import { RecordingExporter } from '../shared/storage/RecordingExporter';
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
              onExport={handleExport}
            />
          </li>
        ))}
    </ul>
  </div>
);

function handleExport(storage: RecordingStorage): void {
  handleExportAsync(storage)
    .catch(error => console.error(error));
}

async function handleExportAsync(storage: RecordingStorage): Promise<void> {
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
  const exportFileNames = RecordingExporter.getExportFileNames(storage);
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
  // Actually perform the export.
  await RecordingExporter.export(storage, exportDirectoryPath);
}

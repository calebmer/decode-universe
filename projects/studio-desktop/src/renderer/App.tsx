import * as path from 'path';
import { remote } from 'electron';
import { v4 as uuid } from 'uuid';
import * as React from 'react';
import { FileSystemUtils as fs } from './shared/storage/FileSystemUtils';
import { Storage } from './shared/storage/Storage';
import { Directory } from './directory/Directory';
import { StudioRoom } from './studio/StudioRoom';

/**
 * Opens a `Storage` instance at a root directory that is selected exclusively
 * by this function in the application’s system data directory.
 */
async function openStorage(): Promise<Storage> {
  // Create the directory path to where we will store files generated *directly*
  // by our application and not indirectly by Electron. Electron already stores
  // some data in the `userData` directory, and so we nest the data for our
  // storage in the “Decode Storage” folder. This name was picked to include
  // “Decode” to avoid naming collisions both now and in the future.
  //
  // If we are in development we also add a `-dev` suffix so that files we
  // record in development don’t mix with production files.
  const storageDirectoryPath = path.join(
    remote.app.getPath('userData'),
    'Decode Storage' + (DEV ? '-dev' : ''),
  );
  // Make sure the directory exists. If it does not the create it.
  if (!await fs.directoryExists(storageDirectoryPath)) {
    await fs.createDirectory(storageDirectoryPath);
  }
  // Open an instance of `Storage`.
  return await Storage.open(storageDirectoryPath);
}

type State = {
  storage: Storage | null;
  roomName: string | null;
};

export class App extends React.PureComponent<{}, State> {
  state: State = {
    storage: null,
    roomName: INITIAL_ROOM,
  };

  componentDidMount() {
    // When this component mounts the first thing we want to do is open an
    // instance of `Storage`.
    openStorage()
      .then(storage => this.setState({ storage }))
      // TODO: Better error handling...
      .catch(error => console.error(error));
  }

  private handleCreateRoom = () => {
    // If we are in development then just join the room with the name `dev`.
    // Otherwise we want to generate a random id.
    this.setState({ roomName: uuid() });
  };

  private handleGoToDirectory = () => {
    this.setState({ roomName: null });
  };

  render() {
    const { storage, roomName } = this.state;
    if (storage === null) {
      return null;
    }
    return roomName === null
      ? <Directory storage={storage} onCreateRoom={this.handleCreateRoom} />
      : <StudioRoom
          roomName={roomName}
          storage={storage}
          onBack={this.handleGoToDirectory}
        />;
  }
}

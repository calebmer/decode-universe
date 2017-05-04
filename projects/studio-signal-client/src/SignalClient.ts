import * as createDebugger from 'debug';
import * as socketIO from 'socket.io-client';
import { EventEmitter } from '@decode/jsutils';
import {
  JoinRequestMessage,
  JoinResponseMessage,
  SignalOutgoingMessage,
  SignalIncomingMessage,
  Signal,
} from './MessageTypes';

const debug = createDebugger('@decode/studio-signal-client');

export class SignalClient extends EventEmitter<SignalClient.EventMap> {
  /**
   * The name of the room which we are connected to.
   */
  public readonly roomName: string;

  /**
   * The socket.io socket for this signalign client.
   */
  private socket: SocketIOClient.Socket | null;

  constructor({
    roomName,
  }: {
    roomName: string,
  }) {
    super();
    this.roomName = roomName;
    this.socket = null;
  }

  /**
   * Disconnect the underlying socket. We will receive no more signals after
   * this method has been called.
   *
   * If the socket has already closed then this is a noop.
   */
  public close(): void {
    if (this.socket !== null) {
      this.socket.close();
      this.socket = null;
    }
    // Clear all of the event listeners.
    this.clearAllListeners();
  }

  /**
   * Connects the client to the room that we specified in the constructor for
   * `SignalClient`. This method returns all the other socket ids so that we can
   * start establishing peers if wanted.
   *
   * If a socket is already connected then an error will be thrown.
   */
  public async connect(): Promise<Array<string>> {
    if (this.socket !== null) {
      throw new Error('Socket is already connected.');
    }
    // Create the socket.
    const socket = this.socket = socketIO('http://localhost:2000');
    // When the socket has fully connected, do some stuff.
    socket.on('connect', () => {
      debug(`Connected to signal exchange as ${socket.id}`);
    });
    // When we get a signal from the socket we want to let our listener know.
    socket.on('signal', ({ from, signal }: SignalIncomingMessage) => {
      debug(`Received ${signal.type} from ${from}`);
      this.emit('signal', { from, signal });
    });
    // The message we will send to join the room.
    const request: JoinRequestMessage = { roomName: this.roomName };
    // Get the response by sending our join message to the server.
    const response = await new Promise<JoinResponseMessage>(resolve => {
      socket.emit('join', request, (response: any) => resolve(response));
    });
    // Return the other socket ids in the room we just joined.
    return response.otherSocketIDs;
  }

  /**
   * Sends a signal to the designated recipient.
   *
   * If a socket has not been connected then an error will be thrown.
   */
  public send(to: string, signal: Signal): void {
    if (this.socket === null) {
      throw new Error('Socket has not been connected.');
    }
    const message: SignalOutgoingMessage = { to, signal };
    this.socket.emit('signal', message);
    debug(`Sent ${signal.type} to ${to}`);
  }
}

export namespace SignalClient {
  export interface EventMap {
    signal: { from: string, signal: Signal };
  }
}

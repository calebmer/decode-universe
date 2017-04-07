import socketIO = require('socket.io-client');
import {
  JoinRequestMessage,
  JoinResponseMessage,
  SignalOutgoingMessage,
  SignalIncomingMessage,
  Signal,
} from '../shared/MessageTypes';

export class SignalClient {
  /**
   * The name of the room which we are connected to.
   */
  private readonly roomName: string;

  /**
   * The socket.io socket for this signalign client.
   */
  private readonly socket: SocketIOClient.Socket;

  /**
   * Whether or not we have joined the room that we specified yet.
   */
  private hasConnected: boolean;

  constructor({
    roomName,
    onSignal,
  }: {
    roomName: string,
    onSignal: (from: string, signal: Signal) => void,
  }) {
    this.roomName = roomName;
    this.socket = socketIO('http://localhost:2000');
    this.hasConnected = false;

    // When we get a signal from the socket we want to let our listener know.
    this.socket.on('signal', ({ from, signal }: SignalIncomingMessage) => {
      onSignal(from, signal);
    });
  }

  /**
   * Connects the client to the room that we specified in the constructor for
   * `SignalClient`. This method returns all the other socket ids so that we can
   * start establishing peers if wanted.
   */
  public async connect(): Promise<Array<string>> {
    // We don’t want to re-join so throw an error if we have already joined.
    if (this.hasConnected) {
      throw new Error('Already joined.');
    }
    // The message we will send to join the room.
    const request: JoinRequestMessage = { roomName: this.roomName };
    // Get the response by sending our join message to the server.
    const response = await new Promise<JoinResponseMessage>(resolve => {
      this.socket.emit('join', request, (response: any) => resolve(response));
    });
    // We succesfully connected!
    this.hasConnected = true;
    // Return the other socket ids in the room we just joined.
    return response.otherSocketIDs;
  }

  /**
   * Sends a signal to the designated recipient.
   */
  public send(to: string, signal: Signal): void {
    const message: SignalOutgoingMessage = { to, signal };
    this.socket.emit('signal', message);
  }
}

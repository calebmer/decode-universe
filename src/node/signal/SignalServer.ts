import {
  JoinRequestMessage,
  JoinResponseMessage,
  SignalOutgoingMessage,
  SignalIncomingMessage,
} from '../shared/MessageTypes';

/**
 * Sets up a socket with everything it needs to connect and communicate with
 * other sockets.
 */
// TODO: This is a very naïve implementation of a signaling exchange. This RTC
// stuff is not my speciality and so there are likely many edge cases and
// security vulnerabilities I don’t even know about. If someone with RTC
// experience ever joins this project the first thing they should do is review
// our signaling exchange and make sure it is of a high quality.
function onConnection(socket: SocketIO.Socket): void {
  /**
   * This handles the connection of a socket to a room telling the socket who
   * all the other participants are.
   */
  socket.on('join', (
    message: JoinRequestMessage,
    fn: (message: JoinResponseMessage) => void,
  ) => {
    // Get the room name from the message.
    const roomName = message.roomName;
    // Get all the other socket ids from the room.
    const { rooms } = socket.nsp.adapter;
    const otherSocketIDs = rooms[roomName] ? Object.keys(rooms[roomName].sockets) : [];
    // Join this socket to the room.
    socket.join(roomName);
    // Log who joined the room.
    console.log(`Socket "${socket.id}" joined room "${roomName}".`);
    // Send the other socket ids back to our socket.
    fn({ otherSocketIDs });
  });

  /**
   * Handles a signal by matching outgoing messages sent by one socket to its
   * recipient and then broadcasting that message as an incoming message.
   */
  socket.on('signal', (outMessage: SignalOutgoingMessage) => {
    // Create the message we want to send to the recipient socket.
    const inMessage: SignalIncomingMessage = {
      from: socket.id,
      signal: outMessage.signal,
    };
    // Log that a signal was sent.
    console.log(
      `Sending ${outMessage.signal.type} signal to socket "${outMessage.to}" ` +
        `from socket "${inMessage.from}".`
    );
    // Actually send the message.
    socket.broadcast.to(outMessage.to).emit('signal', inMessage);
  });
}

export const SignalServer = {
  onConnection,
};

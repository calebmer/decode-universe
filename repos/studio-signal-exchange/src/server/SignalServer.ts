import { JoinRequestMessage, JoinResponseMessage } from '../shared/MessageTypes';

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
    // Send the other socket ids back to our socket.
    fn({ otherSocketIDs });
  });
}

export const SignalServer = {
  onConnection,
};

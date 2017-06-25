import * as http from 'http';
import * as socketIO from 'socket.io';
import SignalServer from './SignalServer';

// Parse the port from our environment.
const PORT = parseInt(process.env.PORT, 10);

// If we could not get a port then we need to throw an error.
if (!PORT || isNaN(PORT)) {
  throw new Error(
    `Invalid port provided for the PORT environment variable: ` +
      `${process.env.PORT}`,
  );
}

// Create an HTTP server. Always respond with a 404 code. This server is used
// almost exclusively for socket.io events.
const server = http.createServer((req, res) => {
  res.statusCode = 404;
  res.end();
});

// Initialize our socket on the vanilla HTTP server.
const io = socketIO(server);

// Have the server start listening on `PORT`.
server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT} 🎙`);
});

// Register the signal server’s `onConnection` handler.
io.on('connection', SignalServer.onConnection);

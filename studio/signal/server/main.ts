import * as http from 'http';
import * as socketIO from 'socket.io';
import SignalServer from './SignalServer';

// Create an HTTP server. Always respond with a 404 code. This server is used
// almost exclusively for socket.io events.
const server = http.createServer((req, res) => {
  res.statusCode = 404;
  res.end();
});

// Initialize our socket on the vanilla HTTP server.
const io = socketIO(server);

// Have the server start listening on port 2000.
server.listen(2000, () => {
  console.log('Signaling server listening on port 2000 🎙');
});

// Register the signal server’s `onConnection` handler.
io.on('connection', SignalServer.onConnection);

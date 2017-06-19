interface AudioContext {
  createMediaStreamDestination(): MediaStreamAudioDestinationNode;
}

interface MediaStreamAudioDestinationNode extends AudioNode {
  stream: MediaStream;
}

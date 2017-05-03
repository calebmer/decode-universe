declare interface AudioContext {
  createMediaStreamDestination(): MediaStreamAudioDestinationNode;
}

declare interface MediaStreamAudioDestinationNode extends AudioNode {
  stream: MediaStream;
}

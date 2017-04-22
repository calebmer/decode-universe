import { Peer, PeerConfig, Recordee } from '@decode/studio-ui';

export class MaybeHostPeer extends Peer {
  private readonly recordees: Array<Recordee> = [];

  // TODO: There must be a better way to handle this?
  private readonly localStreams = new Set<MediaStream>();

  private recordingStream: MediaStream | null;

  constructor(config: PeerConfig) {
    super(config);
    this.recordingStream = config.localStreams.first() || null;
    {
      const handleDataChannel = ({ channel }: RTCDataChannelEvent) => {
        if (/^recording:/.test(channel.label)) {
          Recordee.create(channel).then(
            recordee => {
              recordee.setStream(this.recordingStream);
              this.recordees.push(recordee);
              this.disposables.push(recordee);
            },
            error => console.error(error),
          );
        }
      };
      this.connection.addEventListener('datachannel', handleDataChannel);
      this.disposables.push({
        dispose: () =>
          this.connection.removeEventListener('datachannel', handleDataChannel),
      });
    }
  }

  public addLocalStream(stream: MediaStream): void {
    super.addLocalStream(stream);
    this.localStreams.add(stream);
    this.updateRecordingStream();
  }

  public removeLocalStream(stream: MediaStream): void {
    super.removeLocalStream(stream);
    this.localStreams.delete(stream);
    this.updateRecordingStream();
  }

  private updateRecordingStream(): void {
    // Get the first stream from our local streams set.
    const recordingStream: MediaStream | null =
      this.localStreams.values().next().value || null;
    // Update what the current recording stream is on the instance.
    this.recordingStream = recordingStream;
    // Update the recording stream for all of the recordees that have not
    // stopped.
    this.recordees.forEach(recordee => {
      if (recordee.stopped !== true) {
        recordee.setStream(recordingStream);
      }
    });
  }
}

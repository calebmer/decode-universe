import { Set, OrderedMap } from 'immutable';
import { Observable, BehaviorSubject } from 'rxjs';
import { SignalClient, Signal } from '@decode/studio-signal-exchange/client';
import { Peer } from './Peer';

/**
 * The number of milliseconds to use when debouncing our response to an
 * `RTCPeerConnection`’s `negotiationneeded` event.
 */
const debounceNegotiationNeededMs = 200;

export class PeersMesh {
  private readonly peersSubject: BehaviorSubject<OrderedMap<string, Peer>>;

  public readonly peers: Observable<OrderedMap<string, Peer>>;

  private readonly signals: SignalClient;

  public readonly localStreams: Observable<Set<MediaStream>>;

  constructor({
    roomName,
    localStreams,
  }: {
    roomName: string,
    localStreams: Observable<Set<MediaStream>>,
  }) {
    this.signals = new SignalClient({
      roomName,
      onSignal: (address, signal) => {
        this.handleSignal(address, signal)
          .catch(error => console.error(error));
      },
    });
    this.peersSubject = new BehaviorSubject(OrderedMap<string, Peer>());
    this.peers = this.peersSubject.asObservable();
    this.localStreams = localStreams;
  }

  public close(): void {
    // Close our signal client instance.
    this.signals.close();
    // Clear out all of our peers. We are done with them.
    this.peersSubject.next(this.peersSubject.value.clear());
    // Close every peer that we know of.
    this.peersSubject.value.forEach(peer => {
      if (peer !== undefined) {
        peer.close();
      }
    });
  }

  public async connect(): Promise<void> {
    // Connect the signal client and get the addresses that are currently in the
    // room we pointed the signal client towards.
    const addresses = await this.signals.connect();
    // Create a peer for each of our addresses and start negotiations.
    await Promise.all(addresses.map(async address => {
      // Create the peer.
      const peer = this.createPeer(address);
      // Start negotiations with the peer.
      this.startPeerNegotiations(address, peer);
    }));
  }

  private createPeer(address: string): Peer {
    const { localStreams } = this;
    // Create the peer.
    const peer = new Peer({ localStreams });
    // Update our peers map by adding this peer keyed by its address.
    this.peersSubject.next(this.peersSubject.value.set(address, peer));
    // When we are told that a negotiation is needed we need to start creating
    // and sending offers.
    //
    // We debounce the work done so that if many things trigger a
    // `negotiationneeded` in a connection in very short succession we should
    // only start one negotiation.
    {
      // The timer we use to debounce negotiations. `any` because timer types
      // are wierd.
      let debounceTimer: any = null;

      peer.connection.addEventListener('negotiationneeded', () => {
        // If there is an active debounce timer, cancel it.
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer);
        }
        // Set a new debounce timer with the configured debounce milliseconds.
        debounceTimer = setTimeout(
          () => {
            // Reset the debounce timer variable.
            debounceTimer = null;
            // Start peer negotiations!
            this.startPeerNegotiations(address, peer)
              .catch(error => console.error(error));
          },
          debounceNegotiationNeededMs,
        );
      });
    }
    // Everytime we get an ICE candidate, we want to send a signal to our peer
    // with the candidate information.
    {
      peer.connection.addEventListener('icecandidate', event => {
        // Skip if the event candidate is null.
        if (event.candidate === null) {
          return;
        }
        const { sdpMLineIndex, candidate } = event.candidate;
        // Make sure that the values we need are not null. If they are then we
        // can just skip this event.
        if (candidate === null || sdpMLineIndex === null) {
          return;
        }
        // Send a candidate signal to our peer.
        this.signals.send(address, {
          type: 'candidate',
          sdpMLineIndex,
          candidate,
        });
      });
    }
    // We want to listen for complete disconnects from our peer and when they
    // occur we want to close the connection and notify the outside world about
    // the close.
    //
    // Note that we are not concerned with the temporary disconnects that may
    // happen from time to time over the course of a connection. Only the total,
    // fatal, disconnects. Temporary disconnect handling should be done
    // elsewhere.
    {
      peer.connection.addEventListener('iceconnectionstatechange', () => {
        const { iceConnectionState } = peer.connection;
        // If the connection state is failed or closed then we want to destroy the
        // peer no questions asked.
        if (
          iceConnectionState === 'failed' ||
          iceConnectionState === 'closed'
        ) {
          // Close the peer.
          peer.close();
          // Remove the peer from our internal map.
          this.peersSubject.next(this.peersSubject.value.delete(address));
        }
      });
    }
    // Return the peer.
    return peer;
  }

  private async startPeerNegotiations(
    address: string,
    peer: Peer,
  ): Promise<void> {
    // Create the offer that we will send to the peer.
    const offer = await peer.connection.createOffer();
    await peer.connection.setLocalDescription(offer);
    // Type-check for TypeScript.
    if (offer.sdp === null) {
      throw new Error('Expected an `sdp` in the created offer.');
    }
    // Send the offer to the provided address using our new signal client.
    this.signals.send(address, {
      type: 'offer',
      sdp: offer.sdp,
    });
  }

  private async handleSignal(address: string, signal: Signal): Promise<void> {
    // Get the peer using the provided address.
    let peer: Peer | undefined = this.peersSubject.value.get(address);

    // If we could find no peer and the signal is an offer signal then let us
    // create a new peer. If we could not find a peer and the signal was *not*
    // an offer signal then we need to throw an error.
    if (peer === undefined) {
      if (signal.type === 'offer') {
        peer = this.createPeer(address);
      } else {
        throw new Error(`No peer found with address '${address}'.`);
      }
    }

    switch (signal.type) {
      // When we get an offer singal then we want to setup our peer for that
      // offer by setting the remote description with the offer. After that we
      // want to generate an answer and send that answer through our signaling
      // service.
      case 'offer': {
        // Set the remote description to the offer we recieved.
        await peer.connection
          .setRemoteDescription(new RTCSessionDescription(signal));
        // Create an answer.
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        // Type-check for TypeScript.
        if (answer.sdp === null) {
          throw new Error('Expected an `sdp` in the created answer.');
        }
        // Send the answer to the peer who was kind enough to generate us an
        // offer.
        this.signals.send(address, {
          type: 'answer',
          sdp: answer.sdp,
        });
        break;
      }

      // When we get an answer back after we send an offer we want to set the
      // remote description on that peer. After this happens we should be in
      // business for peer-to-peer communciation!
      case 'answer': {
        await peer.connection
          .setRemoteDescription(new RTCSessionDescription(signal));
        break;
      }

      // Whenever we get a candidate signal, we need to add the candidate to our
      // peer.
      case 'candidate': {
        const { sdpMLineIndex, candidate } = signal;
        peer.connection.addIceCandidate(new RTCIceCandidate({
          sdpMLineIndex,
          candidate,
        }));
        break;
      }
    }
  }
}

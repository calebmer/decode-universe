/**
 * A client sends a `JoinRequestMessage` to attempt and join a room. If the
 * client succesfully joins a room then they will get a `JoinResponseMessage`
 * with the other socket ids.
 */
export type JoinRequestMessage = {
  readonly roomName: string;
};

/**
 * A message sent by the server that represents a successful join of a room by a
 * given socket.
 */
export type JoinResponseMessage = {
  readonly otherSocketIDs: Array<string>;
};

/**
 * A signal message that is being sent to a recipient specified in the `to`
 * property of this message. The signaling exchange will route this message to
 * the correct recipient and let the recipient know which socket sent it.
 */
export type SignalOutgoingMessage = {
  readonly to: string;
  readonly signal: Signal;
};

/**
 * A signal message that was sent by another signal as specified in the `from`
 * property of this message. This message was explicitly sent by that socket to
 * this one and should be handled appropriately.
 */
export type SignalIncomingMessage = {
  readonly from: string;
  readonly signal: Signal;
};

/**
 * A signal that can be sent in the messaging between two peers that is
 * necessary to establish a peer-to-peer connection.
 *
 * The signaling process looks something like this.
 *
 * 1. An agent connects to the signaling exchange server and gets the addresses
 *    of all other peers that the agent needs to connect to.
 * 2. The agent sends an `OffserSignal` to all of the peers it now has addresses
 *    for an waits for an `AnswerSignal`.
 * 3. Each of the peers send an `AnswerSignal` if they succesfully created a
 *    peer connection in response to the `OfferSignal`.
 * 4. TODO: What does `CandidateSignal` *really* do?
 */
export type Signal = OfferSignal | AnswerSignal | CandidateSignal;

export type OfferSignal = {
  readonly type: 'offer';
  readonly sdp: string;
};

export type AnswerSignal = {
  readonly type: 'answer';
  readonly sdp: string;
};

export type CandidateSignal = {
  readonly type: 'candidate';
  readonly sdpMLineIndex: number;
  readonly candidate: string;
};

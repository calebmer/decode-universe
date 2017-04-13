import * as React from 'react';
import { PeersMesh } from './PeersMesh';

type Props = {
  roomName: string,
  onAddConnection: (id: string, connection: RTCPeerConnection) => void,
  onRemoveConnection: (id: string) => void,
};

type State = {
  peersMesh: PeersMesh,
};

export class PeersMeshController extends React.PureComponent<Props, State> {
  state: State = {
    peersMesh: createPeersMesh(this.props),
  };

  componentDidMount() {
    const { peersMesh } = this.state;
    // Connect the peer mesh we instantiated.
    peersMesh.connect().catch(error => console.error(error));
  }

  // NOTE: Remember that there can be no side effects in this method! We should
  // only be updating state based on the new props.
  componentWillReceiveProps(nextProps: Props) {
    const previousProps = this.props;
    // If the room name changed then we want to create a new peer mesh. We will
    // connect that peer mesh in `componentDidUpdate` where side-effects are
    // allowed.
    if (previousProps.roomName !== nextProps.roomName) {
      this.setState({
        peersMesh: createPeersMesh(nextProps),
      });
    }
  }

  componentDidUpdate(previousProps: Props, previousState: State) {
    const nextState = this.state;
    // If the peer mesh changed then we want to close the last mesh and connect
    // the new mesh.
    if (previousState.peersMesh !== nextState.peersMesh) {
      // Close the last mesh.
      previousState.peersMesh.close();
      // Connect the new mesh.
      nextState.peersMesh.connect().catch(error => console.error(error));
    }
  }

  componentWillUnmount() {
    const { peersMesh } = this.state;
    // Close the peer mesh.
    peersMesh.close();
  }

  render() {
    return null;
  }
}

/**
 * Creates a new `PeersMesh` using a set of props for the `PeersMeshController`
 * component.
 */
function createPeersMesh({
  roomName,
  onAddConnection,
  onRemoveConnection,
}: Props): PeersMesh {
  return new PeersMesh({
    roomName,
    onAddConnection,
    onRemoveConnection,
  });
}

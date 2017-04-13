import * as React from 'react';
import { PeerMesh } from './PeerMesh';

type Props = {
  roomName: string,
  onAddConnection: (id: string, connection: RTCPeerConnection) => void,
  onRemoveConnection: (id: string) => void,
};

type State = {
  peerMesh: PeerMesh,
};

export class PeerMeshController extends React.PureComponent<Props, State> {
  state: State = {
    peerMesh: createPeerMesh(this.props),
  };

  componentDidMount() {
    const { peerMesh } = this.state;
    // Connect the peer mesh we instantiated.
    peerMesh.connect().catch(error => console.error(error));
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
        peerMesh: createPeerMesh(nextProps),
      });
    }
  }

  componentDidUpdate(previousProps: Props, previousState: State) {
    const nextState = this.state;
    // If the peer mesh changed then we want to close the last mesh and connect
    // the new mesh.
    if (previousState.peerMesh !== nextState.peerMesh) {
      // Close the last mesh.
      previousState.peerMesh.close();
      // Connect the new mesh.
      nextState.peerMesh.connect().catch(error => console.error(error));
    }
  }

  componentWillUnmount() {
    const { peerMesh } = this.state;
    // Close the peer mesh.
    peerMesh.close();
  }

  render() {
    return null;
  }
}

/**
 * Creates a new `PeerMesh` using a set of props for the `PeerMeshController`
 * component.
 */
function createPeerMesh({
  roomName,
  onAddConnection,
  onRemoveConnection,
}: Props): PeerMesh {
  return new PeerMesh({
    roomName,
    onAddConnection,
    onRemoveConnection,
  });
}

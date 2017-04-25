import * as React from 'react';

type Props = {
  context: AudioContext,
  node: AudioNode,
};

/**
 * Plays the audio output from the `node` prop by connecting it to the
 * destination node of the `context` prop.
 */
export class AudioDestination extends React.PureComponent<Props, {}> {
  componentDidMount() {
    // Connect the node to the context.
    const { context, node } = this.props;
    node.connect(context.destination);
  }

  componentDidUpdate(previousProps: Props) {
    const nextProps = this.props;
    // If the context or node changed then we need to disconnect the last
    // context/node pair and connect the new context/node pair.
    if (
      previousProps.context !== nextProps.context ||
      previousProps.node !== nextProps.node
    ) {
      previousProps.node.disconnect(previousProps.context.destination);
      nextProps.node.connect(nextProps.context.destination);
    }
  }

  componentWillUnmount() {
    // Disconnect the node from the context.
    const { context, node } = this.props;
    node.disconnect(context.destination);
  }

  render() {
    return null;
  }
}

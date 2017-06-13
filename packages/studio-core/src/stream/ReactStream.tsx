import * as React from 'react';
import { Stream, Listener } from 'xstream';

function render<T>(
  stream: Stream<T>,
  render: (value: T) => JSX.Element | false | null,
): JSX.Element {
  return <ReactStreamComponent stream={stream as any} render={render as any} />;
}

export const ReactStream = {
  render,
};

type Props<T> = {
  stream: Stream<T>;
  render: (value: T) => JSX.Element | false | null;
};

type State<T> = {
  streamState: StreamState<T>;
};

type StreamState<T> =
  | {
      state: 'waiting';
    }
  | {
      state: 'value';
      value: T;
    }
  | {
      state: 'error';
      error: mixed;
    }
  | {
      state: 'complete';
    };

// Get the display name for `ReactStreamComponent`. We use a function like
// this so that the name will be mangled when going through an uglification
// step.
let displayName: string;
(() => {
  function ReactStream() {}
  displayName = ReactStream.name;
})();

class ReactStreamComponent<T> extends React.PureComponent<Props<T>, State<T>> {
  static displayName = displayName;

  state: State<T> = {
    streamState: { state: 'waiting' },
  };

  componentDidMount() {
    this.props.stream.addListener(this.listener);
  }

  componentDidUpdate(previousProps: Props<T>) {
    const nextProps = this.props;
    // If the stream changed then we need to move our listener to the new
    // stream.
    if (previousProps.stream !== nextProps.stream) {
      previousProps.stream.removeListener(this.listener);
      nextProps.stream.addListener(this.listener);
    }
  }

  componentWillUnmount() {
    this.props.stream.removeListener(this.listener);
  }

  /**
   * The stream listener.
   */
  private readonly listener: Listener<T> = {
    // When we get a value then we need to update our state with the value.
    next: value => {
      this.setState({
        streamState: {
          state: 'value',
          value,
        },
      });
    },
    // If we got an error then we need to log that error and then update our
    // state with the error.
    error: error => {
      console.error(error);
      this.setState({
        streamState: {
          state: 'error',
          error,
        },
      });
    },
    // If the stream completes then we need to update the state with that
    // information.
    complete: () => {
      this.setState({
        streamState: {
          state: 'complete',
        },
      });
    },
  };

  render() {
    const { render } = this.props;
    const { streamState } = this.state;

    switch (streamState.state) {
      // If we are waiting just render null.
      case 'waiting':
        return null;

      // If we have a value then render that.
      case 'value':
        const jsx = render(streamState.value);
        return jsx === false ? null : jsx;

      // If we got an error then render null.
      case 'error':
        return null;

      // If the stream completed then render null.
      case 'complete':
        return null;
    }
  }
}

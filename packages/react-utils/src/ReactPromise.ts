import * as React from 'react';

/**
 * Renders a `<ReactPromise/>` component. We use a function because TypeScript
 * doesn’t play well with generic components.
 */
function render<T>(
  promise: Promise<T>,
  render: (value: T) => JSX.Element | null,
): JSX.Element {
  return React.createElement(ReactPromiseComponent, { promise, render });
}

export const ReactPromise = {
  render,
};

type Props<T> = {
  promise: Promise<T>;
  render: (value: T) => JSX.Element | null;
};

type State<T> = {
  promise: PromiseState<T>;
};

type PromiseState<T> =
  | {
      state: 'pending';
    }
  | {
      state: 'resolved';
      value: T;
    }
  | {
      state: 'rejected';
      error: mixed;
    };

class ReactPromiseComponent<T> extends React.PureComponent<Props<T>, State<T>> {
  static displayName = 'ReactPromise';

  state: State<T> = {
    promise: { state: 'pending' },
  };

  componentDidMount() {
    // Wait for the promise in our props to resolve.
    this.waitForResolution();
  }

  componentWillReceiveProps(nextProps: Props<T>) {
    const previousProps = this.props;
    // If the promise we get passed in as the next prop is not the same as the
    // promise we currently have then we want to set our state to pending.
    if (nextProps.promise !== previousProps.promise) {
      this.setState({ promise: { state: 'pending' } });
    }
  }

  componentDidUpdate() {
    const nextState = this.state;
    // If our promise’s state is pending then
    if (nextState.promise.state === 'pending') {
      this.waitForResolution();
    }
  }

  componentWillUnmount() {
    // Increment the zone since we can’t cancel promises. This will make sure
    // the state is not updated.
    this.currentZoneID++;
  }

  /**
   * Allows us to keep track of the asynchronous “zone” we started in. If the
   * zone changes while we wait for our promise to resolve then that should
   * effectively cancel the promise.
   */
  private currentZoneID = 0;

  /**
   * Wait for the promise in our props to resolve and update our state
   * accordingly.
   */
  private waitForResolution() {
    // Create a new zone id cancelling all previous zones.
    const zoneID = (this.currentZoneID += 1);
    // Wait for our promise to resolve or reject and update our state
    // accordingly.
    this.props.promise.then(
      value => {
        if (zoneID === this.currentZoneID) {
          this.setState({ promise: { state: 'resolved', value } });
        }
      },
      error => {
        if (zoneID === this.currentZoneID) {
          this.setState({ promise: { state: 'rejected', error } });
        }
      },
    );
  }

  render() {
    const { render } = this.props;
    const { promise } = this.state;
    switch (promise.state) {
      case 'pending':
      case 'rejected':
        return null;
      case 'resolved':
        return render(promise.value);
    }
  }
}

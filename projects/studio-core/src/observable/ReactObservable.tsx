import * as React from 'react';
import { Observable, Subscription } from 'rxjs';

function render<T>(
  observable: Observable<T>,
  render: (value: T) => JSX.Element | false | null,
): JSX.Element {
  return (
    <ReactObservableComponent
      observable={observable as any}
      render={render as any}
    />
  );
}

export const ReactObservable = {
  render,
};

type Props<T> = {
  observable: Observable<T>;
  render: (value: T) => JSX.Element | false | null;
};

type State<T> = {
  observableState: ObservableState<T>;
};

type ObservableState<T> =
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

// Get the display name for `ReactObservableComponent`. We use a function like
// this so that the name will be mangled when going through an uglification
// step.
let displayName: string;
(() => {
  function ReactObservable() {}
  displayName = ReactObservable.name;
})();

class ReactObservableComponent<T> extends React.PureComponent<
  Props<T>,
  State<T>
> {
  static displayName = displayName;

  state: State<T> = {
    observableState: { state: 'waiting' },
  };

  componentDidMount() {
    this.subscribe();
  }

  componentDidUpdate(previousProps: Props<T>) {
    const nextProps = this.props;
    // If the observable changed then we need to re-subscribe to the observable.
    if (previousProps.observable !== nextProps.observable) {
      this.subscribe();
    }
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  /**
   * A reference to the currently running subscription.
   */
  private subscription: Subscription | null = null;

  /**
   * Unsubscribes from any currently running subscription. If there are no
   * subscriptions currently running then this is a noop.
   */
  private unsubscribe(): void {
    // If we alread had a subscription then make sure to unsubscribe from that
    // subscription before subscribing to the observable.
    if (this.subscription !== null) {
      this.subscription.unsubscribe();
    }
  }

  /**
   * Subscribes to the observable currently in our props.
   *
   * If there is a subscription currently running then we try to unsubscribe
   * from that first.
   */
  private subscribe(): void {
    // Unsubscribe the last subscription before subscribing a new.
    this.unsubscribe();
    // Subscribe to the observable.
    this.subscription = this.props.observable.subscribe({
      // When we get a value then we need to update our state with the value.
      next: value => {
        this.setState({
          observableState: {
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
          observableState: {
            state: 'error',
            error,
          },
        });
      },
      // If the observable completes then we need to update the state with that
      // information.
      complete: () => {
        this.setState({
          observableState: {
            state: 'complete',
          },
        });
      },
    });
  }

  render() {
    const { render } = this.props;
    const { observableState } = this.state;

    switch (observableState.state) {
      // If we are waiting just render null.
      case 'waiting':
        return null;

      // If we have a value then render that.
      case 'value':
        const jsx = render(observableState.value);
        return jsx === false ? null : jsx;

      // If we got an error then render null.
      case 'error':
        return null;

      // If the observable completed then render null.
      case 'complete':
        return null;
    }
  }
}

import * as React from 'react';
import { EventEmitter, Disposable } from '@decode/jsutils';

/**
 * Creates a component that will listen to events and reduce a defined state
 * type with the result of certain events.
 */
function createComponent<TProps, TState, TEventMap>({
  emitter: getEmitter,
  events: eventReducers,
  initialState: getInitialState,
  render,
}: {
  emitter: (props: TProps) => EventEmitter<TEventMap>,
  events: {
    [TEvent in keyof TEventMap]?:
      (state: TState, data: TEventMap[TEvent], props: TProps) => TState
  },
  initialState: (props: TProps) => TState,
  render: (props: TProps, state: TState) => JSX.Element | null,
}): React.ComponentClass<TProps> {
  // We have a few extra properties in the state type for our returned
  // event listener component.
  type State = {
    emitter: EventEmitter<TEventMap>,
    reduction: TState,
  };

  // Return an event listener component.
  return class EventListener extends React.PureComponent<TProps, State> {
    state: State = {
      emitter: getEmitter(this.props),
      reduction: getInitialState(this.props),
    };

    componentDidMount() {
      // When we mount we want to listen to all events.
      this.listen();
    }

    componentWillReceiveProps(nextProps: TProps) {
      // When the props update we want to try to update our emitter by computing
      // a new emitter from the props.
      this.setState((previousState: State): Partial<State> | void => {
        // Compute the emitter from the props.
        const nextEmitter = getEmitter(nextProps);
        // If the emitter did not change then cancel the state update.
        if (previousState.emitter === nextEmitter) {
          return;
        }
        // If the emitter changed then we need to set the new emitter and we
        // need to get a new initial state.
        return {
          emitter: nextEmitter,
          reduction: getInitialState(this.props),
        };
      });
    }

    componentDidUpdate(previousProps: TProps, previousState: State) {
      const nextState = this.state;
      // If the emitter changed then we want to unlisten events from the
      // previous listener and then start listening to the new emitter.
      if (nextState.emitter !== previousState.emitter) {
        this.unlisten();
        this.listen();
      }
    }

    componentWillUnmount() {
      // When we unmount we want to unlisten.
      this.unlisten();
    }

    /**
     * This disposable represents the events we are currently listening to. To
     * stop listening this should be disposed. If we are not currently listening
     * then this will be null.
     */
    private disposable: Disposable | null = null;

    /**
     * Listen to the events from our event emitter.
     */
    private listen() {
      // Throw an error if there is already a disposable.
      if (this.disposable !== null) {
        throw new Error('Already listening.');
      }
      // Get our emitter from state.
      const { emitter } = this.state;
      // Create a disposable that will dispose an array of observables.
      this.disposable = Disposable.concat(
        // For all of the keys in our event reducers map we want to listen for
        // those events and reduce our state when an event comes in.
        Object.keys(eventReducers).map((event: keyof TEventMap) => {
          // Get the reducer for this event.
          const reducer = eventReducers[event]!;
          // Listen for events on the emitter.
          return emitter.on(event, data => {
            // When we get an event then reduce our state using the reducer and
            // the data from the event.
            this.setState((
              { reduction }: State,
              props: TProps,
            ): Partial<State> => ({
              reduction: reducer(reduction, data, props),
            }));
          });
        })
      );
    }

    /**
     * Stop listening to the events from our event emitter.
     */
    private unlisten() {
      if (this.disposable !== null) {
        this.disposable.dispose();
        this.disposable = null;
      }
    }

    render() {
      return render(this.props, this.state.reduction);
    }
  }
}

export const EventListener = {
  createComponent,
};

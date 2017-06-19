import { Disposable } from './Disposable';

export namespace EventEmitter {
  /**
   * The default event map represents some default transactional events that are
   * sent by the `EventEmitter`. These take precedence over whatever events are
   * in the provided event map generic.
   */
  export interface DefaultEventMap {
    error: mixed;
  }
}

// TODO: Report errors better then with console?
declare const console: any;

/**
 * An event emitter is any object which has a set of live events from some
 * source which the object wants to expose to API consumers.
 */
export class EventEmitter<TEventMap> {
  /**
   * A map of all the listeners for a given event name.
   *
   * We use a `Set` for the listeners instead of an `Array` to balance the
   * ability to easily delete a listener with the ability to iterate quickly
   * through all of the listeners.
   */
  private listeners = new Map<string, Set<{ listener: (data: any) => void }>>();

  /**
   * Emits an event by calling all of the listeners that have been added for
   * that event.
   */
  protected emit<E extends keyof (TEventMap & EventEmitter.DefaultEventMap)>(
    eventName: E,
    data: (TEventMap & EventEmitter.DefaultEventMap)[E],
  ): void {
    // Get all of the listeners from the listener map.
    const listeners = this.listeners.get(eventName);
    // If we got an error event and we have no listeners for the error event
    // then we want to log an error to the console letting the world know we got
    // an unhandled error.
    if (
      eventName === 'error' &&
      (listeners === undefined || listeners.size < 1)
    ) {
      // TODO: Report errors better then with console?
      console.error('Unhandled (in EventEmitter)', data);
    }
    // If there is no listeners array then return early.
    if (listeners === undefined) {
      return;
    }
    // Otherwise there is an array of listeners that we should loop through and
    // call each listener.
    listeners.forEach(({ listener }) => {
      // If the listener is undefined (happens when a listener is deleted) then
      // return early.
      if (listener === undefined) {
        return;
      }
      // Call the listener. If an error is thrown then we emit an error event
      // and let any error event listeners handle it.
      try {
        listener(data);
      } catch (error) {
        this.emit('error', error);
      }
    });
  }

  /**
   * Adds an event listener for a specific event in our event map.
   *
   * Returns a disposable which will remove the event listener when disposed.
   *
   * The same listener (`listenerA === listenerB`) may be added multiple times
   * and will be called once for every time it was added.
   */
  public on<E extends keyof (TEventMap & EventEmitter.DefaultEventMap)>(
    eventName: E,
    listener: (data: (TEventMap & EventEmitter.DefaultEventMap)[E]) => void,
  ): Disposable {
    // Get the listeners for this event name.
    let listeners = this.listeners.get(eventName);
    // If there are is no listener set then we need to create one and add it to
    // our listeners map.
    if (listeners === undefined) {
      // Create a set.
      listeners = new Set();
      // Add the listener set to the map.
      this.listeners.set(eventName, listeners);
    }
    // Create a handle for the listener. We do this to create a new object
    // reference every time `on()` is called so that if a listener is added
    // multiple times it will only have one distinct reference.
    const handle = { listener };
    // Add the new listener.
    listeners.add(handle);
    // Return a disposable which will remove the listener.
    return {
      dispose: () => {
        // Get the set of latest listeners.
        const latestListeners = this.listeners.get(eventName);
        // If we have such a set then try deleting the listener’s handle.
        if (latestListeners !== undefined) {
          latestListeners.delete(handle);
        }
      },
    };
  }

  /**
   * Clears out *all* of the event listeners for this event emitter.
   */
  protected clearAllListeners(): void {
    this.listeners.clear();
  }
}

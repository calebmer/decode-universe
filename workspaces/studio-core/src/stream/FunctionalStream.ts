import { Listener, Producer, Stream } from 'xstream';

function create<T>(
  subscribe: (listener: Listener<T>) => (() => void),
): Stream<T> {
  return Stream.create(new FunctionalProducer(subscribe));
}

function createWithMemory<T>(
  subscribe: (listener: Listener<T>) => (() => void),
): Stream<T> {
  return Stream.createWithMemory(new FunctionalProducer(subscribe));
}

export const FunctionalStream = {
  create,
  createWithMemory,
};

class FunctionalProducer<T> implements Producer<T> {
  private subscribe: (listener: Listener<T>) => (() => void);
  private unsubscribe: (() => void) | null = null;

  constructor(subscribe: (listener: Listener<T>) => (() => void)) {
    this.subscribe = subscribe;
  }

  public start(listener: Listener<T>) {
    if (this.unsubscribe !== null) {
      throw new Error('Producer already started.');
    }
    this.unsubscribe = this.subscribe(listener);
  }

  public stop() {
    if (this.unsubscribe === null) {
      throw new Error('Producer has not been started.');
    }
    this.unsubscribe();
    this.unsubscribe = null;
  }
}

import { Stream, InternalListener } from 'xstream';

/**
 * A live value is a stream wrapper around any other value that allows consumers
 * to synchronously view and modify the current value. Whenever a new value is
 * set it will be published to all of the stream’s listeners and whenever a
 * listener is added the current value will immeadiately be sent similar to how
 * a `MemoryStream` works.
 */
export default class LiveValue<T> extends Stream<T> {
  /**
   * The internal value. We call it `_v` to match the code style of `xstream`.
   */
  private _v: T;

  constructor(value: T) {
    super();
    this._v = value;
  }

  /**
   * Gets the current value synchronously.
   */
  public get(): T {
    return this._v;
  }

  /**
   * Sets the internal value and publishes the new value to all listeners.
   */
  public set(nextValue: T): void {
    this._n(nextValue);
  }

  /**
   * A shortcut to `get()` and `set()` that lets consumers quickly update the
   * live value.
   */
  public update(updater: (value: T) => T): void {
    this.set(updater(this.get()));
  }

  /**
   * Turns the live value into a stream where the internal value cannot be
   * modified.
   */
  public asStream(): Stream<T> {
    return this;
  }

  _n(nextValue: T) {
    this._v = nextValue;
    super._n(nextValue);
  }

  _add(listener: InternalListener<T>): void {
    super._add(listener);
    listener._n(this._v);
  }
}

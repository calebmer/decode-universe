/**
 * A disposable is some object that has started some long running process that
 * can be ended at any time.
 *
 * This interface helps abstract over many types of endable processes.
 */
export interface Disposable {
  dispose(): void;
}

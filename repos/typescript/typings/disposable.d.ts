/**
 * A disposable is some object that has started some long running process that
 * can be ended at any time.
 *
 * This interface helps abstract over many types of endable processes.
 */
declare interface Disposable {
  dispose(): void;
}

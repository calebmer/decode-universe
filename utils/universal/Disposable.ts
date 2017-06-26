/**
 * A disposable is some object that has started some long running process that
 * can be ended at any time.
 *
 * This interface helps abstract over many types of endable processes.
 */
interface Disposable {
  dispose(): void;
}

/**
 * Combines many disposables into one large disposable.
 */
function concat(
  ...disposables: Array<Disposable | Array<Disposable>>
): Disposable {
  return {
    dispose: () => {
      disposables.forEach(disposable => {
        if (Array.isArray(disposable)) {
          disposable.forEach(d => d.dispose());
        } else {
          disposable.dispose();
        }
      });
    },
  };
}

const Disposable = {
  concat,
};

export default Disposable;

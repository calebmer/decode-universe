import { appendFile } from 'fs';
import { OrderedMap } from 'immutable';
import { Observable, Subscription } from 'rxjs';

/**
 * Saves some recordings to a provided directory using the key from the map to
 * determine the file path name and adding the extension `.decraw`.
 *
 * Returns an observable which will never emit any values. It will only ever
 * emit errors. If an error ocurred in the recording or when writing to the file
 * system then an error will be emit.
 *
 * The returned observable is lazy so it won’t start writing data until you
 * `subscribe()`. If you `subscribe()` twice then the resulting audio files will
 * be a bit crazy.
 */
function saveRecordingStreams(
  directoryPath: string,
  recordingsObservable: Observable<OrderedMap<string, Observable<ArrayBuffer>>>,
): Observable<never> {
  return new Observable(observer => {
    // Create a mutable map of the current recording state with ids as the key
    // and some of the recording information as values.
    const currentRecordings = new Map<string, {
      recording: Observable<ArrayBuffer>,
      subscription: Subscription,
    }>();

    const recordingsSubscription = recordingsObservable.subscribe({
      // If we got an error then we need to report it!
      error: error => observer.error(error),
      // If our observer ever completes then we need to forward that event.
      complete: () => observer.complete(),

      // If there are new recordings then we want to diff them against what we
      // already have.
      next: nextRecordings => {
        // Create a clone of the current recordings map. We will be removing
        // entries from it as we visit them.
        const currentRecordingDifference = new Map(currentRecordings);
        // For every recording...
        nextRecordings.forEach((nextRecording, id) => {
          // Delete the entry from the mutable set we made. This means we
          // “visited” the key.
          currentRecordingDifference.delete(id);
          // Try to get the current recording.
          const currentRecording = currentRecordings.get(id);
          // If there was a current recording and that recording is the same as
          // the new recording we got then we need to change nothing. We can
          // safely exit out of this function. However, if the recordings are
          // not the same then we need to cleanup the last subscription so that
          // we can create a new subscription.
          //
          // If we do not have a current recording then a new one will be
          // created.
          if (currentRecording !== undefined) {
            if (currentRecording.recording === nextRecording) {
              return;
            } else {
              currentRecording.subscription.unsubscribe();
            }
          }
          // Get a subscription by creating an observable to save the recording
          // at the given file path. We will forward any errors from that
          // observable to our own observer.
          const subscription = saveRecordingStream(
            // Use the extension `.decraw` to stand for Decode Raw Audio format.
            // However, the format is nothing fancy. Its just the channel data
            // we get from a `ScriptProcessorNode` in the browser.
            `${directoryPath}/${id}.decraw`,
            nextRecording,
          ).subscribe({
            error: error => observer.error(error),
          });
          // Set the new recording and the new subscription to our current
          // recordings map.
          currentRecordings.set(id, {
            recording: nextRecording,
            subscription,
          });
        });
        // Since we deleted an entry from `currentRecordingKeys` everytime we
        // visited the key for that entry, all that’s left are the entries that
        // were not in our `nextRecordings` map. We should clean these entries
        // up.
        currentRecordingDifference.forEach(({ subscription }, id) => {
          // Unsubscribe from the subscription.
          subscription.unsubscribe();
          // Delete the entry from our mutable map.
          currentRecordings.delete(id);
        });
      },
    });

    return () => {
      recordingsSubscription.unsubscribe();
      currentRecordings.forEach(({ subscription }) =>
        subscription.unsubscribe()
      );
    };
  });
}

/**
 * Saves a recording to a provided file path in the Decode Raw Audio format. To
 * be clear, the format is nothing that special. It’s just a dump of the data
 * from a `ScriptProcessorNode` in the browser.
 *
 * Returns an observable which will never emit any values. It will only ever
 * emit errors. If an error ocurred in the recording or when writing to the file
 * system then an error will be emit.
 *
 * The returned observable is lazy so it won’t start writing data until you
 * `subscribe()`. If you `subscribe()` twice then the resulting audio file will
 * be a bit crazy.
 */
function saveRecordingStream(
  filePath: string,
  recording: Observable<ArrayBuffer>,
): Observable<never> {
  return new Observable<never>(observer => {
    return recording.subscribe({
      // If we got a buffer then we need to write it to our file.
      next: buffer => {
        appendFile(
          filePath,
          Buffer.from(buffer),
          error => {
            // If an error ocurred while appending the file then we need to
            // report that error.
            if (error) {
              observer.error(error);
            }
          },
        );
      },
      // If we got an error then we need to report it.
      error: error => observer.error(error),
      // If our recording completed then we can complete our observer.
      complete: () => observer.complete(),
    });
  });
}

export const RawAudio = {
  saveRecordingStreams,
  saveRecordingStream,
};

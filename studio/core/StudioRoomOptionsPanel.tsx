import * as React from 'react';
import { Stream } from 'xstream';
import { css } from 'glamor';
import { Fonts } from '~/design/styles';
import ReactStream from './stream/ReactStream';
import TextInput from './input/TextInput';
import RangeInput from './input/RangeInput';
import UserAudioDevicesSelect from './audio/UserAudioDevicesSelect';
import Panel from './Panel';

// Users should really be adjusting the gain on their mic and not in the
// software. We should walk them through this instead of providing a slider in
// the software.
const enableGainInput = false;

export default function StudioRoomOptionsPanel({
  name,
  onChangeName,
  deviceID,
  onSelectDeviceID,
  localVolume,
  onLocalVolumeChange,
  disableAudio,
  onDisableAudio,
  onEnableAudio,
}: {
  name: Stream<string>;
  onChangeName: (name: string) => void;
  deviceID: Stream<string | null>;
  onSelectDeviceID: (deviceID: string) => void;
  localVolume: Stream<number>;
  onLocalVolumeChange: (localVolume: number) => void;
  disableAudio: Stream<boolean>;
  onDisableAudio: () => void;
  onEnableAudio: () => void;
}) {
  const handleLocalVolumeChange = (volume: number) =>
    onLocalVolumeChange(volume / 100);

  return (
    <Panel title="Options" width="16em">
      {ReactStream.render(name, name =>
        <TextInput label="Name" value={name} onChange={onChangeName} />,
      )}
      {ReactStream.render(deviceID, deviceID =>
        <UserAudioDevicesSelect
          kind="input"
          deviceID={deviceID}
          onSelect={onSelectDeviceID}
        />,
      )}
      {enableGainInput &&
        ReactStream.render(localVolume, localVolume =>
          <RangeInput
            label="Gain"
            min={0}
            max={100}
            step={1}
            value={Math.round(localVolume * 100)}
            onChange={handleLocalVolumeChange}
          />,
        )}
      {/* There is not really a strong use case for being able to disable the
        * audio output for users outside of development. In development the
        * option is super useful! If developing using two open browser windows
        * on the same machine then the feedback from the two windows is killer.
        * Disabling audio output by default means that does not happen. */}
      {__DEV__ &&
        <label
          {...css(Fonts.input, {
            cursor: 'pointer',
            display: 'block',
            padding: '1em',
          })}
        >
          {ReactStream.render(disableAudio, disableAudio =>
            <input
              type="checkbox"
              checked={disableAudio}
              onChange={disableAudio ? onEnableAudio : onDisableAudio}
              {...css({ cursor: 'pointer' })}
            />,
          )}
          {' '}
          Disable Audio Output
        </label>}
    </Panel>
  );
}

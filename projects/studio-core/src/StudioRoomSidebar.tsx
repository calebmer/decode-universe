import * as React from 'react';
import { Observable } from 'rxjs';
import { css } from 'glamor';
import { ReactObservable } from './observable/ReactObservable';
import { TextInput } from './shared/input/TextInput';
import { RangeInput } from './shared/input/RangeInput';
import { UserAudioDevicesSelect } from './audio/UserAudioDevicesSelect';

export function StudioRoomSidebar({
  name,
  onChangeName,
  deviceID,
  onSelectDeviceID,
  localVolume,
  onLocalVolumeChange,
}: {
  name: Observable<string>,
  onChangeName: (name: string) => void,
  deviceID: Observable<string | null>,
  onSelectDeviceID: (deviceID: string) => void,
  localVolume: Observable<number>,
  onLocalVolumeChange: (localVolume: number) => void,
}) {
  const handleLocalVolumeChange = (volume: number) =>
    onLocalVolumeChange(volume / 100);

  return (
    <div {...css({
      width: '16em',
      height: '100%',
      overflow: 'hidden',
    })}>
      {ReactObservable.render(
        name,
        name => (
          <TextInput
            label="Name"
            value={name}
            onChange={onChangeName}
          />
        ),
      )}
      {ReactObservable.render(
        deviceID,
        deviceID => (
          <UserAudioDevicesSelect
            kind="input"
            deviceID={deviceID}
            onSelect={onSelectDeviceID}
          />
        ),
      )}
      {ReactObservable.render(
        localVolume,
        localVolume => (
          <RangeInput
            label="Gain"
            min={0}
            max={100}
            step={1}
            value={Math.round(localVolume * 100)}
            onChange={handleLocalVolumeChange}
          />
        ),
      )}
      <TextInput
        label="Disable Audio Output"
        value=""
        onChange={() => {}}
      />
    </div>
  );
}

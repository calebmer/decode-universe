import * as React from 'react';
import { Observable } from 'rxjs';
import { css } from 'glamor';
import { ReactObservable } from './observable/ReactObservable';
import { TextInput } from './shared/input/TextInput';
import { UserAudioDevicesSelect } from './audio/UserAudioDevicesSelect';

export function StudioRoomSidebar({
  name,
  onChangeName,
  deviceID,
  onSelectDeviceID,
}: {
  name: Observable<string>,
  onChangeName: (name: string) => void,
  deviceID: Observable<string | null>,
  onSelectDeviceID: (deviceID: string) => void,
}) {
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
      <TextInput
        label="Gain (?)"
        value=""
        onChange={() => {}}
      />
      <TextInput
        label="Disable Audio Output"
        value=""
        onChange={() => {}}
      />
    </div>
  );
}

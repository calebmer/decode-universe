import * as React from 'react';
import { Observable } from 'rxjs';
import { css } from 'glamor';
import { ReactObservable } from './observable/ReactObservable';
import { TextInput } from './input/TextInput';

export function StudioRoomSidebar({
  name,
  onChangeName,
}: {
  name: Observable<string>,
  onChangeName: (name: string) => void,
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
      <TextInput
        label="Audio Input"
        value=""
        onChange={() => {}}
      />
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

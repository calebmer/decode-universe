import * as React from 'react';
import { Colors } from '@decode/styles';
import { css } from 'glamor';
import { TextInput } from './TextInput';

export function StudioRoomSidebar() {
  return (
    <div {...css({
      width: '16em',
      height: '100%',
      overflow: 'hidden',
    })}>
      <TextInput
        label="Name"
      />
      <TextInput
        label="Audio Input"
      />
      <TextInput
        label="Gain (?)"
      />
      <TextInput
        label="Disable Audio Output"
      />
    </div>
  );
}

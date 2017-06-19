import * as React from 'react';
import { css } from 'glamor';
import { Colors, Shadow } from '~/design/styles';

export function StudioRoomHeader() {
  return (
    <div
      {...css(Shadow.createDropShadow(), {
        padding: '2em',
        backgroundColor: Colors.white,
        borderBottom: `1px solid ${Colors.geyserDarker}`,
      })}
    />
  );
}

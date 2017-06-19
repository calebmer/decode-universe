import * as React from 'react';
import { Colors, Shadow } from '@decode/styles';
import { css } from 'glamor';

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

import * as React from 'react';
import { css } from 'glamor';
import { Colors, Shadow } from '@decode/styles';

// TODO: It may make sense to use a `<Panel>` component in the future.
export function StudioParticipant({
  backgroundColor = Colors.geyser,
  children,
}: {
  backgroundColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      {...css(Shadow.createDropShadow(), {
        overflow: 'hidden',
        height: '10em',
        borderRadius: '0.4em',
        backgroundColor,
      })}
    >
      {children}
    </div>
  );
}

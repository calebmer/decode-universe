import * as React from 'react';
import { css } from 'glamor';
import { Colors, Fonts, Shadow } from '@decode/styles';

export function Panel({
  width,
  title,
  children,
}: {
  width?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  const hasHeading = !!title;
  return (
    <div
      {...css(Shadow.createDropShadow(), {
        overflow: 'hidden',
        width,
        borderRadius: '0.4em',
        backgroundColor: Colors.geyser,
      })}
    >
      {hasHeading &&
        <header
          {...css(Fonts.title, {
            cursor: 'default',
            padding: '1em',
            paddingBottom: '1.5em',
            backgroundColor: Colors.white,
            borderBottom: `1px solid ${Colors.geyserDarker}`,
          })}
        >
          {title}
        </header>}
      {hasHeading
        ? <div {...css(Shadow.createInsetShadow({ top: true }))}>
            {children}
          </div>
        : children}
    </div>
  );
}

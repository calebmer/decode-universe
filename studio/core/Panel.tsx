import * as React from 'react';
import { css } from 'glamor';
import { Colors, Fonts, Shadow } from '~/design/styles';

export default function Panel({
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
          {...css(Fonts.panelTitle, {
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
        ? <div
            {...css({
              position: 'relative',
            })}
          >
            {children}
            <div
              {...css(
                Shadow.createInsetShadow({
                  color: Colors.geyserDarker,
                  top: true,
                }),
                {
                  pointerEvents: 'none',
                  position: 'absolute',
                  top: '0',
                  bottom: '0',
                  left: '0',
                  right: '0',
                },
              )}
            />
          </div>
        : children}
    </div>
  );
}

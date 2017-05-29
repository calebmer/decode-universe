import * as React from 'react';
import { css } from 'glamor';
import { Colors, Fonts } from '@decode/styles';
import { IconComponentType } from '../../icons/IconComponentType';

export function InputBox({
  inputID,
  label,
  labelPassthrough = false,
  icon: IconComponent,
  children,
}: {
  inputID?: string,
  label: string,
  labelPassthrough?: boolean,
  icon?: IconComponentType,
  children?: React.ReactNode,
}) {
  return (
    <div {...css({
      display: 'block',
      position: 'relative',
      margin: '-1px',
      border: `solid 1px ${Colors.geyserDarker}`,
    })}>
      <label
        {...css({
          pointerEvents: labelPassthrough ? 'none' : 'auto',
          cursor: 'normal',
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          paddingTop: '0.7em',
          paddingLeft: '1em',
        })}
        htmlFor={inputID}
      >
        <span {...css(Fonts.label)}>
          {label}
        </span>
      </label>
      {/* Clone the only child element and add some styles to make it look
        * nice. Other input specific styles will be added outside of this
        * component. */}
      {React.cloneElement(React.Children.only(children), css(Fonts.input, {
        fontSize: '0.8em',

        // Normally our padding is `1em` and `2.2em` respectively, but the
        // `fontSize` is `0.8em` so we need to scale them appropriately.
        padding: `${1 * (1 / 0.8)}em`,
        paddingTop: `${2.2 * (1 / 0.8)}em`,
        paddingRight: IconComponent ? `${3.4 * (1 / 0.8)}em` : null,

        ':focus': {
          outline: 'none',
          color: Colors.shark,
          backgroundColor: Colors.geyserDarker,
          ' + .icon': {
            color: Colors.shark,
          },
        },
      }))}
      {IconComponent && (
        <div
          className="icon"
          {...css({
            pointerEvents: 'none',
            position: 'absolute',
            top: '1.7em',
            right: '1.2em',
            color: Colors.osloGrey,
          })}
        >
          <IconComponent/>
        </div>
      )}
    </div>
  );
}

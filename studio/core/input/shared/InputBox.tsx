import * as React from 'react';
import { css } from 'glamor';
import { Colors, Fonts } from '~/design/styles';
import { IconComponentType } from '../../icons/IconComponentType';

const backgroundDarkBorderColor = 'rgba(255, 255, 255, 0.1)';

/**
 * We have done the math to make sure that each `<InputBox>` has a height of
 * exactly 4em. Therefore be careful when adjusting numbers. You might break
 * something.
 */
export default function InputBox({
  inputID,
  label,
  labelPassthrough = false,
  icon: IconComponent,
  backgroundDark = false,
  children,
}: {
  inputID?: string;
  label: string;
  labelPassthrough?: boolean;
  icon?: IconComponentType;
  backgroundDark?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      {...css({
        display: 'block',
        position: 'relative',
        margin: '-1px',
        border: `solid 1px ${!backgroundDark
          ? Colors.geyserDarker
          : backgroundDarkBorderColor}`,
      })}
    >
      <label
        {...css({
          pointerEvents: labelPassthrough ? 'none' : 'auto',
          cursor: 'default',
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          paddingTop: '0.8em',
          paddingLeft: '1em',
        })}
        htmlFor={inputID}
      >
        <span
          {...css(Fonts.label, {
            color: !backgroundDark ? Colors.shark : Colors.geyser,
          })}
        >
          {label}
        </span>
      </label>
      {/* Clone the only child element and add some styles to make it look
        * nice. Other input specific styles will be added outside of this
        * component. */}
      {React.cloneElement(
        React.Children.only(children),
        css(Fonts.input, {
          // Normally our padding is `1em` and `2.2em` respectively, but the
          // `fontSize` is `0.8em` so we need to scale them appropriately.
          boxSizing: 'border-box',
          height: 'calc(4em * (1 / 0.8))',
          paddingTop: `calc(2.2em * (1 / 0.8))`,
          paddingBottom: `calc(0.8em * (1 / 0.8))`,
          paddingLeft: `calc(1em * (1 / 0.8))`,
          paddingRight: IconComponent
            ? `calc(3.6em * (1 / 0.8))`
            : `calc(1em * (1 / 0.8))`,

          backgroundColor: !backgroundDark ? Colors.geyser : null,
          color: !backgroundDark ? Colors.osloGrey : Colors.geyserDarker,
          fontSize: '0.8em',

          ':focus': {
            outline: 'none',
            color: !backgroundDark ? Colors.shark : Colors.white,
            backgroundColor: !backgroundDark
              ? Colors.geyserDarker
              : backgroundDarkBorderColor,
            ' + .icon': {
              color: !backgroundDark ? Colors.shark : Colors.white,
            },
          },
        }),
      )}
      {IconComponent &&
        <div
          className="icon"
          {...css({
            pointerEvents: 'none',
            position: 'absolute',
            top: '1.8em',
            right: '1.3em',
            color: !backgroundDark ? Colors.osloGrey : Colors.geyserDarker,
          })}
        >
          <IconComponent />
        </div>}
    </div>
  );
}

import * as React from 'react';
import { css } from 'glamor';
import { Colors, Fonts, Shadow } from '@decode/styles';

const kinds = {
  blue: {
    backgroundColor: Colors.royalBlue,
    backgroundColorHover: Colors.royalBlueLighter,
    backgroundColorPressed: Colors.royalBlueDarker,
  },
  red: {
    backgroundColor: Colors.amaranth,
    backgroundColorHover: Colors.amaranthLighter,
    backgroundColorPressed: Colors.amaranthDarker,
  },
};

export function Button({
  kind = 'blue',
  label,
}: {
  kind?: keyof (typeof kinds);
  label: string;
}) {
  const kindStyles = kinds[kind];
  return (
    <button
      {...css({
        WebkitAppearance: 'none',
        cursor: 'pointer',
        display: 'inline-block',
        padding: '0.5em',
        paddingLeft: '2em',
        paddingRight: '2em',
        border: 'none',
        borderRadius: '2em',
        backgroundColor: kindStyles.backgroundColor,
        fontSize: '1em',
        ':hover': { backgroundColor: kindStyles.backgroundColorHover },
        ':focus': {
          outline: 'none',
          backgroundColor: kindStyles.backgroundColorHover,
        },
        ':active': {
          ...Shadow.createInsetShadow({ top: true }),
          backgroundColor: kindStyles.backgroundColorPressed,
          ' > .label': {
            opacity: '0.8',
          },
        },
      })}
      onMouseUp={handleButtonMouseUp}
    >
      <span
        className="label"
        {...css(Fonts.label, {
          color: Colors.white,
          lineHeight: '1em',
        })}
      >
        {label}
      </span>
    </button>
  );
}

function handleButtonMouseUp(event: React.MouseEvent<HTMLButtonElement>) {
  // If the button was clicked with the mouse then we do not need to maintain
  // focus since the user is not a keyboard user and we can blur the button.
  event.currentTarget.blur();
}

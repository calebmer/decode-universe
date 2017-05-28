import * as React from 'react';
import { css } from 'glamor';
import { Colors, Fonts } from '@decode/styles';

export function TextInput({
  label,
}: {
  label: string,
}) {
  return (
    <label {...css({
      display: 'block',
      position: 'relative',
      margin: '-1px',
      border: `solid 1px ${Colors.geyserDarker}`,
    })}>
      <div {...css({
        cursor: 'default',
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        paddingTop: '0.7em',
        paddingLeft: '1em',
      })}>
        <span {...css(Fonts.label)}>
          {label}
        </span>
      </div>
      <input
        {...css(Fonts.input, {
          WebkitAppearance: 'initial',
          width: '100%',
          border: 'none',
          backgroundColor: 'initial',
          fontSize: '0.8em',

          // Normally our padding is `1em` and `2.2em` respectively, but the
          // `fontSize` is `0.8em` so we need to scale them appropriately.
          padding: `${1 * (1 / 0.8)}em`,
          paddingTop: `${2.2 * (1 / 0.8)}em`,

          ':focus': {
            outline: 'none',
            color: Colors.shark,
            backgroundColor: Colors.geyserDarker
          },
        })}
        defaultValue="john.smith@email.com"
      />
    </label>
  );
}

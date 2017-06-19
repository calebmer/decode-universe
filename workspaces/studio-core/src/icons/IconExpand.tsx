import * as React from 'react';
import { css } from 'glamor';

export function IconExpand({
  size = '1em',
  color = 'currentColor',
}: {
  size?: string;
  color?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      width={size}
      height={`calc((94 / 170) * ${size})`}
      viewBox="0 0 170 94"
      {...css({
        lineHeight: '1em',
      })}
    >
      <g
        transform="translate(84.852814, 8.852814) rotate(-45) translate(-84.852814, -8.852814) translate(24.852814, -51.147186)"
        fill={color}
      >
        <rect x="12" y="108" width="108" height="12" />
        <rect x="0" y="0" width="12" height="120" />
      </g>
    </svg>
  );
}

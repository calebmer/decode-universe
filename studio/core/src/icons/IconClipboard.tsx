import * as React from 'react';

export function IconClipboard({
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
      height={size}
      viewBox="0 0 16 16"
    >
      <defs>
        <clipPath id="clipboard-clip-0">
          <path d="M11 3v2h-9v-2h-2v13h13v-13z" />
        </clipPath>
      </defs>
      <g>
        <path
          fill={color}
          clipPath="url(#clipboard-clip-0)"
          d="M12.75 16h-12.5c-.138 0-.25-.112-.25-.25v-12.5c0-.138.112-.25.25-.25h12.5c.138 0 .25.112.25.25v12.5c0 .138-.112.25-.25.25z"
        />
        <path
          fill="none"
          stroke={color}
          d="M7.5 3.021v-1.521c0-.552-.448-1-1-1s-1 .448-1 1v1.479"
        />
        <path
          fill={color}
          d="M9 2h-5c-.55 0-1 .45-1 1v1h7v-1c0-.55-.45-1-1-1z"
        />
      </g>
    </svg>
  );
}

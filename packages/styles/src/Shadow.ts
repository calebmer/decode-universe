import { Colors } from './Colors';

function createDropShadow(
  {
    color = Colors.shark,
  }: {
    color?: string;
  } = {},
) {
  return {
    boxShadow: `0 0.4em 1.5em -0.3em ${color}`,
  };
}

function createInsetShadow(
  {
    color = 'rgba(0, 0, 0, 0.1)',
    top = false,
    bottom = false,
  }: {
    color?: string;
    top?: boolean;
    bottom?: boolean;
  } = {},
) {
  const boxShadows = [
    top && `inset 0 0.5em 0.3em -0.3em ${color}`,
    bottom && `inset 0 -0.5em 0.3em -0.3em ${color}`,
  ].filter(Boolean);
  return {
    boxShadow: boxShadows.length !== 0 ? boxShadows.join(', ') : undefined,
  };
}

export const Shadow = {
  createDropShadow,
  createInsetShadow,
};

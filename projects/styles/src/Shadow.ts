import { Colors } from './Colors';

function createDropShadow({
  color = Colors.shark,
}: {
  color?: string,
} = {}) {
  return {
    boxShadow: `0 0.4em 1.5em -0.3em ${color}`,
  };
}

function createInsetShadow({
  color = Colors.geyserDarker,
  top = false,
}: {
  color?: string,
  top?: boolean,
} = {}) {
  return {
    boxShadow: top ? `inset 0 0.5em 0.3em -0.3em ${color}` : undefined,
  };
}

export const Shadow = {
  createDropShadow,
  createInsetShadow,
};

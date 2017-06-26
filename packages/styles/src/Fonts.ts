// TODO: npm install Montserrat and thank @kylematthews on Twitter.

import { Colors } from './Colors';

export const FontWeights = {
  normal: '400',
  medium: '500',
  bold: '700',
};

export const Fonts = {
  panelTitle: {
    color: Colors.shark,
    fontFamily: "'Montserrat', sans-serif",
    fontSize: '1em',
    fontWeight: FontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.06ch',
  },
  title: {
    color: Colors.shark,
    fontFamily: "'Montserrat', sans-serif",
    fontSize: '1.2em',
    fontWeight: FontWeights.medium,
    letterSpacing: '0.06ch',
  },
  subtitle: {
    color: Colors.osloGrey,
    fontFamily: "'Montserrat', sans-serif",
    fontSize: '0.8em',
    fontWeight: FontWeights.normal,
  },
  label: {
    color: Colors.shark,
    fontFamily: "'Montserrat', sans-serif",
    fontSize: '0.8em',
    fontWeight: FontWeights.medium,
    textTransform: 'uppercase',
    letterSpacing: '0.06ch',
  },
  input: {
    color: Colors.osloGrey,
    fontFamily: "'Montserrat', sans-serif",
    fontSize: '0.8em',
    fontWeight: FontWeights.normal,
  },
};

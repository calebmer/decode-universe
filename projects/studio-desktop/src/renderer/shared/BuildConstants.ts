declare const WEBPACK_BUILD_CONSTANTS: any;

export const BuildConstants: {
  INITIAL_ROOM: string | null;
  SIGNAL_SERVER_URL: string;
  WEB_URL: string;
} = WEBPACK_BUILD_CONSTANTS;

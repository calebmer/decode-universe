export const BuildConstants: {
  SIGNAL_SERVER_URL: string;
} =
  // We set `BuildConstants` to null because webpack will replace all references
  // to `BuildConstants` and our minifier should strip away this const
  // declaration. We really only want this file for the types
  null as any;

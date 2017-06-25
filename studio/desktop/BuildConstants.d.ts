interface BuildConstants {
  /**
   * The url for where `~/studio/signal/server` is deployed.
   */
  STUDIO_SIGNAL_SERVER_URL: string;
  /**
   * The root url for where `~/studio/web` is deployed. Used to generated urls
   * which can be shared by the host.
   */
  STUDIO_WEB_URL: string;
  /**
   * Instead of opening to the recordings directory configuring this constant
   * allows the app to instantly open to some recording room. This will not
   * be set in production, but in development it may be useful to set this to
   * `dev`.
   */
  INITIAL_ROOM: string | null;
}

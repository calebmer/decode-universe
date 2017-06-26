# Decode Studio Core

All of the common networking and UI code between the `~/studio/desktop` and `~/studio/web` workspaces. Most of the code for these two projects actually lives in this core project. All that’s left for those two projects is just the build system and any extra UI or functionality that may need to be built for the users of those applications.

## Architecture

The following describes some important architectural notes about the code in `~/studio/core`. This is not comprehensive as we attempt to thoroughly document all non-obvious code.

- **`StudioRoomController.createComponent()`:** This function allows users to create a `<StudioRoomController/>` component class with appropriate configuration options. This is used in both `studio-desktop` and `studio-web` to create a component with specific behaviors for each platform. For instance both projects need to be able to create different `PeersMesh` instances. Using a `createComponent()` function is superior to a component with lots of props for configuration because we don’t need to constantly check and see if the props changed and update our state appropriately. Instead we can depend on the provided configuration to be constant across the component’s life. The created `<StudioRoomController/>` component controls most of the state and UI for the studio applications including the construction and management of `PeersMesh` instances and lifecycles. The created component takes a single prop, `roomName`.
- **`PeersMesh`:** This class is the orchestration layer that will connect all of the peers in a recording session with a [WebRTC mesh network topology][]. That name may sound complicated but it’s really not! In reality it just means that each peer has a direct connection to every other peer. Each peer is tracked by an instance of `Peer`.
- **`Peer`:** A single connection to one of the peers. Manages the sharing of audio and state across the connection between the two peers.
- **`Recorder`:** An interface which represents any audio source that may be recorded. It outputs a stream of `Float32Array`s after a `start()` method is called. The two implementations of `Recorder` are `LocalRecorder` and `RemoteRecorder` which are worth explaining. When recording the host will create one `LocalRecorder` for their own audio and one `RemoteRecorder` instance for ever peer.
  - **`LocalRecorder`:** Records the local audio or silence if there is no local audio to be recorded at the time. Does not touch the network.
  - **`RemoteRecorder`:** Records audio from a `Peer` across the network. On the other end of the `Peer` connection the `Peer` should have instantiated a `RemoteRecordee` instance which uses a `LocalRecorder` and streams the result to a data channel which the `Peer` sends back to the `RemoteRecorder`. For more information on how this works make sure to check out the `./src/rtc/audio/RemoteRecorderProtocol.ts` file.

[WebRTC mesh network topology]: https://webrtcglossary.com/mesh/

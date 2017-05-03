# TODO

- [x] Play audio.
- [x] Record audio and save it.
- [ ] Audio recordings browser.
- [x] Mute own audio.
- [ ] Mute the audio of others (host only).
- [ ] Some way to visualize any errors that occur.
- [x] Disconnected status rendering for peers.
- [x] Test how it works on terrible networks.
- [ ] Test how it works between far away peers.
- [ ] Test how it works for many users.
- [x] Investigate what happens when negotiations fail between peers.
- [x] Investigate what happens when a guest joins the room after a recording has started.
- [ ] Investigate what happens when a guest temporarily disconnects while recording.
- [ ] Preparation checklist for guests and host in setup.
  - [ ] Are you clipping? Should your mic volume be lower?
  - [ ] Is there cross talk? Can we detect someone talking on another track?
- [x] What do we do if a peer is disconnecting when the user hits the record button?
- [ ] In-recording warnings.
- [ ] Don’t allow certain browsers.
- [x] What happens when there are no input devices?
- [x] What happens when a user does not allow access to a media device?
- [ ] Deploy signaling server.
- [ ] Deploy web guest UI.
- [x] Kick out guests that are connecting.
- [x] Show loading if waiting for guests to connect while recording.
- [ ] Investigate crazy noise in Electron.
- [ ] See if you can re-negotiate if no audio shows up.
- [x] Some negotiation state errors are happening. Think long and hard about why...
- [x] Work on audio quality some more.
  - [x] Do dynamics compression on the audio before sending it over the network.
  - [x] Why are output tracks so loud?
- [ ] Text chat room.
- [ ] Room state. Guests need to know if we are recording or not!
- [ ] Search for `TODO` and try to resolve those notes.
- [ ] Auto-update desktop app.
- [ ] Try to re-enable echo cancellation.
- [ ] Mute/unmute with a hot key.
- [ ] Timer which counts up how long you have been recording.
- [ ] Record the chat and add timestamps so that editors/producers can quickly jump to certain points!

## Deploys
- https://decode-studio-web-eqklfsfrre.now.sh
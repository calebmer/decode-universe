import * as React from 'react';
import { css } from 'glamor';
import { StudioParticipantInvite } from './StudioParticipantInvite';

export function StudioRoomParticipants({
  inviteURL,
}: {
  inviteURL: string | null;
}) {
  return (
    <ul
      {...css({
        display: 'flex',
        flexWrap: 'wrap',
        listStyle: 'none',
        padding: '0',
        margin: '-1em',
      })}
    >
      <StudioRoomParticipants_item inviteURL={inviteURL} />
      <StudioRoomParticipants_item inviteURL={inviteURL} />
      <StudioRoomParticipants_item inviteURL={inviteURL} />
      <StudioRoomParticipants_item inviteURL={inviteURL} />
      <StudioRoomParticipants_item inviteURL={inviteURL} />
      <StudioRoomParticipants_item inviteURL={inviteURL} />
    </ul>
  );
}

function StudioRoomParticipants_item({
  inviteURL,
}: {
  inviteURL: string | null;
}) {
  return (
    <li
      {...css({
        display: 'block',
        width: 'calc(50% - 2em)',
        margin: '1em',
      })}
    >
      <StudioParticipantInvite
        inviteURL={inviteURL || 'http://localhost:1999/?room=dev'}
      />
    </li>
  );
}

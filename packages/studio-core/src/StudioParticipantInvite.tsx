import * as React from 'react';
import { css } from 'glamor';
import { Colors, Fonts } from '@decode/styles';
import { ShareTextInput } from './shared/input/ShareTextInput';
import { StudioParticipant } from './StudioParticipant';

export function StudioParticipantInvite({
  inviteURL,
}: {
  inviteURL: string;
}) {
  return (
    <StudioParticipant backgroundColor={Colors.osloGrey}>
      <section
        {...css({
          paddingBottom: '1.5em',
        })}
      >
        <header
          {...css({
            cursor: 'default',
            padding: '1em',
            textAlign: 'center',
          })}
        >
          <h1
            {...css(Fonts.title, {
              margin: '0',
              color: Colors.white,
              fontSize: '1.2em',
              lineHeight: '1em',
            })}
          >
            Invite Guest
          </h1>
          <div
            {...css({
              width: '100%',
              height: '0.5em',
            })}
          />
          <p
            {...css(Fonts.subtitle, {
              margin: '0',
              color: Colors.geyserDarker,
              fontSize: '0.8em',
              lineHeight: '1em',
            })}
          >
            click to copy the room url then share it with your guest
          </p>
        </header>
        <ShareTextInput
          label="Room URL"
          value={inviteURL}
          backgroundDark={true}
        />
      </section>
    </StudioParticipant>
  );
}

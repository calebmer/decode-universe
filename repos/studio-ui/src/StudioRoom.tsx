import * as React from 'react';
import { StudioParticipant } from "./StudioParticipant";

export class StudioRoom extends React.Component<{}, {}> {
  render() {
    return (
      <ul>
        <li><StudioParticipant/></li>
        <li><StudioParticipant/></li>
        <li><StudioParticipant/></li>
      </ul>
    );
  }
}

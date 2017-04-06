import * as React from 'react';
import { UserAudio } from './audio/UserAudio';
import { AudioVisualization } from './audio/AudioVisualization';

export class StudioRoom extends React.Component<{}, {}> {
  render() {
    return (
      <UserAudio render={userAudio => (
        userAudio.rejected ? (
          <div>Error!</div>
        ) : (
          <div>
            <p>{userAudio.loading ? 'Loading…' : 'Yay!'}</p>
            <div style={{
              width: '500px',
              height: '100px',
              backgroundColor: 'tomato',
            }}>
              {!userAudio.loading && (
                <AudioVisualization node={userAudio.source}/>
              )}
            </div>
          </div>
        )
      )}/>
    );
  }
}

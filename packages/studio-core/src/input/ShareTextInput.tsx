import * as React from 'react';
import { css } from 'glamor';
import { IconClipboard } from '../icons/IconClipboard';
import { InputComponent } from './shared/InputComponent';
import { InputBox } from './shared/InputBox';

type Props = {
  label: string;
  value: string;
  backgroundDark?: boolean;
};

export class ShareTextInput extends InputComponent<Props, {}> {
  handleInviteInputClick = (event: React.MouseEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    input.select();
    document.execCommand('copy');
    // TODO: Notification telling the user they have copied the URL.
  };

  render() {
    const { label, value, ...rest } = this.props;
    return (
      <InputBox
        {...rest}
        inputID={this.inputID}
        label={label}
        labelPassthrough={true}
        icon={IconClipboard}
      >
        <input
          {...css({
            WebkitAppearance: 'none',
            cursor: 'pointer',
            width: '100%',
            backgroundColor: 'transparent',
            border: 'none',
          })}
          id={this.inputID}
          type="text"
          readOnly={true}
          value={value}
          onClick={this.handleInviteInputClick}
        />
      </InputBox>
    );
  }
}

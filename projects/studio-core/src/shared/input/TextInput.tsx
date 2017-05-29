import * as React from 'react';
import { css } from 'glamor';
import { InputComponent } from './shared/InputComponent';
import { InputBox } from './shared/InputBox';

type Props = {
  label: string,
  value: string,
  onChange: (value: string) => void,
};

export class TextInput extends InputComponent<Props, {}> {
  private handleChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    this.props.onChange(event.target.value);

  render() {
    const { label, value } = this.props;
    return (
      <InputBox
        inputID={this.inputID}
        label={label}
      >
        <input
          id={this.inputID}
          type="text"
          value={value}
          onChange={this.handleChange}
          {...css({
            WebkitAppearance: 'none',
            width: '100%',
            backgroundColor: 'transparent',
            border: 'none',
          })}
        />
      </InputBox>
    );
  }
}

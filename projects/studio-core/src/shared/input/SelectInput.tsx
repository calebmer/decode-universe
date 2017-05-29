import * as React from 'react';
import { css } from 'glamor';
import { IconExpand } from '../icons/IconExpand';
import { InputComponent } from './shared/InputComponent';
import { InputBox } from './shared/InputBox';

type Props = {
  label: string,
  value: string,
  options: Array<{ value: string, label: string }>,
  onChange: (value: string) => void,
};

export class SelectInput extends InputComponent<Props, {}> {
  private handleChange = (event: React.ChangeEvent<HTMLSelectElement>) =>
    this.props.onChange(event.target.value);

  render() {
    const { label, value, options } = this.props;
    return (
      <InputBox
        inputID={this.inputID}
        label={label}
        labelPassthrough={true}
        icon={IconExpand}
      >
        <select
          id={this.inputID}
          value={value}
          onChange={this.handleChange}
          {...css({
            WebkitAppearance: 'none',
            cursor: 'pointer',
            display: 'block',
            width: '100%',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '0',
          })}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </InputBox>
    );
  }
}

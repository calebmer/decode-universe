import * as React from 'react';
import { css } from 'glamor';
import { InputComponent } from './shared/InputComponent';
import { InputBox } from './shared/InputBox';

type Props = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
};

export class RangeInput extends InputComponent<Props, {}> {
  private handleChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    this.props.onChange(parseInt(event.target.value, 10) || 0);

  render() {
    const { label, min, max, step, value } = this.props;
    return (
      <InputBox inputID={this.inputID} label={label}>
        <div>
          <input
            id={this.inputID}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={this.handleChange}
            {...css({
              width: '100%',
              margin: '0',
            })}
          />
        </div>
      </InputBox>
    );
  }
}

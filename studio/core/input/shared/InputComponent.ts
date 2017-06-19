import * as React from 'react';
import { slugify } from '~/utils/universal/slugify';

export type Props = {
  label?: string;
};

export abstract class InputComponent<
  TProps extends Props,
  TState
> extends React.PureComponent<TProps, TState> {
  /**
   * Whenever we create an input id we track it here. If we ever have duplicate
   * input ids then we use this map to dedupe the names by adding the count.
   */
  private static readonly inputIDCounts = new Map<string, number>();

  /**
   * Creates an input id for the component using the component’s props.
   */
  private static createInputID(props: Props): string {
    // Get the name of the class.
    const className = this.name;
    // We start the input id with the class name.
    //
    // If we got a label in the props then add the slugified label to the input
    // id.
    const inputID = className + (props.label ? `-${slugify(props.label)}` : '');
    // If we do not have an input with this id then set the input id in the map
    // with a count of 1.
    //
    // Otherwise update the count for the input id in our map and add one. Also
    // add the count (plus 1) to the end of the input id.
    if (!this.inputIDCounts.has(inputID)) {
      this.inputIDCounts.set(inputID, 1);
      return inputID;
    } else {
      const count = this.inputIDCounts.get(inputID)!;
      this.inputIDCounts.set(inputID, count + 1);
      return `${inputID}-${count + 1}`;
    }
  }

  /**
   * A unique identifier for this input that we can use for accessibility
   * purposes.
   */
  protected readonly inputID = (this
    .constructor as typeof InputComponent).createInputID(this.props);

  abstract render(): JSX.Element | null;
}

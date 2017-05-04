import * as React from 'react';
import { EventEmitter, Disposable } from '@decode/jsutils';

type Props = {
  emitter: EventEmitter<any>,
  event: string,
  render: () => JSX.Element | null,
};

export class EventListener extends React.PureComponent<Props, {}> {
  componentDidMount() {
    this.listen();
  }

  componentDidUpdate(previousProps: Props) {
    const nextProps = this.props;
    if (
      previousProps.emitter !== nextProps.emitter ||
      previousProps.event !== nextProps.event
    ) {
      this.listen();
    }
  }

  componentWillUnmount() {
    if (this.disposable !== null) {
      this.disposable.dispose();
    }
  }

  private disposable: Disposable | null = null;

  private listen() {
    const { emitter, event } = this.props;
    if (this.disposable !== null) {
      this.disposable.dispose();
    }
    this.disposable = emitter.on(event, () => this.forceUpdate());
  }

  render() {
    return this.props.render();
  }
}

import * as React from 'react';

const animatingComponents: Array<AudioVisualization> = [];

export type Props = {
  node: AudioNode;
};

/**
 * Renders an `<svg>` visualization of an `AudioNode` that fills its container.
 */
export class AudioVisualization extends React.PureComponent<Props, {}> {
  /**
   * An instance of `AnalyserNode` we use in conjunction with the `analyserData`
   * array to get the frequency data of the `AudioNode` passed in as a prop.
   */
  analyser: AnalyserNode;

  /**
   * A pre-allocated array of unsigned integers that we fill with data from
   * `analyser` on every animation frame before we draw the bars.
   */
  analyserData: Uint8Array;

  /**
   * The number of bars which will be rendered. This may be less then the length
   * of `analyserData` in case we don’t want to visualize some of the higher
   * indexed frequency data in `analyserData`.
   */
  barsCount: number;

  /**
   * An array of SVG `<rect>` DOM elements that we can mutate in an animation
   * frame.
   */
  bars: Array<SVGRectElement> = [];

  constructor(props: Props) {
    super(props);
    this.updateInstance();
  }

  componentDidMount() {
    animatingComponents.push(this);
    tryStartAnimationLoop();
  }

  componentWillUpdate(nextProps: Props) {
    if (this.props.node !== nextProps.node) {
      this.updateInstance(nextProps.node);
    }
  }

  componentWillUnmount() {
    animatingComponents.splice(animatingComponents.indexOf(this), 1);
    tryStopAnimationLoop();
  }

  /**
   * Updates the instance whenever we get a new `AudioNode`. This method is
   * idempotent so it can be called when the class has not yet setup instance
   * variables and can be called when the class has setup instance variables and
   * there will be no difference in effect.
   *
   * Initializes values for `analyser`, `analyserData`, and `barsCount`.
   */
  updateInstance(node: AudioNode = this.props.node) {
    const analyser = node.context.createAnalyser();
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.85;
    analyser.fftSize = 256;
    node.connect(analyser);
    const analyserData = new Uint8Array(analyser.frequencyBinCount);
    this.analyser = analyser;
    this.analyserData = analyserData;

    // Cut off the last x% of bars as it seems that in practice they rarely
    // have data.
    this.barsCount = Math.round(
      analyserData.length - analyserData.length * 0.7,
    );
  }

  render() {
    const { barsCount } = this;
    const barMargin = 0.6;
    const barJsxNodes: Array<JSX.Element> = [];

    for (let i = 0; i < barsCount; i++) {
      barJsxNodes.push(
        <rect
          key={i}
          ref={rect => (this.bars[i] = rect)}
          height={0}
          width={100 / barsCount - barMargin}
          x={100 / barsCount * i}
          y={100}
        />,
      );
    }

    return (
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        viewBox={`0 0 ${100 - barMargin} 100`}
      >
        {barJsxNodes}
      </svg>
    );
  }
}

let nextAnimationFrameID: number | null = null;

/**
 * If there is no scheduled next animation frame, and there are components in
 * `animatingComponents`, schedule an animation frame.
 */
function tryStartAnimationLoop() {
  if (animatingComponents.length > 0 && nextAnimationFrameID == null) {
    nextAnimationFrameID = requestAnimationFrame(updateComponentVisualizations);
  }
}

/**
 * If there are no more components in the `animatingComponents` array, we can
 * cancel the next animation frame.
 */
function tryStopAnimationLoop() {
  if (animatingComponents.length === 0 && nextAnimationFrameID != null) {
    cancelAnimationFrame(nextAnimationFrameID);
    nextAnimationFrameID = null;
  }
}

const maxFrequency = 210;

/**
 * Update the animating component visualizations and schedule another animation
 * frame.
 */
function updateComponentVisualizations() {
  nextAnimationFrameID = requestAnimationFrame(updateComponentVisualizations);

  for (const component of animatingComponents) {
    const { analyser, analyserData, barsCount, bars } = component;

    analyser.getByteFrequencyData(analyserData);

    for (let i = 0; i < barsCount; i++) {
      const rect = bars[i];
      const frequency = analyserData[i];
      const height = Math.round(
        Math.min(frequency, maxFrequency) / maxFrequency * 100,
      );

      rect.setAttribute('height', `${height}`);
      rect.setAttribute('y', `${100 - height}`);
    }
  }
}

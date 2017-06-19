import * as React from 'react';

export type Props = {
  context: AudioContext;
  node: AudioNode;
};

/**
 * An audio visualization component the style of which was selected through
 * conversations with audio engineers and looking at industry best practices.
 *
 * An audio [mixing console][1] visualizes audio (via LEDs) with a [peak
 * meter][2]. [Logic pro][3] does this as well. You can see the [modern design
 * of Logic’s peak meter on Apple’s website][4]. On GitHub there is a reference
 * peak meter implementation in JavaScript using the web audio APIs at
 * [`esonderegger/web-audio-peak-meter`][5], however it uses a
 * `ScriptProcessorNode` and we would like to use an `AnalyserNode`.
 *
 * [1]: https://en.wikipedia.org/wiki/Mixing_console
 * [2]: https://en.wikipedia.org/wiki/Peak_meter
 * [3]: http://logicstudiotraining.com/members/logic-pro-mixing-metering-and-loudness-explained/
 * [4]: https://images.apple.com/logic-pro/images/mix_large_2x.jpg
 * [5]: https://github.com/esonderegger/web-audio-peak-meter
 */
export class AudioPeakMeter extends React.PureComponent<Props, {}> {
  /**
   * An instance of `AnalyserNode` we use in conjunction with the `analyserData`
   * array to get the frequency data of the `AudioNode` passed in as a prop.
   */
  private analyser: AnalyserNode;

  /**
   * A pre-allocated array of unsigned integers that we fill with data from
   * `analyser` on every animation frame before we draw the bars.
   */
  private analyserData: Float32Array;

  constructor(props: Props) {
    super(props);
    this.updateInstance();
  }

  componentDidMount() {
    AudioPeakMeter.animatingComponents.add(this);
    AudioPeakMeter.tryStartAnimationLoop();
  }

  componentDidUpdate(previousProps: Props) {
    const nextProps = this.props;
    // Update the component instance if the audio node or audio context changed!
    if (
      previousProps.node !== nextProps.node ||
      previousProps.context !== nextProps.context
    ) {
      this.updateInstance();
    }
  }

  componentWillUnmount() {
    AudioPeakMeter.animatingComponents.delete(this);
    AudioPeakMeter.tryStopAnimationLoop();
  }

  /**
   * Updates various properties on our class instance. This should be run
   * whenever we get a new set of props.
   */
  private updateInstance() {
    const { context, node } = this.props;
    const analyser = context.createAnalyser();
    // analyser.fftSize = 32;
    node.connect(analyser);
    const analyserData = new Float32Array(analyser.frequencyBinCount);
    this.analyser = analyser;
    this.analyserData = analyserData;
  }

  render() {
    return null;
  }

  private static animatingComponents = new Set<AudioPeakMeter>();

  private static nextAnimationFrameID: number | null = null;

  /**
   * If there is no scheduled next animation frame, and there are components in
   * `animatingComponents`, schedule an animation frame.
   */
  private static tryStartAnimationLoop() {
    if (
      this.animatingComponents.size > 0 &&
      this.nextAnimationFrameID === null
    ) {
      this.nextAnimationFrameID = requestAnimationFrame(
        this.updateComponentVisualizations,
      );
    }
  }

  /**
   * If there are no more components in the `animatingComponents` array, we can
   * cancel the next animation frame.
   */
  private static tryStopAnimationLoop() {
    if (
      this.animatingComponents.size === 0 &&
      this.nextAnimationFrameID !== null
    ) {
      cancelAnimationFrame(this.nextAnimationFrameID);
      this.nextAnimationFrameID = null;
    }
  }

  /**
   * Update the animating component visualizations and schedule another animation
   * frame.
   */
  private static updateComponentVisualizations() {
    this.nextAnimationFrameID = requestAnimationFrame(
      this.updateComponentVisualizations,
    );
    // For every compoment that is animating we want to update the
    // visualization.
    this.animatingComponents.forEach(component => {
      const { analyser, analyserData } = component;
      analyser.getFloatTimeDomainData(analyserData);

      // Get the peak of the analyser data by iterating through all of the data
      // points and picking the largest.
      let peak = -Infinity;
      const { length } = analyserData;
      for (let i = 0; i < length; i++) {
        const x = Math.abs(analyserData[i]);
        if (x > peak) {
          peak = x;
        }
      }

      console.log(peak);
    });
  }
}

// Bind `AudioPeakMeter` to the `updateComponentVisualizations()` method so that
// we can easily pass the method into `requestAnimationFrame`.
(AudioPeakMeter as any).updateComponentVisualizations = (AudioPeakMeter as any).updateComponentVisualizations.bind(
  AudioPeakMeter,
);

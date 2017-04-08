// Extend the `MediaDevices` interface provided by the TypeScript lib.
declare interface MediaDevices {
  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices
   */
  enumerateDevices(): Promise<Array<MediaDeviceInfo>>;
}

// Extend the `RTCPeerConnection` interface provided by the TypeScript lib.
declare interface RTCPeerConnection {
  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel
   */
  createDataChannel(label: string, options: RTCDataChannelInit): RTCDataChannel;
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel#RTCDataChannelInit_dictionary
 */
declare type RTCDataChannelInit = {
  ordered?: boolean,
  maxPacketLifeTime?: number,
  maxRetransmits?: number,
  protocol?: string,
  negotiated?: boolean,
  id?: number,
};

interface RTCDataChannelEventMap {
  'bufferedamountlow': Event;
  'close': Event;
  'error': ErrorEvent;
  'message': MessageEvent;
  'open': Event;
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel
 */
declare interface RTCDataChannel extends EventTarget {
  binaryType: string;
  readonly bufferedAmount: number;
  readonly bufferedAmountLowThreshold: number;
  readonly id: number;
  readonly label: string;
  readonly maxPacketLifeTime: number;
  readonly maxRetransmits: number;
  readonly negotiated: boolean;
  readonly ordered: boolean;
  readonly protocol: string;
  readonly readyState: 'connecting' | 'open' | 'closing' | 'closed';
  onbufferedamountlow: (this: RTCDataChannel, ev: Event) => any;
  onclose: (this: RTCDataChannel, ev: Event) => any;
  onerror: (this: RTCDataChannel, ev: ErrorEvent) => any;
  onmessage: (this: RTCDataChannel, ev: MessageEvent) => any;
  onopen: (this: RTCDataChannel, ev: Event) => any;
  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/close
   */
  close(): void;
  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/send
   */
  send(data: USVString | Blob | ArrayBuffer | ArrayBufferView): void;

  addEventListener<K extends keyof RTCDataChannel>(type: K, listener: (this: RTCDataChannel, ev: RTCDataChannel[K]) => any, useCapture?: boolean): void;
}

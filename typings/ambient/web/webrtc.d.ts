// Extend the `MediaDevices` interface provided by the TypeScript lib.
declare interface MediaDevices {
  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices
   */
  enumerateDevices(): Promise<Array<MediaDeviceInfo>>;
}

// Extend the `RTCPeerConnection` interface provided by the TypeScript lib.
declare interface RTCPeerConnection {
  ondatachannel: (this: RTCPeerConnection, ev: RTCDataChannelEvent) => any;
  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel
   */
  createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel;
}

// Extend the `RTCPeerConnectionEventMap` interface provided by the TypeScript lib.
interface RTCPeerConnectionEventMap {
  'datachannel': RTCDataChannelEvent;
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

  close(): void;
  send(data: USVString | Blob | ArrayBuffer | ArrayBufferView): void;

  onbufferedamountlow: (this: RTCDataChannel, ev: Event) => any;
  onclose: (this: RTCDataChannel, ev: Event) => any;
  onerror: (this: RTCDataChannel, ev: ErrorEvent) => any;
  onmessage: (this: RTCDataChannel, ev: MessageEvent) => any;
  onopen: (this: RTCDataChannel, ev: Event) => any;

  addEventListener<K extends keyof RTCDataChannelEventMap>(type: K, listener: (this: RTCDataChannel, ev: RTCDataChannelEventMap[K]) => any, useCapture?: boolean): void;
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannelEvent
 */
declare interface RTCDataChannelEvent extends Event {
  readonly channel: RTCDataChannel;
}

jest.unmock('../PeerMesh');

import * as React from 'react';
import { shallow, mount } from 'enzyme';
import { SignalClient } from '@decode/studio-signal-exchange/client';
import { PeerMesh } from '../PeerMesh';

function wait(ms = 0) {
  return new Promise(resolve => setTimeout(() => resolve(), ms));
}

global.RTCDataChannel = jest.fn(class RTCDataChannel {
  addEventListener = jest.fn();
  close = jest.fn();
});

global.RTCPeerConnection = jest.fn(class RTCPeerConnection {
  createOffer = jest.fn(() => ({ sdp: '' }));
  createAnswer = jest.fn(() => ({ sdp: '' }));
  setLocalDescription = jest.fn();
  setRemoteDescription = jest.fn();
  addIceCandidate = jest.fn();
  createDataChannel = jest.fn(() => new RTCDataChannel());
  close = jest.fn();

  __eventListeners = new Map();

  __emit = (eventName, event) => {
    for (const listener of this.__eventListeners.get(eventName) || []) {
      listener(event);
    }
  };

  addEventListener = jest.fn((eventName, listener) => {
    if (!this.__eventListeners.has(eventName)) {
      this.__eventListeners.set(eventName, []);
    }
    this.__eventListeners.get(eventName).push(listener);
  });
});

global.RTCSessionDescription = jest.fn(value => value);
global.RTCIceCandidate = jest.fn(value => value);

test('renders from the render prop', () => {
  const jsx = <div>Hello, <strong>world</strong>!</div>;
  const wrapper = shallow(
    <PeerMesh
      roomName="test"
      data={{ name: 'Test' }}
      stream={null}
      render={() => jsx}
    />
  );
  expect(wrapper.html()).toEqual('<div>Hello, <strong>world</strong>!</div>');
});

test('initializes a signal client and connect it then disconnect it', () => {
  SignalClient.mockClear();
  SignalClient.prototype.connect.mockReturnValue([]);
  const roomName = Symbol('roomName');
  const wrapper = mount(
    <PeerMesh
      roomName={roomName}
      data={{ name: 'Test' }}
      stream={null}
      render={() => null}
    />
  );
  expect(SignalClient.mock.calls).toEqual([
    [{
      roomName,
      onSignal: expect.any(Function),
    }],
  ]);
  const [signalClient] = SignalClient.mock.instances;
  expect(signalClient.connect).toHaveBeenCalled();
  expect(signalClient.close).not.toHaveBeenCalled();
  wrapper.unmount();
  expect(signalClient.close).toHaveBeenCalled();
});

test('creates peer connections and data channels and then close them on unmount', async () => {
  SignalClient.mockClear();
  RTCPeerConnection.mockClear();
  RTCDataChannel.mockClear();
  const peerAddress1 = 'peerAddress1';
  const peerAddress2 = 'peerAddress2';
  SignalClient.prototype.connect
    .mockReturnValueOnce([])
    .mockReturnValueOnce([peerAddress1, peerAddress2]);
  const wrapper1 = mount(
    <PeerMesh
      roomName="test 1"
      data={{ name: 'Test' }}
      stream={null}
      render={() => null}
    />
  );
  await wait();
  expect(RTCPeerConnection).not.toHaveBeenCalled();
  expect(wrapper1.state().peers).toEqual({});
  wrapper1.unmount();
  const wrapper2 = mount(
    <PeerMesh
      roomName="test 2"
      data={{ name: 'Test' }}
      stream={null}
      render={() => null}
    />
  );
  await wait();
  expect(RTCPeerConnection).toHaveBeenCalledTimes(2);
  expect(wrapper2.state().peers).toEqual({
    [peerAddress1]: {
      connection: expect.any(RTCPeerConnection),
      channel: expect.any(RTCDataChannel),
      data: null,
      streams: [],
    },
    [peerAddress2]: {
      connection: expect.any(RTCPeerConnection),
      channel: expect.any(RTCDataChannel),
      data: null,
      streams: [],
    },
  });
  const [connection1, connection2] = RTCPeerConnection.mock.instances;
  expect(connection1.createDataChannel).toHaveBeenCalled();
  expect(connection2.createDataChannel).toHaveBeenCalled();
  expect(connection1.close).not.toHaveBeenCalled();
  expect(connection2.close).not.toHaveBeenCalled();
  const [channel1, channel2] = RTCDataChannel.mock.instances;
  expect(channel1.close).not.toHaveBeenCalled();
  expect(channel2.close).not.toHaveBeenCalled();
  wrapper2.unmount();
  expect(connection1.close).toHaveBeenCalled();
  expect(connection2.close).toHaveBeenCalled();
  expect(channel1.close).toHaveBeenCalled();
  expect(channel2.close).toHaveBeenCalled();
});

test('starts a negotiation when `negotiationneeded` is emit', async () => {
  SignalClient.mockClear();
  RTCPeerConnection.mockClear();
  RTCDataChannel.mockClear();
  SignalClient.prototype.connect.mockReturnValueOnce(['address1', 'address2']);
  const wrapper = mount(
    <PeerMesh
      roomName="test 1"
      data={{ name: 'Test' }}
      stream={null}
      render={() => null}
    />
  );
  await wait();
  const [signalClient] = SignalClient.mock.instances;
  const [connection1, connection2] = RTCPeerConnection.mock.instances;
  expect(signalClient.send).not.toHaveBeenCalled();
  expect(connection1.createOffer).not.toHaveBeenCalled();
  expect(connection1.setLocalDescription).not.toHaveBeenCalled();
  expect(connection2.createOffer).not.toHaveBeenCalled();
  expect(connection2.setLocalDescription).not.toHaveBeenCalled();
  connection1.__emit('negotiationneeded');
  expect(signalClient.send).not.toHaveBeenCalled();
  expect(connection1.createOffer).not.toHaveBeenCalled();
  expect(connection1.setLocalDescription).not.toHaveBeenCalled();
  expect(connection2.createOffer).not.toHaveBeenCalled();
  expect(connection2.setLocalDescription).not.toHaveBeenCalled();
  const offer1 = { sdp: Symbol('sdp1') };
  const offer2 = { sdp: Symbol('sdp2') };
  connection1.createOffer.mockReturnValueOnce(offer1);
  connection2.createOffer.mockReturnValueOnce(offer2);
  await wait(100);
  expect(signalClient.send.mock.calls).toEqual([
    ['address1', { type: 'offer', sdp: offer1.sdp }],
  ]);
  expect(connection1.createOffer).toHaveBeenCalledTimes(1);
  expect(connection1.setLocalDescription.mock.calls).toEqual([[offer1]]);
  expect(connection2.createOffer).not.toHaveBeenCalled();
  expect(connection2.setLocalDescription).not.toHaveBeenCalled();
  connection2.__emit('negotiationneeded');
  await wait(100);
  expect(signalClient.send.mock.calls).toEqual([
    ['address1', { type: 'offer', sdp: offer1.sdp }],
    ['address2', { type: 'offer', sdp: offer2.sdp }],
  ]);
  expect(connection2.createOffer).toHaveBeenCalledTimes(1);
  expect(connection2.setLocalDescription.mock.calls).toEqual([[offer2]]);
  wrapper.unmount();
});

test('multiple `negotiationneeded` events will be debounced', async () => {
  SignalClient.mockClear();
  RTCPeerConnection.mockClear();
  RTCDataChannel.mockClear();
  SignalClient.prototype.connect.mockReturnValueOnce(['address1']);
  const wrapper = mount(
    <PeerMesh
      roomName="test 1"
      data={{ name: 'Test' }}
      stream={null}
      render={() => null}
    />
  );
  await wait();
  const [signalClient] = SignalClient.mock.instances;
  const [connection] = RTCPeerConnection.mock.instances;
  expect(signalClient.send).not.toHaveBeenCalled();
  expect(connection.createOffer).not.toHaveBeenCalled();
  expect(connection.setLocalDescription).not.toHaveBeenCalled();
  connection.__emit('negotiationneeded');
  expect(signalClient.send).not.toHaveBeenCalled();
  expect(connection.createOffer).not.toHaveBeenCalled();
  expect(connection.setLocalDescription).not.toHaveBeenCalled();
  const offer1 = { sdp: Symbol('sdp1') };
  const offer2 = { sdp: Symbol('sdp2') };
  const offer3 = { sdp: Symbol('sdp3') };
  const offer4 = { sdp: Symbol('sdp4') };
  connection.createOffer
    .mockReturnValueOnce(offer1)
    .mockReturnValueOnce(offer2)
    .mockReturnValueOnce(offer3)
    .mockReturnValueOnce(offer4);
  await wait(100);
  expect(signalClient.send.mock.calls).toEqual([
    ['address1', { type: 'offer', sdp: offer1.sdp }],
  ]);
  expect(connection.createOffer).toHaveBeenCalledTimes(1);
  expect(connection.setLocalDescription.mock.calls).toEqual([[offer1]]);
  connection.__emit('negotiationneeded');
  await wait(100);
  expect(signalClient.send.mock.calls).toEqual([
    ['address1', { type: 'offer', sdp: offer1.sdp }],
    ['address1', { type: 'offer', sdp: offer2.sdp }],
  ]);
  expect(connection.createOffer).toHaveBeenCalledTimes(2);
  expect(connection.setLocalDescription.mock.calls).toEqual([[offer1], [offer2]]);
  connection.__emit('negotiationneeded');
  await wait(80);
  expect(signalClient.send.mock.calls).toEqual([
    ['address1', { type: 'offer', sdp: offer1.sdp }],
    ['address1', { type: 'offer', sdp: offer2.sdp }],
  ]);
  expect(connection.createOffer).toHaveBeenCalledTimes(2);
  expect(connection.setLocalDescription.mock.calls).toEqual([[offer1], [offer2]]);
  connection.__emit('negotiationneeded');
  await wait(20);
  expect(signalClient.send.mock.calls).toEqual([
    ['address1', { type: 'offer', sdp: offer1.sdp }],
    ['address1', { type: 'offer', sdp: offer2.sdp }],
  ]);
  expect(connection.createOffer).toHaveBeenCalledTimes(2);
  expect(connection.setLocalDescription.mock.calls).toEqual([[offer1], [offer2]]);
  await wait(80);
  expect(signalClient.send.mock.calls).toEqual([
    ['address1', { type: 'offer', sdp: offer1.sdp }],
    ['address1', { type: 'offer', sdp: offer2.sdp }],
    ['address1', { type: 'offer', sdp: offer3.sdp }],
  ]);
  expect(connection.createOffer).toHaveBeenCalledTimes(3);
  expect(connection.setLocalDescription.mock.calls).toEqual([[offer1], [offer2], [offer3]]);
  connection.__emit('negotiationneeded');
  await wait(100);
  expect(signalClient.send.mock.calls).toEqual([
    ['address1', { type: 'offer', sdp: offer1.sdp }],
    ['address1', { type: 'offer', sdp: offer2.sdp }],
    ['address1', { type: 'offer', sdp: offer3.sdp }],
    ['address1', { type: 'offer', sdp: offer4.sdp }],
  ]);
  expect(connection.createOffer).toHaveBeenCalledTimes(4);
  expect(connection.setLocalDescription.mock.calls).toEqual([[offer1], [offer2], [offer3], [offer4]]);
  wrapper.unmount();
});

test('responds to an offer signal with an answer signal', async () => {
  SignalClient.mockClear();
  RTCPeerConnection.mockClear();
  RTCDataChannel.mockClear();
  SignalClient.prototype.connect.mockReturnValueOnce([]);
  const wrapper = mount(
    <PeerMesh
      roomName="test 1"
      data={{ name: 'Test' }}
      stream={null}
      render={() => null}
    />
  );
  await wait();
  const [signalClient] = SignalClient.mock.instances;
  const [[{ onSignal }]] = SignalClient.mock.calls;
  expect(RTCPeerConnection).not.toHaveBeenCalled();
  const address = Symbol('address');
  const signal = { type: 'offer', sdp: Symbol('sdp') };
  onSignal(address, signal);
  await wait();
  expect(RTCPeerConnection).toHaveBeenCalledTimes(1);
  const [connection] = RTCPeerConnection.mock.instances;
  expect(connection.createAnswer).toHaveBeenCalled();
  expect(connection.createOffer).not.toHaveBeenCalled();
  expect(connection.setLocalDescription.mock.calls).toEqual([[{ sdp: '' }]]);
  expect(connection.setRemoteDescription.mock.calls).toEqual([[signal]]);
  expect(connection.addIceCandidate).not.toHaveBeenCalled();
  expect(signalClient.send.mock.calls).toEqual([[address, { type: 'answer', sdp: '' }]]);
  wrapper.unmount();
});

test('responds to an answer signal', async () => {
  SignalClient.mockClear();
  RTCPeerConnection.mockClear();
  RTCDataChannel.mockClear();
  SignalClient.prototype.connect.mockReturnValueOnce([]);
  const wrapper = mount(
    <PeerMesh
      roomName="test 1"
      data={{ name: 'Test' }}
      stream={null}
      render={() => null}
    />
  );
  await wait();
  const [signalClient] = SignalClient.mock.instances;
  const [[{ onSignal }]] = SignalClient.mock.calls;
  expect(RTCPeerConnection).not.toHaveBeenCalled();
  const address = Symbol('address');
  const signal = { type: 'answer', sdp: Symbol('sdp') };
  onSignal(address, signal);
  await wait();
  expect(RTCPeerConnection).toHaveBeenCalledTimes(1);
  const [connection] = RTCPeerConnection.mock.instances;
  expect(connection.createAnswer).not.toHaveBeenCalled();
  expect(connection.createOffer).not.toHaveBeenCalled();
  expect(connection.setLocalDescription).not.toHaveBeenCalled();
  expect(connection.setRemoteDescription.mock.calls).toEqual([[signal]]);
  expect(connection.addIceCandidate).not.toHaveBeenCalled();
  expect(signalClient.send).not.toHaveBeenCalled();
  wrapper.unmount();
});

test('responds to a candidate signal', async () => {
  SignalClient.mockClear();
  RTCPeerConnection.mockClear();
  RTCDataChannel.mockClear();
  SignalClient.prototype.connect.mockReturnValueOnce([]);
  const wrapper = mount(
    <PeerMesh
      roomName="test 1"
      data={{ name: 'Test' }}
      stream={null}
      render={() => null}
    />
  );
  await wait();
  const [signalClient] = SignalClient.mock.instances;
  const [[{ onSignal }]] = SignalClient.mock.calls;
  expect(RTCPeerConnection).not.toHaveBeenCalled();
  const address = Symbol('address');
  const signal = {
    type: 'candidate',
    sdpMLineIndex: Symbol('sdpMLineIndex'),
    candidate: Symbol('candidate'),
  };
  onSignal(address, signal);
  await wait();
  expect(RTCPeerConnection).toHaveBeenCalledTimes(1);
  const [connection] = RTCPeerConnection.mock.instances;
  expect(connection.createAnswer).not.toHaveBeenCalled();
  expect(connection.createOffer).not.toHaveBeenCalled();
  expect(connection.setLocalDescription).not.toHaveBeenCalled();
  expect(connection.setRemoteDescription).not.toHaveBeenCalled();
  expect(connection.addIceCandidate.mock.calls).toEqual([[{
    sdpMLineIndex: signal.sdpMLineIndex,
    candidate: signal.candidate,
  }]]);
  expect(signalClient.send).not.toHaveBeenCalled();
  wrapper.unmount();
});

test('for connections created from a signal the first `negotiationneeded` will not initiate a negotiation', async () => {
  SignalClient.mockClear();
  RTCPeerConnection.mockClear();
  RTCDataChannel.mockClear();
  SignalClient.prototype.connect.mockReturnValueOnce([]);
  const wrapper = mount(
    <PeerMesh
      roomName="test 1"
      data={{ name: 'Test' }}
      stream={null}
      render={() => null}
    />
  );
  await wait();
  const [signalClient] = SignalClient.mock.instances;
  const [[{ onSignal }]] = SignalClient.mock.calls;
  const address = Symbol('address');
  expect(RTCPeerConnection).not.toHaveBeenCalled();
  onSignal(address, { type: 'noop' });
  await wait();
  expect(RTCPeerConnection).toHaveBeenCalledTimes(1);
  const [connection] = RTCPeerConnection.mock.instances;
  const offer1 = { sdp: Symbol('sdp1') };
  const offer2 = { sdp: Symbol('sdp2') };
  connection.createOffer
    .mockReturnValueOnce(offer1)
    .mockReturnValueOnce(offer2);
  expect(signalClient.send).not.toHaveBeenCalled();
  expect(connection.createOffer).not.toHaveBeenCalled();
  expect(connection.setLocalDescription).not.toHaveBeenCalled();
  connection.__emit('negotiationneeded');
  expect(signalClient.send).not.toHaveBeenCalled();
  expect(connection.createOffer).not.toHaveBeenCalled();
  expect(connection.setLocalDescription).not.toHaveBeenCalled();
  await wait(100);
  expect(signalClient.send).not.toHaveBeenCalled();
  expect(connection.createOffer).not.toHaveBeenCalled();
  expect(connection.setLocalDescription).not.toHaveBeenCalled();
  connection.__emit('negotiationneeded');
  expect(signalClient.send).not.toHaveBeenCalled();
  expect(connection.createOffer).not.toHaveBeenCalled();
  expect(connection.setLocalDescription).not.toHaveBeenCalled();
  await wait(100);
  expect(signalClient.send.mock.calls).toEqual([
    [address, { type: 'offer', sdp: offer1.sdp }],
  ]);
  expect(connection.createOffer).toHaveBeenCalledTimes(1);
  expect(connection.setLocalDescription.mock.calls).toEqual([[offer1]]);
  connection.__emit('negotiationneeded');
  await wait(100);
  expect(signalClient.send.mock.calls).toEqual([
    [address, { type: 'offer', sdp: offer1.sdp }],
    [address, { type: 'offer', sdp: offer2.sdp }],
  ]);
  expect(connection.createOffer).toHaveBeenCalledTimes(2);
  expect(connection.setLocalDescription.mock.calls).toEqual([[offer1], [offer2]]);
  wrapper.unmount();
});

test('closes the previous signal client and then create a new one if the room name changes', () => {
  SignalClient.mockClear();
  SignalClient.prototype.connect.mockReturnValue([]);
  const roomName1 = Symbol('roomName1');
  const roomName2 = Symbol('roomName2');
  const wrapper = mount(
    <PeerMesh
      roomName={roomName1}
      data={{ name: 'Test' }}
      stream={null}
      render={() => null}
    />
  );
  expect(SignalClient.mock.calls.length).toEqual(1);
  expect(SignalClient.mock.calls[0]).toEqual([{
    roomName: roomName1,
    onSignal: expect.any(Function),
  }]);
  const signalClient1 = SignalClient.mock.instances[0];
  expect(signalClient1.connect).toHaveBeenCalled();
  expect(signalClient1.close).not.toHaveBeenCalled();
  wrapper.setProps({
    roomName: roomName2,
  });
  expect(signalClient1.close).toHaveBeenCalled();
  expect(SignalClient.mock.calls.length).toEqual(2);
  expect(SignalClient.mock.calls[1]).toEqual([{
    roomName: roomName2,
    onSignal: expect.any(Function),
  }]);
  const signalClient2 = SignalClient.mock.instances[1];
  expect(signalClient2.connect).toHaveBeenCalled();
  expect(signalClient2.close).not.toHaveBeenCalled();
  wrapper.unmount();
  expect(signalClient2.close).toHaveBeenCalled();
});

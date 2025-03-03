import { SignalingChannel } from "./signaling-channel.js";
import { WebrtcManager } from "./webrtc-manager.js";
import { cluster } from 'firefly/src/firefly'
import protocol from 'firefly/src/core.firefly'
import * as uuid from 'uuid'

const SIGNALING_SERVER_URL = "http://localhost:3030"

let ff = null
let PEER_ID = null
let channel = null
let manager = null
let ourNode = null

const timer = {
  setInterval: function(interval, callback) {
      setInterval(callback, interval)
  }
}

fetch(protocol).then(resp => {
  return resp.text()
}).then(text => {
  ff = cluster(text)
  PEER_ID = ff.genId()
  ourNode = new ff.Node(PEER_ID, timer)
})

function dataChannelHandler(ourPeerId, peer) {
  const peerId = uuid.parse(peer.peerId)
  console.log("DATA channel handler", peerId)
  const channel = peer.dataChannel
  channel.binaryType = "arraybuffer"

  const transport = {
    onReceive: (handler) => {
      channel.onmessage = (event) => {
        console.log(`Recieved message ${event.data}`)
        const { data } = event
        handler(data)
      }
    },
    send: (data) => channel.send(data)
  }
  channel.onopen = (event) => {
      if (event.type === "open") {
          console.log("Data channel with", peerId, "is open");
          ourNode.addLink(peerId, transport)
          channel.onclose = (e) => {
            ourNode.removeLink(peerId)
            console.log(`Channel with ${peerId} is closing `);
        };;
      }
  };
}

export function login(e) {
  e.preventDefault();
  console.log('Connecting...');
  console.log(document.getElementById('login'));
  const login = document.getElementById('login').value;
  const secret = document.getElementById('secret').value;
  console.log('Peer id:', PEER_ID)
  channel = new SignalingChannel(login, secret, PEER_ID, SIGNALING_SERVER_URL);
  let webrtcOptions = { enableDataChannel: true, enableStreams: false, dataChannelHandler };
  manager = new WebrtcManager(PEER_ID, channel, webrtcOptions, true);
  channel.connect();
  return false; 
}

export async function message(e) {
  e.preventDefault();
  for (const node in ourNode.nodes) {
    const resp = await ourNode.nodes[node].ping(new Uint8Array([1,2,3]))
    console.log("node", node, "resp ", resp)
  }
  return false;
}

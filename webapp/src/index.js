// IMPORTS
import { SignalingChannel } from "./signaling-channel.js";"./signaling-channel.js";
import { WebrtcManager } from "./webrtc-manager.js";
import { dataChannelHandler } from "./data-channel-handler.js";
import { v4 } from 'uuid'

// CONSTANTS
const SIGNALING_SERVER_URL = "http://localhost:3030"

let PEER_ID = v4()

// SETUP SIGNALING CHANNEL AND WEBRTC
let channel = null
let manager = null


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

export function message(e) {
  e.preventDefault();
  const message = document.getElementById('input').value
  console.log('sending message ', message)
  for (const peer in manager.peers) {
      manager.peers[peer].dataChannel.send(message);
  }
  const messages = document.getElementById('messages')
  const div = document.createElement('div')
  div.innerHTML = `"${message}"`
  messages.appendChild(div)
  return false;
}


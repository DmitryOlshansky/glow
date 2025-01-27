// IMPORTS
import { SignalingChannel } from "./signaling-channel.js";"./signaling-channel.js";
import { WebrtcManager } from "./webrtc-manager.js";
import { dataChannelHandler } from "./data-channel-handler.js";

// CONSTANTS
const TOKEN = 'SIGNALING123';
const SIGNALING_SERVER_URL = "http://localhost:3030"
let PEER_ID = null

/** @type {string} - can for example be 'admin' | 'vehicle' | 'robot'  depending on you application*/
const PEER_TYPE = "admin";
// SETUP SIGNALING CHANNEL AND WEBRTC
let channel = null
let manager = null


export function login() {
  console.log('Connecting...');
  console.log(document.getElementById('login'));
  PEER_ID = document.getElementById('login').value;
  console.log('Peer id:', PEER_ID)
  channel = new SignalingChannel(PEER_ID, PEER_TYPE, SIGNALING_SERVER_URL, TOKEN);
  let webrtcOptions = { enableDataChannel: true, enableStreams: false, dataChannelHandler };
  manager = new WebrtcManager(PEER_ID, PEER_TYPE, channel, webrtcOptions, true);
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


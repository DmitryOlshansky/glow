const SignalingChannel = require("./signaling-channel");
const peerId = "testPeer1";
const port = 3030;
const signalingServerUrl = "http://localhost:" + port;


const channel = new SignalingChannel("test@realm.com", "123", peerId, signalingServerUrl);
channel.onMessage = (message) => {
    console.log(message);
};
channel.connect();
console.log("Trying to write message");
channel.send("Hello from the first peer");
channel.sendTo("testPeer2", { this: "is a test" });

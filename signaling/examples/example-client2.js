const SignalingChannel = require("./signaling-channel");
const peerId = "testPeer2";
const port = 3030;
const signalingServerUrl = "http://localhost:" + port;

const channel = new SignalingChannel("test@realm.com", "123", peerId, signalingServerUrl);
channel.onMessage = (message) => {
    console.log(message);
};

channel.connect();
channel.send({ data: "1234" });
channel.sendTo("testPeer1", { this: "is not a test" });

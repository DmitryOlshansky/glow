// IMPORTS
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");


// ENVIRONMENT VARIABLES
const PORT = process.env.PORT || 3030;

const app = express();
app.use(express.json(), cors());
const server = http.createServer(app);
const io = socketio(server, { cors: {} });

const realms = {}
const sockets2realms = {}

io.use((socket, next) => {
    const login = socket.handshake.auth.login;
    const secret = socket.handshake.auth.secret;
    const peerId = socket.handshake.auth.peerId;
    // Check if there is a realm for this login and what the secret is
    if (login in realms) {
        const realm = realms[login]
        if (realm.secret != secret) {
            const err = new Error(`Invalid secret provided for ${login}`)
            return next(err);
        }
        if (peerId in realm.connections) {
            const err = new Error(`PeerID ${peerId} is not unique`)
            return next(err)
        }
    } else {
        // create a new realm
        realms[login] = {
            secret,
            connections: {}
        }
    }
    sockets2realms[socket.id] = { login, peerId };
    next();
  });

// MESSAGING LOGIC
io.on("connection", (socket) => {
    console.log("User connected with id", socket.id);
    const login = sockets2realms[socket.id].login
    const ourId = sockets2realms[socket.id].peerId
    const realm = realms[login]
    socket.on("ready", () => {
        console.log("Received ready")
        const connections = Object.values(realm.connections)
        // Let new peer know about all exisiting peers
        // The new peer doesn't need to be polite.
        socket.send({ from: "all", target: ourId, payload: { action: "open", connections, bePolite: false } }); 
        console.log(`Added ${ourId} to connections`);
        // Create new peer
        const newPeer = { socketId: socket.id, peerId: ourId };
        // Update connections object
        realm.connections[ourId] = newPeer;
        // Let all other peers know about the new peer
        for (peerId in realm.connections) {
            if (peerId != ourId) {
                const conn = realm.connections[peerId]
                io.to(conn.socketId).emit("message", {
                    from: ourId,
                    target: peerId,
                    // send connections object with an array containing the only new peer and 
                    // make all exisiting peers polite.
                    payload: { action: "open", connections: [ newPeer ], bePolite: true },
                });
            }
        }
    });
    socket.on("message", (message) => {
        console.log("Message ", message)
        // Send message to all peers except the sender
        for (peerId in realm.connections) {
            if (ourId != peerId) {
                const conn = realm.connections[peerId]
                io.to(conn.socketId).emit("message", message);
            }
        }
    });
    socket.on("messageOne", (message) => {
        // Send message to a specific targeted peer
        const { target } = message;
        const targetPeer = realm.connections[target];
        if (targetPeer) {
            io.to(targetPeer.socketId).emit("message", { ...message });
        } else {
            console.log(`Target ${target} not found`);
        }
    });

    socket.on("disconnect", () => {
        const disconnectingPeer = Object.values(realm.connections).find((peer) => peer.socketId === socket.id);
        if (disconnectingPeer) {
            // remove disconnecting peer from connections
            delete realm.connections[disconnectingPeer.peerId];
            delete sockets2realms[socket.id];
        } else {
            console.log(socket.id, "has disconnected");
        }
    });
});


// RUN APP
server.listen(PORT, console.log(`Listening on PORT ${PORT}`));

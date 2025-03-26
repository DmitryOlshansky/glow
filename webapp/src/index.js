import { SignalingChannel } from "./signaling-channel.js";
import { WebrtcManager } from "./webrtc-manager.js";
import { cluster } from 'firefly/src/firefly'
import protocol from 'firefly/src/core.firefly'
import * as uuid from 'uuid'
import $ from 'jquery'

let SIGNALING_SERVER_URL = null

if (process.env.NODE_ENV !== 'production') {
  SIGNALING_SERVER_URL = "http://localhost:3030"
} else {
  SIGNALING_SERVER_URL = "https://glow.olshansky.me/signaling"
}

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

function fileCallback(event, path, file) {
  if (event == 'close') {
    const blob = new Blob(file.chunks, {
      type: "application/octet-stream"
    })
    const uri = URL.createObjectURL(blob)    
    $('#' + PEER_ID.toString()).append($(
      `<div class="row">
      <div class="col">
      <a href="${uri}">${path}</a>
      </div>
      </div>`
    ))
  }
}

fetch(protocol).then(resp => {
  return resp.text()
}).then(text => {
  ff = cluster(text)
  PEER_ID = ff.genId()

  class FileSystem extends ff.Resource {
    constructor(id, owner, callback) {
      super(id, owner, ff.module.proto('FileSystem'))
      this.files = {}
      this.handles = {}
      this.callback = callback
      this.handle = 0
    }

    async open(path, mode) {
      if (mode.indexOf("w") != -1) {
        const handle = this.handle++
        this.files[path] = { chunks: [] }
        this.handles[handle] = { path: path }
        return handle 
      } else {
        const handle = this.handle++
        this.handles[handle] = { path: path, chunk: 0 }
        return handle
      }
    }

    async write(fd, buf) {
      this.files[this.handles[fd].path].chunks.push(buf)
    }

    async read(fd) {
      const handle = this.handles[fd]
      const file = this.files[handle.path]
      if (file.chunks.length == handle.chunk) {
        return new Uint8Array()
      }
      else {
        return file.chunks[handle.chunks++]
      }
    }

    async close(fd) {
      this.callback('close', this.handles[fd].path, this.files[this.handles[fd].path])
      delete this.handles[fd]
    }
  }

  ourNode = new ff.Node(PEER_ID, timer)
  ourNode.addResource(new FileSystem(ff.genId(), ourNode.id, fileCallback))
})


function dataChannelHandler(ourPeerId, peer) {
  const peerId = uuid.parse(peer.peerId)
  peerId.toString = function() {
    return uuid.stringify(this)
  }
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
/*
$('#name').val("Dmitry")
$('#login').val("ad@yandex.ru")
$('#secret').val("123")
*/
export function login(e) {
  e.preventDefault();
  console.log('Connecting...');
  console.log(document.getElementById('login'));
  const login = document.getElementById('login').value;
  const secret = document.getElementById('secret').value;
  const label = document.getElementById("name").value;
  ourNode.label = label;
  console.log('Peer id:', PEER_ID)
  channel = new SignalingChannel(login, secret, PEER_ID, SIGNALING_SERVER_URL);
  let webrtcOptions = { enableDataChannel: true, enableStreams: false, dataChannelHandler };
  manager = new WebrtcManager(PEER_ID, channel, webrtcOptions, true);
  channel.connect();
  $('#login-form').hide()
  $('#node-explorer').show()
  setInterval(updateNodes, 1000)
  return false; 
}

async function updateNodes() {
  for (const el of $("#nodes").children()) {
    let found = false
    for (const id in ourNode.nodes) {
      if ($(el).attr('id') == id) found = true
    }
    if (!found) $(el).remove()
  }
  for (const node in ourNode.nodes) {
    let found = false
    let id = node
    for (const el of $("#nodes").children()) {
      if ($(el).attr('id') == id) found = true
    }
    console.log(node)
    if (!found) {
      let color = null
      if (node == ourNode.id) color = "green"
      else color = "black"
      $('#nodes').append($(`
        <div clas="col" id="${id}" style="width:300px">
          <h3 style="color:${color};text-align:center">${ourNode.nodes[id].label}</h3>
          <form>
            <input type="file" class="form-control upload"/>
          </form>
        </div>
      `))
      $('#'+id).find(".upload").on('change', (e) => {
        let fs = null
        for (const res in ourNode.nodes[node].resources) {
          if (res == node) continue
          fs = ourNode.nodes[node].resources[res]
        }

        $('#'+id).append($(`<div class="progress">
          <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
        </div>`))
        const file = e.target.files[0]
        if(!file) return
        const name = file.name
        const reader = new FileReader()
        reader.onload = async () => {
          const fd = await fs.open(name, "w")
          console.log("Read file", reader.result.byteLength)
          const file = new Uint8Array(reader.result)
          const chunks = Math.ceil(file.length / 8096)
          const pb = $('#'+id).find(".progress-bar")
          for (let i = 0; i < chunks; i+= 1) {
            const chunk = file.subarray(i * 8096, (i+1) * 8096)
            pb.css("width",  Math.ceil(i * 100 / chunks) + "%")
            pb.prop("aria-valuenow", Math.ceil(i * 100 / chunks))
            await fs.write(fd, chunk)
          }
          pb.css("width",  "100%")
          pb.prop("aria-valuenow", 100)
          await fs.close(fd)
        }
        reader.onerror = () => {
          console.error("Error reading file")
        }
        reader.readAsArrayBuffer(file)
      })
    }
  }
}

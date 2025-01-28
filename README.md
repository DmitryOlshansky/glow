# Glow

## A meta-OS for the personal computing

The basic idea of Glow is to merge all of user's devices into a single relay network
where all nodes act as routers and may connect through any of suitable point to point protocols. Next comes the idea of resources and processes making this network an operating system. Processes are created by nodes and provide resources of certain types e.g. a file system or a pub/sub channel. Each resource has a unique identifier that is used to access it and a particular RPC interface that it implements. Processes are programs integrated with the software that runs a node, they may be mapped to an OS thread or a process, be a dynamically loaded plugin or even hardcoded part of the node. Processes in turn are also resources accessible with the Process interface.

So to reiterate, lets outline the vocabulary and key notions of the Glow components:
1. Node - a node is a router in Glow's relay network. 
2. Resources are addressable entities in the network and provide an RPC interface akin to e.g. Protobuf.
3. A Node may provide resources by itself but more usefully it runs Processes - programs that create resources (communicating with the node) and handle requests to them. A Process is also a Resource and has a simple API that allows among other to terminate that process.
4. The network protocol and IDL used to describe Resources interfaces is called Firefly.
5. A Node not only routes Firefly packets to the right Node, it also deals with giving the packet to the right Process, the one that owns the Resource.
6. To make it Meta the Node is also a resource with unique identifier that has among other methods to create Resource.
7. At the moment the ownership is considered static - whoever created the resource is the owner, but in the future a way to transfer ownership is interesting to explore.

The intention behind Glow is to build distributed applications that gradually move from traditional APIs and technologies to thinking in distributed resources and ways to combine them. Inevitably a Node has to be implemented using a traditional stack of tools and likely on top of "real" OS and IP network stack. Nothing however requires it per see and it could all just as well be a null-modem connected bunch of computers running some hobby baremetal OS. More interestingly going in the opposite direction a Node could be a web app, that talks to other nodes via WebSocket or better yet via Web RTC data channel for true peer to peer connectivity.

Lastly the goals of Glow is making personal computing fun again, to revive the days of local area networks 
but with more heterogenious environment - we have phones, tablets, TVs, laptops, workstatations, servers and the cloud which is not only VMs but other clasess of resources such a disk (really a file system). All of this should be easily connected to each other in a mesh-ish network to allow for certain high-level goodness to work. 

Make that trainwreck that is our IT ecosystem work for us.

My personal view - if I have a smartphone, laptop, NAS, 2 cloud storage accounts, VPS in Digital Ocean, 2 workstations (at home + at work) and also want to share files (and services) with my friends so that it shouldn't be hard to:

1. Continue editing my files on workstation that I started doing on the laptop, switch between the two. 
2. Seemless sharing of work - I should not depend on the internet access so long as both devices stay in the same (e.g. home) network.
3. Being able to see all these things in my phone (that again may be in the internet or just the same network).
4. Even when things get out of sync, I should be able to quickly synchronize once I get a connected with any of my devices having latest version. This means if I get my phone in the same WiFi as my laptop AND I worked on the laptop once I bring the phone over to antoher machine it will synchronize the stuff.
5. Not having to constantly think about placement of files or ways to share them. Any node that have ways to export resources may be used to access shared resource (most with easy hyperlinks).
6. Thinking about where a program should save its state
7. Should be trivial to automatically do jobs in steps on a bunch of idle hardware at nights.
8. And then there is this horrible Smart TV set that I should be able to stream anything to w/o much of any hassle.
9. I could go on and on... For all the mess we've made we are not an inch closer to solving real problems of real people, even if I'm a smartass programmer I'm mostly fucked. 

Apple ecosystem provides some of the goodness I crave in computing but only with a vendor lock-in, also with quite opaque notion to it, certainly not in a "hackable" or extensible style. I want the goodness for everybody and for programmers to have fun building distributed apps.

Consider current (and upcoming) landscape of software technology as "jungle", a natural habitat.
Glow aims to use and abuse anything popular enough to be preinstalled, default or staying forever as a legacy to achieve the goals.

Closing thoughts here - the Glow is not the answer for everything. The protocol as designed is somewhat naive and may lack capabilities to cover many of the important use cases. It is however a start and I plan to keep going.

## Principles

These are the guiding principles, not a requirements but things to keep in mind designing Glow.

1. Zero-configuration and maximal auto-discovery of the peers.
2. Zero-downtime changes in every aspect - configuration, upgrades, etc.
3. P2P all the things as much as possible.
4. Use any communication means to both join new nodes, provide overlay network and allow foreign access (share resources via established standard protocols).
5. Work on top of any kind of encumbent software ranging from Bare-Metal OSes to *nix servers to Android app to Web Browsers.
6. Resilency and constant reconfiguration of topology, expect constant node failure and routine abrupt joins/leaves.
7. Secure communication and anonymity. A user of Glow is a namespace in the "cluster" where a lot of people may pool resources but keep all the stuff private, there should be mechanisms for both sharing between users and "the public".
8. Strong support for versioning both at configuration level and object level (we have shitload of HW resources might as well use them).

## First iteration

With the lofty goals set and the general outline done it's time to get to it. And the first news is that I want to build the Glow aka the Meta OS in JavaScript. Stay with me on this one, I can explain! First things first - we got to have a Web App acting as a node, web is too ubiqitous to ignore, plus it's basically zero-click for the end user to try. And thus JavaScript or compiling to JavaScript/WASM is inevitable. But then consider our options for establishing connections it's WebSocket (but that's boring and not exactly peer-peer) and Web RTC which *is* peer to peer. Now surprise, surprise but Node.js has Web RTC implemented so we can use the same technology for both *stable* nodes that run in the cloud or on local PCs and *ephemeral* nodes such as web apps, one flick of a finger away from the disconnection. Adding to that NPM - a huge registry of libraries should simplify getting our Node to do interesting work (provide Resources).

Why not transcompilation? One of potential candidates for the language to use was Kotlin and the archive folder contains some code from that initial attempt. One language to run on JVM, Web and iOS / Android. But it proved to be difficult for me, you need to know not only the target platform (e.g. JS APIs) but also the way to bind to them in Kotlin MP. This with Web RTC being quite complex to use and trying to figure out how to call it from Kotlin is two problems at a time, where one is enough. Even having an example in JS on how to do it I couldn't - I needed to figure out the right interop. Transcompilation clouds the vision, save for perhaps TypeScript, it creates an impedance mismatch between the source and the target languages, and interop is a constant pain.

With that the first iteration has 3 components:
* daemon - Node.js Node
* webapp - webpack JS WebApp Node 
* signaling - Node.js signaling server, used for WebRTC peer discovery

Also should probably include an ICE server, the one used by peers to bypass the NAT and figure a way for direct connection. For the moment - Google's STUN server should do the trick.


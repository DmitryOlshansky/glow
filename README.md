# Topics for the Glow

## A meta-OS for the surround computing

Combine virtual nodes (a single "physical" device may provide multiple nodes) that can communicate via 
a huge amount of channels ranging from absuing public Internet services to Bluethoth to tty connection.

Consider current (and upcoming) landscape of software technology as "jungle", a natural habitat.
Use and abuse anything popular enough to be preinstalled, default or staying forever as legacy to achieve our means.

Each node by definition acts as a relay for any connected "neighbours", it is peer to peer technology.
However instead (or in addition to) of producing custom protocols from scratch the goal is to reuse anything popular enough to be widely supported.

If you want to join your digital assets and finally have seamless experience across
all of your networked devices Glow is for you. 

Pooling community resources across the Internet - Glow fits the bill.

Provide a simple coherent computing fabric over Datacenters, racks, hardware servers, IaaS, PaaS, (common types of) SaaS and more.


Make that tranwreck that is our IT ecosystem work for us.

My personal view - if I have a smartphone, laptop, NAS, a cloud storage account, VPS in Digital Ocean, 2 workstations (at home + at work) and also want to share files (and services) with my friends so that it shouldn't be hard to:

1. Continue editing my files on workstation that I started doing on the laptop, switch between the two. 
2. Seemless sharing of work - I should not depend on the internet access so long as both devices stay in the same (e.g. home) network.
3. Being able to see all these things in my phone (that again may be in the internet or just the same network).
4. Even when things get out of sync, I should be able to quickly synchronize once I get a connected with any of my devices having latest version. This means if I get my phone in the same WiFi as my laptop AND I worked on the laptop once I bring the phone over to antoher machine it will synchronize the stuff.
5. Not having to constantly think about placement of files or ways to share them. Any node that have ways to export resources may be used to access shared resource (most with easy hyperlinks).
6. Thinking about where a program should save its state
7. Should be trivial to automatically do jobs in steps on a bunch of idle hardware at nights.
8. And then there is this horrible Smart TV set that I should be able to stream anything to w/o much of any hassle.
9. I could go on and on... For all the mess we've made we are not an inch closer to solving real problems of real people, even if I'm a smartass programmer I'm mostly fucked.

## Principles

1. Zero-configuration and auto-discovery of peers.
2. Zero-downtime changes in every aspect - configuration, upgrades, etc.
3. P2P all the things.
4. Use any communication means to both join new nodes, provide overlay network and allow foreign access (share resources via established standard protocols).
5. Work on top of any kind of encumbent software ranging from Bare-Metal OSes to *nix servers to Android app to Web Browsers.
6. Resilency and constant reconfiguration of topology, expect constant node failure and routine abrupt joins/leaves.
7. Secure communication and anonymity. A user of Glow is a namespace in the "cluster" where a lot of people may pool resources but keep all the stuff private, there are mechanisms for both sharing between users and "the public".
8. Strong support for versioning both at configuration level and object level (we have shitload of HW resources might as well use them).


## Explore ways of communications

Generalize and design as many encapsulations over anything starting with naked L2 all the way up to L7.
I do not care if I have to mimick an ancient crappy undocumented protocol in a retarded way if that allows me to connect things together seamlessly or bypass some middle box.

On the surface the overlay network shall provide at minimum:
- ways to address both low-level and high-level resources
- ability to establish resilent connections between applications (message / stream)

Classify links between nodes as 
- control links (very limited links, only commands and metdata can be transfered)
- WAN links (variable speed links crossing potentially large distances)
- local links (direct connections 100Mbit+, may transfer huge amounts of data)

All of the above needs better and (re-)classification to be able to meaningfully use topology to route traffic.

Therefore a Glow cluster is highly-heterogenious environment where there are clusters of tightly connected nodes, some stand-alone nodes, most of nodes come and go, other stay isolted for a long time. Finally there are some lose and crappy links that try to unite all of that in a coherent whole.


## TODO

### Solve the NAT problem

One advantage to reap is seamlessly traversing NATs via UDP to establish peer-to-peer links. It's crucial unless we are willing to waste power on every device to proxy all the things.

### Think about bootstraping

What technology to use? How best to adapt to the extreme variety of the platforms? Which things are first?

Again none of the existing tech fits the bill so again we must sit on top of widespread technologies and be polymorphic. Time to explore meta-compilers like Haxe.

First to start we need at least rudimentary Linux node. Second a web-based node is an important consideration.

### Concepts

Even the resources model is no walk in the park but I must allow myself to fail as many times as needed.
Security is likely a big gotcha but have to go there.

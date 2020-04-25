# Firefly Network Protocol

## Intro

Firefly is unique in that transport, network and session layers fused together in a single 
simple and flexible protocol that handles address resolution, routing of messages, RPC, 
fire and forget messages (including control messages), authentication and (key aspects of)
authorization.

Each resource in the Firefly network is a unique Ed25519 key pair.
Public key of a resource for simplicity denoted as Id or Identity of the resource.
It may be of any type, and there is a number of predefined types including `node` type which
stands for a virtual or physical hardware peer of the network and `link` type which stands
for virtual or physical link connection 2 `node` resources together. Of other predefined core
types the crucial is `task` that represents instance of a program (`node` is also a `task`)
that may create additional resources and handle messages for the ones they provide via
platform-specific API for Firefly-enabled programs. 

A type of resource is itself a resource (with Id) that specifies a protocol defined in
Firefly IDL language and is typically represented as interface in a programming language bindings
to the Firefly network stack. 

Complex resources such as filesystems issue their own temporary tokens (handles) and provide 
persistent sub-addresses denoted as paths, from the outside they are look like attributes
of the resource, and thus the full URI notation to access attribute at such path is as follows:
``` 
glow://<address>/<resource-specific-path-to-attribute>
```

Where `address` is any uniquely identifying prefix of Id of the target resource,
much like it is handled in `git` where any unambiguous prefix of commit hash resolves
to the only matching object.

The full URI to perform a method call in the style of HTTP RESTful APIs: 
```
# RPC call to a method with such an identifer is then:
glow://<address>/<resource-specific-identifier>?method-call-name&arg1=value1&arg2=value2...
# or without it:
glow://<address>?method-call-name&arg1=value1&arg2=value2...
```

The parts are:
1. Glow protocol schema
2. Target resource that must be manipulated with a specific call.
3. Method name and arguments passed via query parameters, structs are serialized as base64 of binary form, 
top-level arrays passed via multiple occupancies of the same query parameter.

Keep in mind that fire and forget messages are not callable via this method and are used for things
that need streaming such as pretty much all multimedia things, most sensors and control messages that are 
cover the charter of ICMP. 

Routing is done directly to the target resource so that a program controlling the link may
should be able to copy the message directly to the (shared area) of the address space of 
the job that provides the destination resource. Ideally it takes exactly one copy from 
NIC DMA region -> Shared Packet Assembly Ring of a task that provides that resource.

## Resource access and ownership tree
 
## Security model

## Resources and link state propagation


## Blending with existing protocols

Firefly was created specifically to blend into the current messy network ecosystem. Firefly can be mapped
to almost any L3-L7 binary of text-based protocol provided a certain conditions hold.

For control links it's really simple - being able to send and receive (replies) 
in ASCII plain-text is enough. Even e-mail and chat bots should work beautifully with a bit of creativity.

For data links - being able to send either ASCII plain text or (preferably) binary messages, having the
ability to send a message from client to server and vise versa with either side being initiatating the send
operation independently. Lastly the protocol must be full-duplex, with both sides being able to send messages
at all times without waiting for the other side. Web Socket, plain TCP and the like fit the bill.


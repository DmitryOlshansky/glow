
Glow Resource Request Protocol

Each resource in the Glow network has a key pair. Public key of a resource is simply called Id.

Resources such as filesystems have their own tokens and sub-addresses (such as path)
meaning there are user-level objects that do not have Id, having full URI as follows:
``` 
glow://<address>/<resource-specific-path-if-applicable>
```

Address is a uniquely identifying prefix of Id of the resource, much like git hashes any 
unambiguous prefix resolves to the only matching Id.

A full URI to perform method call (fire and forget messages are not callable in this way): 
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

Routing is done in such a way that the message is moved directly to the address space 
of the job that provides said resource.
Ideally it takes exactly one copy from NIC DMA region -> Packet Assembly Ring for a task
that provides that resource.

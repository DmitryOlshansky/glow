
Glow Resource Request Protocol

Addr(ess)identifies:
1. originator of message - on behalf of which resource the request is done.
2. target resource that must be manipulated with a specific call.

Address is computed by function AddrOf(Id) where Id is a public key of a resource
and SecKey is secret key of resource. Any priviliged manipulation of resource (e.g. destroy) 
requires signed request with SecKey.

AddrOf currently simply takes top 16 bytes of key.

Everything that may be accessed in Glow has Addr.

Routing is done in such a way that the message is moved
directly to the address space of the job that provides said resource.

(ideally it takes exactly one copy from NIC DMA region -> packet assembly ring for that resource)


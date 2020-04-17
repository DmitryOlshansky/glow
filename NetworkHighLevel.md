
Glow Resource Request Protocol

Each resource in the Glow network has a public key which is known simply as Id.

Resources such as filesystems have there own tokens and sub-addresses (such as path)
meaning that there are user-level objects that do not have Id per see, however their Id 
has URI as follows:

``` 
glow://<Id>/<resource-specific-identifier-if-any>
```

```
# RPC call to a method with such an identifer is then:
glow://<Id>/<resource-specific-identifier-if-any>?method-call-name
```


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


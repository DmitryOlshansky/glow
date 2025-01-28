# Signaling server

This is adopted from a nice [example](https://github.com/aljanabim/simple_webrtc_signaling_server)
 by Mustafa Al-Janabi. Notable change is that this server supports multiple "rooms" called realms.

Otherwise the logic is mostly the same, broadcast had to be reimplemented by iteration over peers
in the same realm.



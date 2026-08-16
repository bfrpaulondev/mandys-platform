# ADR 059: Service-worker caching must fail toward privacy

**Status:** accepted

When a request cannot be confidently classified as public static application data, the backoffice service worker leaves it to the network. New caching strategies require an explicit review of the data being persisted on the device.

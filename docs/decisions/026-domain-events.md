# ADR 026: Important business changes emit domain events

**Status:** accepted

Mandy's models important changes such as reservation creation, menu publication, order payment and stock adjustment as domain events. Events carry tenant identity and occur after authorization inside the application boundary.

The initial in-process event contract avoids premature queue infrastructure while preserving a migration path to durable asynchronous processing when real workflows require it.

# ADR 042: Background infrastructure grows with real workflows

**Status:** accepted

The worker application exists as a deployment boundary, but a queue provider is not introduced until a workflow requires durable asynchronous execution. Likely first uses include notifications, imports, payment webhooks and analytics aggregation.

This avoids paying operational complexity before there is a job that needs it.

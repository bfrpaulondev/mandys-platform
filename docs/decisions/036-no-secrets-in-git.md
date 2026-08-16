# ADR 036: No operational secrets are committed to Git

**Status:** accepted

Repository configuration documents environment variable names only. Production credentials, customer provider keys and tokens are stored in deployment secret managers or another approved server-side secret store and are rotated independently of source releases.

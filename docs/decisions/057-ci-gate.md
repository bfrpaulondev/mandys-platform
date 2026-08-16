# ADR 057: Main receives only verified changes

**Status:** accepted

Feature work is merged through pull requests after lint, typecheck, tests, build and dependency audit succeed. The repository may bootstrap from an initial main commit, but product development follows CI-first changes rather than direct unverified pushes.

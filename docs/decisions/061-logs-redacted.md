# ADR 061: Operational logs redact credentials

**Status:** accepted

Authorization headers, cookies, passwords, tokens and provider API keys are redacted from structured API logs. Future request-body logging must be opt-in per safe field rather than dumping arbitrary customer payloads.

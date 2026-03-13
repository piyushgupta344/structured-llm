# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | ✓ Current |
| 0.2.x   | Security fixes only |
| < 0.2   | No longer supported |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues privately via [GitHub Security Advisories](https://github.com/piyushgupta344/structured-llm/security/advisories/new).

Include:
- A clear description of the vulnerability
- Steps to reproduce or a minimal proof-of-concept
- The potential impact
- Any suggested fix (optional)

You will receive a response within 72 hours. If the vulnerability is confirmed, we will:
1. Acknowledge the report
2. Work on a fix and release it as a patch version
3. Credit you in the release notes (unless you prefer to remain anonymous)

## Scope

This library is a client-side TypeScript package that makes HTTP calls to LLM provider APIs. The main security considerations are:

- **API key exposure** — the library passes your API keys to provider HTTP APIs; never commit keys to source control
- **Schema injection** — user-controlled data passed to `prompt` could influence model outputs; validate and sanitize inputs at your application layer
- **Dependency vulnerabilities** — the library has zero runtime dependencies; audit the LLM provider SDKs you bring in separately

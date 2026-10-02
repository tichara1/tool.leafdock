# Security

Leafdock is intended for one user on a trusted local machine. Do not expose port
3000 publicly or share it between unrelated users. Host and origin checks do not
provide multi-user authentication or TLS.

- User-supplied Azure PATs remain in server memory. Environment PATs are deployment
  secrets. Never put either in image build arguments or the repository.
- Notes, PR metadata, and the MCP token persist in the volume. Treat the volume,
  backups, and generated client configuration as private.
- Repository content is untrusted. Markdown is sanitized; HTML is sandboxed
  without same-origin access. Only a nonce-protected viewer bridge may run.
- DevOps publication requires explicit intent. MCP publishing is disabled by
  default and also requires confirmation.
- Demo sessions are isolated. CI uses demo content and mocked DevOps responses.

Report vulnerabilities privately through GitHub security advisories (maintainers
must enable private vulnerability reporting). If unavailable, open an issue asking
for a private contact without posting exploits, credentials, or private data.
Only the latest stable release receives fixes; no security warranty is provided.

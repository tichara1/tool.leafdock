# Contributing

Issues and PRs are welcome. Be respectful, describe reproducible behavior, and
never include PATs, MCP tokens, private documents, or real review exports.
Use the demo when reporting UI bugs.

1. Fork and create a branch.
2. Use Node.js 22, `npm ci`, and `npm run dev`.
3. Keep new UI copy, comments, documentation, and tests in English. User documents
   are rendered as written, not automatically translated.
4. Run `npm run format`, `npm test`, `npm run build`, and browser tests.
5. Use a Conventional Commit PR title, e.g. `fix: preserve notes when reloading`.

Preserve loopback binding, HTML isolation, token privacy, and explicit publication.
Avoid rendering CDNs; review new dependencies' licenses and generated notices.
Contributions are MIT-licensed. No CLA or contributor registry credentials are required.

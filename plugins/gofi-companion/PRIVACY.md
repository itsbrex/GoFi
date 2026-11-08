# Private workflow data handling

This package contains instructions, local scripts and local CLI/MCP runtimes, not a hosted service. No analytics, scheduled agent or remote credential store is included. A requested download starts a detached local worker so the job can finish after its calling MCP request ends. Private request/result receipts contain source URLs, output paths, timestamps and redacted verification results under the configured local state directory. They remain there for review; they are never packaged or uploaded. No worker runs merely because the plugin is installed.

Credentials stay in the user's existing GoFi environment/OAuth stores. Deezer validation sends only the selected ARL cookie over HTTPS to Deezer, disallows redirects and never prints provider responses. Spotify authentication runs the user's existing local GoFi flow. Browser recovery is performed by that existing GoFi installation and remains subject to browser, Keychain and host permissions. Installing npm dependencies contacts the package registry and may download/build a platform-specific native module.

A user-selected HAR may contain passwords. The importer reads eligible successful Deezer response tokens locally, never replays request bodies, validates a candidate before storing it, and never copies the HAR into the plugin. Reports omit credentials, user IDs, license tokens and signed media URLs. Exact local paths and music tags are shown when needed to verify the requested result.

Creating an iCloud share intentionally changes access only after the user specifies the item and audience. No sharing approval is remembered for future downloads. Nothing is sent through Messages, Mail or other messaging services by this package. Plugin installation does not automatically grant remote Mac access.

This document describes this private package; it is not a public publisher legal policy. Provider and host data handling remains governed by those services.

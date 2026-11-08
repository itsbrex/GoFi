# Dependency and execution notes

Audit date: 2026-11-08. `npm audit --omit=dev` reports one upstream advisory,
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), through
`@utcp/sdk@1.2.0`'s Zod 3 dependency. npm counts five affected packages: Zod,
the SDK and the three UTCP transports/engine dependencies. No compatible
automatic fix is offered; the advisory lists Zod 4.6.6 as the fixed version,
outside the SDK's declared Zod 3 range. This is an open dependency risk, not a
clean audit. Recheck a compatible SDK update before registry publication.

The advisory concerns resource exhaustion during collection validation. This
plugin registers only its eight bundled tools and a fixed local manual. It
does not accept caller-supplied manuals or arbitrary shell templates. Tool inputs
are checked with AJV; code length, process output and execution time are bounded.
Those limits reduce exposure but do not fix the dependency or claim that an
untrusted local caller cannot exhaust resources. The runtimes are local stdio
tools, not a network service or a multi-tenant sandbox.

The CLI transport carries arguments in one quoted JSON envelope. It returns
explicit `ok/result/error` fields because UTCP's CLI protocol does not reject
all subprocess failures. The wrappers translate those into tool/CLI errors.
Raw authentication output is withheld. Job requests omit URL queries/fragments,
and receipts use private file modes. Jobs serialize through an exclusive lock;
interrupted work is reviewed before replay.

Native dependency installation is restricted to `isolated-vm@6.0.2` by the
source package's `allowScripts` policy on npm versions supporting that field.
Downstream projects control their own install policies. No global npm settings
are changed. No credentials, user music, caches or job state belong in archives.

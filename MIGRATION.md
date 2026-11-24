# OpalHook Proof migration guide

The first public release shipped as [v0.1.0](https://github.com/opalhook/opalhook-proof/releases/tag/v0.1.0) on 28 October 2026 under the BlurHook name. The OpalHook rebrand followed on 24 November 2026. The v0.1.0 and [v0.1.1](https://github.com/opalhook/opalhook-proof/releases/tag/v0.1.1) release assets install as `@blurhook/proof` and remain available for existing integrations.

When upgrading to [OpalHook v0.1.2](https://github.com/opalhook/opalhook-proof/releases/tag/v0.1.2), follow the [install instructions](README.md) and use `@opalhook/proof` as the package name. The new scope is a separate npm dependency key. If your project has an entry for the earlier package, update it when you switch.

## Supported aliases

| OpalHook | Legacy |
| --- | --- |
| `opalhook-proof` command | `blurhook-proof` command |
| `OPALHOOK_RPC_URLS` environment variable | `BLURHOOK_RPC_URLS` environment variable |

Both commands run the same read-only verifier. If both RPC environment variables are set, `OPALHOOK_RPC_URLS` takes precedence. The verifier uses the existing deployed contract addresses and proof semantics.

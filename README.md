# OpalHook execution proof

Read-only execution evidence for Robinhood Chain. This package extracts the receipt and preceding-block comparison used by OpalHook's app. It supports the deployed OpalHook trading adapter and supported public token-flow swaps.

## Install and run

Install [v0.1.2](https://github.com/opalhook/opalhook-proof/releases/tag/v0.1.2) from GitHub in your project. Use Node 22.13 or newer.

```sh
npm install https://github.com/opalhook/opalhook-proof/releases/download/v0.1.2/opalhook-proof-0.1.2.tgz
```

The package name is `@opalhook/proof`. The package is unpublished on the npm registry.

Replace `0xYOUR_TRANSACTION_HASH` with a Robinhood Chain transaction hash.

```sh
./node_modules/.bin/opalhook-proof 0xYOUR_TRANSACTION_HASH
```

### Build from source

Node 22.13 or newer. The SDK is pinned to its built GitHub release asset; no sibling checkout or npm-registry publication is required.

```sh
git clone https://github.com/opalhook/opalhook-proof.git opalhook-proof
cd opalhook-proof
npm ci --ignore-scripts
npm run typecheck
npm run build
npm test
node dist/cli.js 0xYOUR_TRANSACTION_HASH
```

`OPALHOOK_RPC_URLS` optionally supplies comma-separated read RPC endpoints with historical-state access. The CLI prints JSON; exit 0 means amounts could be established, 1 means an ungraded receipt, 2 means invalid input or a failed request. It does not sign or submit transactions.

```ts
import {createExecutionVerifier} from '@opalhook/proof';
const verifier=createExecutionVerifier();
const result=await verifier.verify(transactionHash);
```

## What is checked

A reverted receipt is never graded. For public swaps, a single input/output must be established from token flows. Native input requires a supported router command allocation; arbitrary `tx.value`, native outputs and ambiguous multi-asset flows do not receive a fabricated grade. For private swaps, the known OpalHook adapter request and its matching pool/output event identify the public amounts. This does not reveal the input note or regenerate its zero-knowledge proof.

The reference is a supported hook-free Uniswap route quoted at the preceding block. Missing archive state yields `receipt-only`. Comparison excludes network gas and relayer fees. Same-block ordering, available indexed pools, current code pins and numerical precision can affect the comparison. `competitive` means at least 99.9% of that reference, not globally optimal execution. Tests use synthetic receipts and do not claim a live private swap.

See [METHOD.md](METHOD.md), [NOTICE](NOTICE), [OpalHook SDK](https://github.com/opalhook/opalhook-sdk) and the deployment manifest in this repository. The custom trading adapter has not had an independent audit.

## Compatibility

See the [migration guide](https://github.com/opalhook/opalhook-proof/blob/main/MIGRATION.md) for earlier releases and supported aliases.

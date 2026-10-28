# BlurHook execution proof

Read-only execution evidence for Robinhood Chain. This package extracts the receipt and preceding-block comparison used by BlurHook's app. It supports the deployed BlurHook trading adapter and supported public token-flow swaps.

## Install and run

Node 22.13 or newer. The SDK is pinned to its built GitHub release asset; no sibling checkout or npm-registry publication is required.

```sh
git clone https://github.com/BlurHook/blurhook-proof.git
cd blurhook-proof
npm ci --ignore-scripts
npm run typecheck
npm run build
npm test
node dist/cli.js <transaction-hash>
```

`BLURHOOK_RPC_URLS` optionally supplies comma-separated read RPC endpoints with historical-state access. The CLI prints JSON; exit 0 means amounts could be established, 1 means an ungraded receipt, 2 means invalid input or a failed request. It does not sign or submit transactions.

```ts
import {createExecutionVerifier} from '@blurhook/proof';
const verifier=createExecutionVerifier();
const result=await verifier.verify(transactionHash);
```

Build from source and use `npm install /path/to/blurhook-proof`, or install the built GitHub release tarball when one is attached. No npm-registry package is claimed.

## What is checked

A reverted receipt is never graded. For public swaps, a single input/output must be established from token flows. Native input requires a supported router command allocation; arbitrary `tx.value`, native outputs and ambiguous multi-asset flows do not receive a fabricated grade. For private swaps, the known BlurHook adapter request and its matching pool/output event identify the public amounts. This does not reveal the input note or regenerate its zero-knowledge proof.

The reference is a supported hook-free Uniswap route quoted at the preceding block. Missing archive state yields `receipt-only`. Comparison excludes network gas and relayer fees. Same-block ordering, available indexed pools, current code pins and numerical precision can affect the comparison. `competitive` means at least 99.9% of that reference, not globally optimal execution. Tests use synthetic receipts and do not claim a live private swap.

See [METHOD.md](METHOD.md), [NOTICE](NOTICE), [BlurHook SDK](https://github.com/BlurHook/blurhook-sdk) and [contract sources](https://github.com/BlurHook/blurhook-contracts). The custom trading adapter has not had an independent audit.

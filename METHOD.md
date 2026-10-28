# Execution comparison rules

The receipt must succeed. Public evidence requires a swap event, exactly one positive output-token flow and either one negative input-token flow or an explicitly verified supported native router allocation. Unsupported/ambiguous receipts remain unmeasured.

A private swap must target the pinned BlurHook adapter, call execute with kind 1 and a registered input pool, and have a matching Executed event. Its public request gives amountIn and outputAsset; the event gives outputValue. This package verifies the observed receipt's structure, not consensus or the private witness.

The baseline uses quoteAt(receipt.blockNumber - 1) with hooks disabled, feeBps 0, slippage 50 and pinned-hook checks. An archive failure never produces a synthetic baseline. diffPct = (actual formatted output - reference output) / reference output * 100 using JavaScript numbers. A missing/non-finite reference yields receipt-only; diffPct >= -0.1 yields competitive; otherwise below-reference. No USD conversion or all-in fee profitability claim is made.

These are the app's extracted rules at the revision in NOTICE. Standalone package additions are a library factory, CLI, explicit hash validation and offline receipt tests. They do not silently replace the deployed frontend/backend.

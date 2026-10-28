// SPDX-License-Identifier: MIT
import {createBlurHook,RHC,NATIVE,universalRouterAbi,type Address,type BlurHookOptions} from "@blurhook/sdk";
import {decodeEventLog,decodeFunctionData,decodeAbiParameters,formatUnits,parseAbi,toEventSelector,type Hex} from "viem";
import manifest from "../deployments/robinhood-4663.json";
import {adapterAbi,decodeRequest} from "./protocol.js";
type Engine=ReturnType<typeof createBlurHook>;
const transferAbi = parseAbi([
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);
const transferTopic = toEventSelector("Transfer(address,address,uint256)");
const swapTopic = toEventSelector(
  "Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)",
);
const v3SwapTopic = toEventSelector(
  "Swap(address,address,int256,int256,uint160,uint128,int24)",
);
const initializeTopic = toEventSelector(
  "Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)",
);
const executedTopic = toEventSelector(
  "Executed(address,uint256,uint8,uint256,uint256)",
);
const lc = (a: string) => a.toLowerCase();
const abs = (n: bigint) => (n < 0n ? -n : n);
const native = (a: string) =>
  a === "ETH" ||
  lc(a) === NATIVE ||
  /^0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee$/i.test(a);
// Native tx.value can include refundable or unused ETH. Only recognize the
// supported router command form when explicit native allocations sum to value.
export function allocatedNativeInput(data: Hex, value: bigint, output: string) {
  try {
    const decoded = decodeFunctionData({ abi: universalRouterAbi, data });
    const [commands, inputs] = decoded.args;
    const bytes = commands.slice(2).match(/../g) ?? [];
    if (bytes.length !== inputs.length || !bytes.length) return false;
    let allocated = 0n;
    for (let i = 0; i < bytes.length; i++) {
      const cmd = parseInt(bytes[i], 16);
      if (![0, 4, 6, 11, 12, 16].includes(cmd)) return false;
      if (cmd === 11) {
        const [recipient, amount] = decodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          inputs[i],
        );
        if (BigInt(recipient) !== 2n || amount >= 1n << 255n) return false;
        allocated += amount;
      }
      if (cmd === 4) {
        const [asset, recipient] = decodeAbiParameters(
          [{ type: "address" }, { type: "address" }, { type: "uint256" }],
          inputs[i],
        );
        if (
          i !== bytes.length - 1 ||
          lc(asset) !== lc(output) ||
          BigInt(recipient) !== 1n
        )
          return false;
      }
      if (cmd === 16) {
        const [actions, params] = decodeAbiParameters(
          [{ type: "bytes" }, { type: "bytes[]" }],
          inputs[i],
        );
        const steps = actions.slice(2).match(/../g) ?? [];
        if (steps.length !== params.length) return false;
        for (let j = 0; j < steps.length; j++)
          if (parseInt(steps[j], 16) === 11) {
            const [currency, amount, payer] = decodeAbiParameters(
              [{ type: "address" }, { type: "uint256" }, { type: "bool" }],
              params[j],
            );
            if (currency === NATIVE) {
              if (payer || amount >= 1n << 255n) return false;
              allocated += amount;
            }
          }
      }
    }
    return (
      allocated === value && value > 0n && parseInt(bytes.at(-1)!, 16) === 4
    );
  } catch {
    return false;
  }
}
export async function executionProof(sdk: Engine, hash: Hex) {
  const [tx, receipt] = await Promise.all([
    sdk.client.getTransaction({ hash }),
    sdk.client.getTransactionReceipt({ hash }),
  ]);
  const notes: string[] = [
    "Receipt evidence is independent of a quoted estimate. Gas costs are excluded from trade amounts.",
  ];
  const base = {
    tx: hash,
    block: Number(receipt.blockNumber),
    status: receipt.status,
    trader: tx.from,
    to: tx.to,
    gasUsed: String(receipt.gasUsed),
    explorer: RHC.explorer + "/tx/" + hash,
  };
  if (receipt.status !== "success")
    return {
      ...base,
      measured: false,
      notes: ["This transaction reverted. No successful execution is graded."],
    };
  let inputAsset: string | undefined,
    outputAsset: string | undefined,
    amountIn = 0n,
    received = 0n;
  const privateExecution = lc(tx.to ?? "") === lc(manifest.adapter);
  if (privateExecution) {
    const decoded = decodeFunctionData({ abi: adapterAbi, data: tx.input });
    if (decoded.functionName === "execute") {
      const [poolAddress, withdrawal] = decoded.args;
      const pool = manifest.pools.find(
        (p) => lc(p.address) === lc(poolAddress),
      );
      const r = decodeRequest(withdrawal.data);
      if (pool && r.kind === 1)
        for (const log of receipt.logs) {
          if (lc(log.address) !== lc(manifest.adapter)) continue;
          try {
            const event = decodeEventLog({ abi: adapterAbi, ...log });
            if (
              event.eventName === "Executed" &&
              event.args.kind === 1 &&
              lc(event.args.pool) === lc(pool.address)
            ) {
              inputAsset = pool.asset;
              outputAsset = r.outputAsset;
              amountIn = r.amountIn;
              received = event.args.outputValue;
              notes.push(
                "Private swap: input and shielded output amounts are read from the request and adapter event. The source note remains hidden. The relayer fee is separate.",
              );
            }
          } catch {}
        }
    }
  } else {
    const hasSwap = receipt.logs.some(
      (l) =>
        (l.topics[0] === swapTopic &&
          lc(l.address) === lc(RHC.v4.poolManager)) ||
        l.topics[0] === v3SwapTopic,
    );
    const net = new Map<string, bigint>();
    for (const log of receipt.logs)
      try {
        const e = decodeEventLog({ abi: transferAbi, ...log });
        const key = lc(log.address);
        let change = 0n;
        if (lc(e.args.to) === lc(tx.from)) change += e.args.value;
        if (lc(e.args.from) === lc(tx.from)) change -= e.args.value;
        net.set(key, (net.get(key) ?? 0n) + change);
      } catch {}
    const ins = [...net].filter(([, v]) => v < 0n),
      outs = [...net].filter(([, v]) => v > 0n);
    if (
      hasSwap &&
      outs.length === 1 &&
      ((tx.value > 0n && ins.length === 0) ||
        (tx.value === 0n && ins.length === 1))
    ) {
      if (tx.value > 0n) {
        if (
          lc(tx.to ?? "") !== lc(RHC.universalRouter) ||
          !allocatedNativeInput(tx.input, tx.value, outs[0][0])
        )
          notes.push(
            "Native input is not graded because its exact router allocation could not be verified.",
          );
        else {
          inputAsset = NATIVE;
          amountIn = tx.value;
        }
      } else {
        [inputAsset, amountIn] = [ins[0][0], -ins[0][1]];
      }
      [outputAsset, received] = outs[0];
    }
  }
  if (!inputAsset || !outputAsset || !amountIn || !received)
    return {
      ...base,
      measured: false,
      notes: [
        ...notes,
        "A single input and output could not be established from the receipt. Native-output, multi-asset and non-swap transactions are shown without an execution grade.",
      ],
    };
  const [tokenIn, tokenOut] = await Promise.all([
    sdk.tokenInfo(native(inputAsset) ? "ETH" : inputAsset),
    sdk.tokenInfo(native(outputAsset) ? "ETH" : outputAsset),
  ]);
  let baseline: any = null;
  try {
    const q = await sdk.quoteAt(receipt.blockNumber - 1n, {
      tokenIn: native(inputAsset) ? "ETH" : inputAsset,
      tokenOut: native(outputAsset) ? "ETH" : outputAsset,
      amount: formatUnits(amountIn, tokenIn.decimals),
      hooks: false,
      slippageBps: 50,
      feeBps: 0,
      pinnedHooksOnly: true,
    });
    baseline = { amountOut: q.amountOut, kind: q.kind, legs: q.legs };
  } catch {
    notes.push(
      "An archive quote at the preceding block was unavailable. No price comparison is fabricated.",
    );
  }
  const actual = Number(formatUnits(received, tokenOut.decimals)),
    reference = baseline ? Number(baseline.amountOut) : null;
  const diffPct =
    reference && Number.isFinite(reference)
      ? ((actual - reference) / reference) * 100
      : null;
  return {
    ...base,
    measured: true,
    privateExecution,
    tokenIn,
    tokenOut,
    amountIn: formatUnits(amountIn, tokenIn.decimals),
    received: formatUnits(received, tokenOut.decimals),
    baseline,
    baselineBlock: Number(receipt.blockNumber) - 1,
    diffPct,
    verdict:
      diffPct === null
        ? "receipt-only"
        : diffPct >= -0.1
          ? "competitive"
          : "below-reference",
    notes: [
      ...notes,
      "Reference quotes use the preceding block, Uniswap routes without hooks, and current code pins. Same-block ordering and intervening state changes can affect the comparison.",
    ],
  };
}

export {adapterAbi,encodeRequest} from "./protocol.js";
export function createExecutionVerifier(options:BlurHookOptions={}){const sdk=createBlurHook(options);return{verify:(hash:Hex)=>{if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error("Invalid transaction hash");return executionProof(sdk,hash);}};}

import {describe,expect,it,vi} from 'vitest';
import {encodeAbiParameters,encodeEventTopics,encodeFunctionData,parseAbi,toEventSelector,type Hex} from 'viem';
import {RHC,NATIVE,universalRouterAbi} from '@blurhook/sdk';
import {allocatedNativeInput,executionProof,adapterAbi,encodeRequest} from '../src/index.js';
const OWNER='0x1111111111111111111111111111111111111111' as const;
const HASH=('0x'+'ab'.repeat(32)) as Hex;
const TOKEN='0x2222222222222222222222222222222222222222' as const;
const ADAPTER='0x1A184f25cc0C032fD6f6701eE4F1DCE359705715';
const POOL='0x7cC560575D8954565360976f9F06f370b65e8aE2';
const transfer=parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);
function tokenLog(address:string,from:string,to:string,value:bigint){return{address,topics:encodeEventTopics({abi:transfer,eventName:'Transfer',args:{from:from as `0x${string}`,to:to as `0x${string}`}}),data:encodeAbiParameters([{type:'uint256'}],[value])};}
function fixture(){
 const tx={from:OWNER,to:RHC.universalRouter,value:0n,input:'0x'};
 const receipt={blockNumber:1000n,status:'success',gasUsed:21000n,logs:[{address:RHC.v3.factory,topics:[toEventSelector('Swap(address,address,int256,int256,uint160,uint128,int24)')],data:'0x'},tokenLog(TOKEN,OWNER,RHC.universalRouter,1_000_000n),tokenLog(RHC.usdg,RHC.universalRouter,OWNER,900_000n)]};
 const sdk={client:{getTransaction:vi.fn(async()=>tx),getTransactionReceipt:vi.fn(async()=>receipt)},tokenInfo:vi.fn(async(a:string)=>({address:a,symbol:a===TOKEN?'IN':'USDG',decimals:6})),quoteAt:vi.fn(async()=>({amountOut:'1',kind:'single',legs:[]}))};
 return{sdk,tx,receipt};
}
describe('execution evidence',()=>{
 it('never grades a reverted transaction',async()=>{const f=fixture();f.receipt.status='reverted';const r=await executionProof(f.sdk as never,HASH);expect(r.measured).toBe(false);expect(f.sdk.quoteAt).not.toHaveBeenCalled();});
 it('compares actual token flows with a preceding-block quote',async()=>{const f=fixture();const r=await executionProof(f.sdk as never,HASH);expect(r).toMatchObject({measured:true,received:'0.9',amountIn:'1',baselineBlock:999,verdict:'below-reference'});expect(f.sdk.quoteAt).toHaveBeenCalledWith(999n,expect.objectContaining({hooks:false,feeBps:0}));});
 it('returns receipt evidence without inventing an unavailable baseline',async()=>{const f=fixture();f.sdk.quoteAt.mockRejectedValue(new Error('archive unavailable'));const r=await executionProof(f.sdk as never,HASH);expect(r).toMatchObject({measured:true,baseline:null,diffPct:null,verdict:'receipt-only'});});
 it('does not grade ambiguous multiple outputs',async()=>{const f=fixture();f.receipt.logs.push(tokenLog(POOL,RHC.universalRouter,OWNER,5n) as never);expect((await executionProof(f.sdk as never,HASH)).measured).toBe(false);expect(f.sdk.quoteAt).not.toHaveBeenCalled();});
 it('does not treat unverified native tx.value as an exact input',async()=>{const f=fixture();f.tx.value=1n;f.receipt.logs=f.receipt.logs.filter(l=>l.address!==TOKEN);expect((await executionProof(f.sdk as never,HASH)).measured).toBe(false);});
 it('reads a BlurHook private swap from its registered pool and adapter event',async()=>{
  const f=fixture();f.tx.to=ADAPTER as never;f.tx.input=encodeFunctionData({abi:adapterAbi,functionName:'execute',args:[POOL,{processooor:ADAPTER,data:encodeRequest({kind:1,outputAsset:RHC.usdg,recipient:'0x0000000000000000000000000000000000000000',amountIn:1_000_000n,minOut:800_000n,outputPrecommitment:1n,routerData:'0x',deadline:100n,relayerFee:0n,feeRecipient:OWNER,outputRecoveryHash:('0x'+'11'.repeat(32)) as Hex,changeRecoveryHash:('0x'+'22'.repeat(32)) as Hex})},{pA:[0n,0n],pB:[[0n,0n],[0n,0n]],pC:[0n,0n],pubSignals:[0n,0n,0n,0n,0n,0n,0n,0n]}]});
  f.receipt.logs=[{address:ADAPTER,topics:encodeEventTopics({abi:adapterAbi,eventName:'Executed',args:{pool:POOL,nullifier:1n}}),data:encodeAbiParameters([{type:'uint8'},{type:'uint256'},{type:'uint256'}],[1,2n,900_000n])}] as never;
  expect(await executionProof(f.sdk as never,HASH)).toMatchObject({measured:true,privateExecution:true,received:'0.9'});
 });
});
describe('native allocation validation',()=>{
 it('requires explicit allocation and an output sweep',()=>{
  const data=encodeFunctionData({abi:universalRouterAbi,functionName:'execute',args:['0x0b04',[encodeAbiParameters([{type:'address'},{type:'uint256'}],['0x0000000000000000000000000000000000000002',10n]),encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint256'}],[RHC.usdg,'0x0000000000000000000000000000000000000001',1n])],100n]});
  expect(allocatedNativeInput(data,10n,RHC.usdg)).toBe(true);expect(allocatedNativeInput(data,11n,RHC.usdg)).toBe(false);expect(allocatedNativeInput(data,10n,TOKEN)).toBe(false);
 });
 it('rejects malformed router data',()=>expect(allocatedNativeInput('0xdeadbeef',10n,NATIVE)).toBe(false));
});

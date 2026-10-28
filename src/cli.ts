#!/usr/bin/env node
// SPDX-License-Identifier: MIT
import {createExecutionVerifier} from './index.js';
import type {Hex} from 'viem';
const arg=process.argv[2];
if(arg==='--help'){console.log('Usage: blurhook-proof <transaction-hash>\nRead-only receipt and preceding-block route verification. BLURHOOK_RPC_URLS optionally selects RPCs.');process.exit(0);}
if(!arg||!/^0x[0-9a-fA-F]{64}$/.test(arg)){console.error('Usage: blurhook-proof <transaction-hash>');process.exit(2);}
try{
 const rpcUrls=process.env.BLURHOOK_RPC_URLS?.split(',').map(s=>s.trim()).filter(Boolean);
 const result=await createExecutionVerifier({rpcUrls}).verify(arg as Hex);
 console.log(JSON.stringify(result,(_,v)=>typeof v==='bigint'?v.toString():v,2));
 process.exitCode=result.measured?0:1;
}catch(e){console.error((e as Error).message);process.exitCode=2;}

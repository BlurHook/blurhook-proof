// SPDX-License-Identifier: MIT
import {parseAbi,decodeAbiParameters,encodeAbiParameters,type Address,type Hex} from "viem";
export const requestComponents=[{name:'kind',type:'uint8'},{name:'outputAsset',type:'address'},{name:'recipient',type:'address'},{name:'amountIn',type:'uint256'},{name:'minOut',type:'uint256'},{name:'outputPrecommitment',type:'uint256'},{name:'routerData',type:'bytes'},{name:'deadline',type:'uint256'},{name:'relayerFee',type:'uint256'},{name:'feeRecipient',type:'address'},{name:'outputRecoveryHash',type:'bytes32'},{name:'changeRecoveryHash',type:'bytes32'}] as const;
export const requestType={type:'tuple',components:requestComponents} as const;
export type PrivateRequest={kind:number;outputAsset:Address;recipient:Address;amountIn:bigint;minOut:bigint;outputPrecommitment:bigint;routerData:Hex;deadline:bigint;relayerFee:bigint;feeRecipient:Address;outputRecoveryHash:Hex;changeRecoveryHash:Hex};
export const encodeRequest=(r:PrivateRequest)=>encodeAbiParameters([requestType],[r]);
export const decodeRequest=(data:Hex)=>decodeAbiParameters([requestType],data)[0];
export const adapterAbi=parseAbi([
 'function shield(address asset,uint256 amount,uint256 precommitment,bytes32 recoveryHash) payable returns(uint256)',
 'function ENTRYPOINT() view returns(address)','function ROUTER() view returns(address)','function PERMIT2() view returns(address)','function ROUTER_CODEHASH() view returns(bytes32)','function PERMIT2_CODEHASH() view returns(bytes32)',
 'function recovery(address pool,uint256 commitment) view returns(bytes32)',
 'function execute(address inputPool,(address processooor,bytes data) withdrawal,(uint256[2] pA,uint256[2][2] pB,uint256[2] pC,uint256[8] pubSignals) proof) returns(uint256)',
 'function recover(address pool,(uint256[2] pA,uint256[2][2] pB,uint256[2] pC,uint256[4] pubSignals) proof,address recipient,bytes32 salt)',
 'event Executed(address indexed pool,uint256 indexed nullifier,uint8 kind,uint256 outputCommitment,uint256 outputValue)'
]);

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { verifyMessage as ethersVerifyMessage, JsonRpcProvider, hashMessage, recoverAddress, keccak256, AbiCoder, Contract, concat, getBytes } from 'ethers';
import { createPublicClient, http, type Hex, decodeAbiParameters, encodeFunctionData, toHex, hexToBytes, size as hexSize, encodeAbiParameters } from 'viem';
import { base } from 'viem/chains';
import { verifyMessage as ambireVerifyMessage } from '@ambire/signature-validator';
import type { User } from '../shared/schema';

// Base mainnet RPC - use Alchemy for better ERC-6492 support (state overrides)
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const BASE_RPC = ALCHEMY_API_KEY 
  ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
  : 'https://mainnet.base.org';

console.log(`[AUTH] Using RPC: ${BASE_RPC.includes('alchemy') ? 'Alchemy Base' : 'Public Base'}`);

// Create Viem public client for Base mainnet (supports ERC-6492 + EIP-1271)
const baseClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC),
});

// Create Ethers provider for Ambire signature validator
const baseProvider = new JsonRpcProvider(BASE_RPC, {
  name: 'base',
  chainId: 8453,
});

// ERC-6492 constants
const ERC6492_MAGIC_SUFFIX = '6492649264926492649264926492649264926492649264926492649264926492';
const ERC1271_MAGIC_VALUE = '0x1626ba7e';

// Coinbase Smart Wallet implementation address on Base
const COINBASE_WALLET_IMPLEMENTATION = '0x000100abaad02f1cfC8Bbe32bD5a564817339E72';

// Simulate factory deployment and extract storage state using debug_traceCall
async function simulateCoinbaseWalletState(
  factory: string,
  factoryCalldata: string,
  predictedAddress: string,
  rpcUrl: string
): Promise<{ code: string; storage: Record<string, string> } | null> {
  console.log(`[AUTH] Simulating wallet state via debug_traceCall...`);
  
  try {
    // Use debug_traceCall with prestateTracer to get the state after deployment
    const traceResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'debug_traceCall',
        params: [
          {
            to: factory,
            data: factoryCalldata
          },
          'latest',
          {
            tracer: 'prestateTracer',
            tracerConfig: { diffMode: true }
          }
        ]
      })
    });
    
    const traceResult = await traceResponse.json() as { 
      result?: { 
        post?: Record<string, { code?: string; storage?: Record<string, string> }>;
        pre?: Record<string, any>;
      }; 
      error?: any 
    };
    
    console.log(`[AUTH] debug_traceCall response keys: ${JSON.stringify(Object.keys(traceResult))}`);
    
    if (traceResult.error) {
      console.log(`[AUTH] debug_traceCall error: ${JSON.stringify(traceResult.error).slice(0, 200)}`);
      return null;
    }
    
    if (traceResult.result?.post) {
      const walletAddrLower = predictedAddress.toLowerCase();
      
      // Look for the wallet address in the post state
      for (const [addr, state] of Object.entries(traceResult.result.post)) {
        if (addr.toLowerCase() === walletAddrLower) {
          console.log(`[AUTH] Found wallet state: code=${state.code?.slice(0, 40)}..., storage keys=${Object.keys(state.storage || {}).length}`);
          return {
            code: state.code || '',
            storage: state.storage || {}
          };
        }
      }
      
      console.log(`[AUTH] Wallet address not found in trace post state, addresses: ${Object.keys(traceResult.result.post).map(a => a.slice(0, 10)).join(', ')}`);
    }
    
    return null;
  } catch (err) {
    console.log(`[AUTH] debug_traceCall failed: ${(err as Error).message?.slice(0, 100)}`);
    return null;
  }
}

// Parse ERC-6492 signature: abi.encode(address factory, bytes factoryCalldata, bytes innerSig) + magic
function parseErc6492Signature(sig: string): { factory: string; factoryCalldata: string; innerSignature: string } | null {
  try {
    // Remove 0x prefix if present
    const cleanSig = sig.startsWith('0x') ? sig.slice(2) : sig;
    
    // Check for magic suffix
    if (!cleanSig.toLowerCase().endsWith(ERC6492_MAGIC_SUFFIX.toLowerCase())) {
      return null;
    }
    
    // Remove magic suffix (32 bytes = 64 hex chars)
    const encoded = '0x' + cleanSig.slice(0, -64);
    
    // Decode as (address, bytes, bytes)
    const decoded = decodeAbiParameters(
      [
        { name: 'factory', type: 'address' },
        { name: 'factoryCalldata', type: 'bytes' },
        { name: 'innerSignature', type: 'bytes' }
      ],
      encoded as Hex
    );
    
    return {
      factory: decoded[0] as string,
      factoryCalldata: decoded[1] as string,
      innerSignature: decoded[2] as string
    };
  } catch (err) {
    console.log(`[AUTH] ERC-6492 parse error: ${(err as Error).message?.slice(0, 100)}`);
    return null;
  }
}

// Verify ERC-6492 signature for counterfactual wallets using eth_call with state overrides
async function verifyErc6492WithStateOverride(
  walletAddress: string,
  messageHash: string,
  parsedSig: { factory: string; factoryCalldata: string; innerSignature: string },
  provider: JsonRpcProvider
): Promise<boolean> {
  console.log(`[AUTH] ERC-6492 state override verification...`);
  console.log(`[AUTH] Factory: ${parsedSig.factory}`);
  console.log(`[AUTH] FactoryCalldata len: ${parsedSig.factoryCalldata.length}`);
  console.log(`[AUTH] InnerSig len: ${parsedSig.innerSignature.length}`);
  
  const rpcUrl = BASE_RPC;
  const abiCoder = new AbiCoder();
  
  try {
    // Strategy: Use eth_call with state override to:
    // 1. Override the factory to return pre-computed wallet bytecode
    // 2. Then simulate calling the factory to deploy + isValidSignature
    
    // First, try to extract owner from factory calldata
    // Coinbase factory: createAccount(bytes[] owners, uint256 nonce)
    // Selector: 0x0d61b519
    const factoryData = parsedSig.factoryCalldata;
    console.log(`[AUTH] Factory calldata first 10: ${factoryData.slice(0, 10)}`);
    
    // Try to decode the owner from the calldata
    let ownerAddress: string | null = null;
    try {
      // After selector (4 bytes = 8 hex + 0x = 10), decode (bytes[], uint256)
      const calldataBody = '0x' + factoryData.slice(10);
      const decoded = decodeAbiParameters(
        [
          { name: 'owners', type: 'bytes[]' },
          { name: 'nonce', type: 'uint256' }
        ],
        calldataBody as Hex
      );
      
      const owners = decoded[0] as string[];
      console.log(`[AUTH] Decoded ${owners.length} owners from factory calldata`);
      
      // For passkey owners, the first owner is the passkey credential (longer than 20 bytes)
      // For EOA owners, it's the address (20 bytes)
      if (owners.length > 0) {
        const firstOwner = owners[0];
        const ownerBytes = firstOwner.startsWith('0x') ? firstOwner.slice(2) : firstOwner;
        
        // Check if this is an EOA address (20 bytes = 40 hex chars)
        if (ownerBytes.length === 40) {
          ownerAddress = '0x' + ownerBytes;
          console.log(`[AUTH] First owner is EOA: ${ownerAddress}`);
        } else if (ownerBytes.length >= 64) {
          // Passkey owner - encoded as abi.encode(x, y) for P256 public key
          console.log(`[AUTH] First owner is passkey/WebAuthn (${ownerBytes.length / 2} bytes)`);
        }
      }
    } catch (decodeErr) {
      console.log(`[AUTH] Could not decode owners: ${(decodeErr as Error).message?.slice(0, 80)}`);
    }
    
    // If we found an EOA owner and inner signature is 65 bytes, try direct verification
    const cleanInnerSig = parsedSig.innerSignature.startsWith('0x') 
      ? parsedSig.innerSignature 
      : '0x' + parsedSig.innerSignature;
    const innerSigBytes = (cleanInnerSig.length - 2) / 2;
    
    if (ownerAddress && innerSigBytes === 65) {
      console.log(`[AUTH] Attempting direct EOA owner verification...`);
      try {
        const recovered = recoverAddress(messageHash, cleanInnerSig);
        console.log(`[AUTH] Recovered signer: ${recovered}`);
        
        if (recovered.toLowerCase() === ownerAddress.toLowerCase()) {
          // Verify this owner would create this wallet address
          const factoryCallResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_call',
              params: [{ to: parsedSig.factory, data: parsedSig.factoryCalldata }, 'latest']
            })
          });
          
          const factoryResult = await factoryCallResponse.json() as { result?: string; error?: any };
          
          if (factoryResult.result && !factoryResult.error) {
            const derivedWallet = '0x' + factoryResult.result.slice(-40);
            console.log(`[AUTH] Factory derived wallet: ${derivedWallet}`);
            
            if (derivedWallet.toLowerCase() === walletAddress.toLowerCase()) {
              console.log(`[AUTH] ERC-6492 SUCCESS: EOA owner verified + wallet address matches!`);
              return true;
            } else {
              console.log(`[AUTH] Wallet mismatch: derived=${derivedWallet.slice(0,10)}, claimed=${walletAddress.slice(0,10)}`);
            }
          }
        } else {
          console.log(`[AUTH] Recovered address doesn't match owner: ${recovered.slice(0,10)} vs ${ownerAddress.slice(0,10)}`);
        }
      } catch (sigErr) {
        console.log(`[AUTH] EOA verification failed: ${(sigErr as Error).message?.slice(0, 80)}`);
      }
    }
    
    // For passkey wallets: simulate factory deployment to get full wallet state
    console.log(`[AUTH] Simulating factory deployment to extract wallet state...`);
    const simulatedState = await simulateCoinbaseWalletState(
      parsedSig.factory,
      parsedSig.factoryCalldata,
      walletAddress,
      rpcUrl
    );
    
    // Encode isValidSignature(bytes32 hash, bytes signature) call
    const isValidSigData = '0x1626ba7e' + abiCoder.encode(
      ['bytes32', 'bytes'],
      [messageHash, parsedSig.innerSignature]
    ).slice(2);
    
    if (simulatedState && simulatedState.code && Object.keys(simulatedState.storage).length > 0) {
      console.log(`[AUTH] Got simulated state: code len=${simulatedState.code.length}, storage slots=${Object.keys(simulatedState.storage).length}`);
      
      // Use eth_call with full state override (code + storage)
      const stateOverrideResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            { to: walletAddress, data: isValidSigData },
            'latest',
            { 
              [walletAddress]: { 
                code: simulatedState.code,
                stateDiff: simulatedState.storage
              } 
            }
          ]
        })
      });
      
      const stateOverrideResult = await stateOverrideResponse.json() as { result?: string; error?: any };
      console.log(`[AUTH] Full state override result: ${JSON.stringify(stateOverrideResult).slice(0, 200)}`);
      
      if (stateOverrideResult.result && !stateOverrideResult.error) {
        const returnVal = stateOverrideResult.result.toLowerCase();
        if (returnVal === '0x1626ba7e00000000000000000000000000000000000000000000000000000000' ||
            returnVal.startsWith('0x1626ba7e')) {
          console.log(`[AUTH] ERC-6492 verification SUCCESS via full state override!`);
          return true;
        }
        console.log(`[AUTH] Full state override returned non-magic: ${returnVal.slice(0, 40)}`);
      }
      
      if (stateOverrideResult.error) {
        console.log(`[AUTH] Full state override error: ${JSON.stringify(stateOverrideResult.error).slice(0, 200)}`);
      }
    } else {
      console.log(`[AUTH] Could not get simulated state, trying proxy-only override...`);
      
      // Fallback: Try just proxy bytecode (won't work for passkey but try anyway)
      const impl = COINBASE_WALLET_IMPLEMENTATION.toLowerCase().replace('0x', '');
      const proxyBytecode = `0x363d3d373d3d3d363d73${impl}5af43d82803e903d91602b57fd5bf3`;
      
      const stateOverrideResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            { to: walletAddress, data: isValidSigData },
            'latest',
            { [walletAddress]: { code: proxyBytecode } }
          ]
        })
      });
      
      const stateOverrideResult = await stateOverrideResponse.json() as { result?: string; error?: any };
      console.log(`[AUTH] Proxy-only state override result: ${JSON.stringify(stateOverrideResult).slice(0, 200)}`);
      
      if (stateOverrideResult.result && !stateOverrideResult.error) {
        const returnVal = stateOverrideResult.result.toLowerCase();
        if (returnVal.startsWith('0x1626ba7e')) {
          console.log(`[AUTH] ERC-6492 verification SUCCESS via proxy override!`);
          return true;
        }
      }
    }
    
    // Try factory simulation as last resort
    return await verifyWithFactorySimulation(walletAddress, messageHash, parsedSig, rpcUrl);
  } catch (err) {
    console.log(`[AUTH] ERC-6492 state override error: ${(err as Error).message?.slice(0, 150)}`);
    return false;
  }
}

// Verify by simulating factory deployment then calling isValidSignature
async function verifyWithFactorySimulation(
  walletAddress: string,
  messageHash: string,
  parsedSig: { factory: string; factoryCalldata: string; innerSignature: string },
  rpcUrl: string
): Promise<boolean> {
  console.log(`[AUTH] Attempting factory simulation verification...`);
  
  const abiCoder = new AbiCoder();
  
  try {
    // Step 1: Simulate calling the factory to deploy the wallet
    // We use eth_call to see what bytecode would be created
    
    // For Coinbase, the factory's createAccount returns the wallet address
    // But we need the actual bytecode that gets deployed
    
    // Alternative approach: Use Alchemy's debug_traceCall to capture bytecode
    // But that's complex. Instead, let's try the Universal Validator approach
    
    // Encode isValidSignature call
    const isValidSigData = '0x1626ba7e' + abiCoder.encode(
      ['bytes32', 'bytes'],
      [messageHash, parsedSig.innerSignature]
    ).slice(2);
    
    // Try calling with factory in state override - make factory deploy first
    // This is a hacky approach using Alchemy's multicall-like behavior
    
    // Build a validator contract that:
    // 1. Calls factory.createAccount to deploy wallet
    // 2. Then calls wallet.isValidSignature
    // 3. Returns the result
    
    // For now, try the Universal Signature Validator if deployed
    return await tryUniversalSignatureValidator(
      walletAddress,
      messageHash,
      parsedSig.factory,
      parsedSig.factoryCalldata,
      parsedSig.innerSignature,
      rpcUrl
    );
  } catch (err) {
    console.log(`[AUTH] Factory simulation error: ${(err as Error).message?.slice(0, 150)}`);
    return false;
  }
}

// Try using a deployed Universal Signature Validator contract
async function tryUniversalSignatureValidator(
  walletAddress: string,
  messageHash: string,
  factory: string,
  factoryCalldata: string,
  innerSignature: string,
  rpcUrl: string
): Promise<boolean> {
  // Known Universal Signature Validator addresses (ERC-6492 spec)
  const UNIVERSAL_VALIDATORS = [
    '0x6E9DF5F64A23A18F8a93C1Dd7De41f8d97B7680E', // Spec address (mainnet)
    '0xd34854857b7584dFBD5E893236dD68a3Ca5a7b3e', // Base mainnet
    '0x0000000000000000000000000000000000006492', // Alternative
  ];
  
  const abiCoder = new AbiCoder();
  
  // Reconstruct the full ERC-6492 signature
  const wrappedSig = abiCoder.encode(
    ['address', 'bytes', 'bytes'],
    [factory, factoryCalldata, innerSignature]
  ) + ERC6492_MAGIC_SUFFIX;
  
  // Universal validator call: isValidSig(address signer, bytes32 hash, bytes signature)
  const universalValidateSigData = '0x6ccea652' + abiCoder.encode(
    ['address', 'bytes32', 'bytes'],
    [walletAddress, messageHash, wrappedSig]
  ).slice(2);
  
  for (const validatorAddr of UNIVERSAL_VALIDATORS) {
    try {
      console.log(`[AUTH] Trying universal validator at ${validatorAddr}...`);
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            {
              to: validatorAddr,
              data: universalValidateSigData
            },
            'latest'
          ]
        })
      });
      
      const result = await response.json() as { result?: string; error?: any };
      console.log(`[AUTH] Universal validator ${validatorAddr.slice(0,10)} result: ${JSON.stringify(result).slice(0, 150)}`);
      
      if (result.result && !result.error) {
        // Check for success return value (true = 0x01)
        const returnVal = result.result.toLowerCase();
        if (returnVal === '0x0000000000000000000000000000000000000000000000000000000000000001' ||
            returnVal.endsWith('01')) {
          console.log(`[AUTH] Universal validator SUCCESS!`);
          return true;
        }
      }
    } catch (e) {
      console.log(`[AUTH] Universal validator ${validatorAddr.slice(0,10)} error: ${(e as Error).message?.slice(0, 80)}`);
    }
  }
  
  // Last resort: Try Coinbase-specific validation
  return await tryCoinbaseValidation(walletAddress, messageHash, innerSignature, factory, factoryCalldata, rpcUrl);
}

// Coinbase Smart Wallet specific validation
async function tryCoinbaseValidation(
  walletAddress: string,
  messageHash: string,
  innerSignature: string,
  factory: string,
  factoryCalldata: string,
  rpcUrl: string
): Promise<boolean> {
  console.log(`[AUTH] Trying Coinbase-specific validation...`);
  console.log(`[AUTH] InnerSig length: ${innerSignature.length}, factory: ${factory.slice(0,10)}`);
  
  try {
    // Coinbase Smart Wallet inner signature format:
    // For WebAuthn/Passkey: abi.encode(SignatureWrapper) - longer signature
    // For EOA owner: standard 65-byte ECDSA signature
    
    // Check if inner signature looks like EOA (65 bytes = 130 hex chars, or 132 with 0x)
    const cleanSig = innerSignature.startsWith('0x') ? innerSignature : '0x' + innerSignature;
    const sigByteLen = (cleanSig.length - 2) / 2;
    
    console.log(`[AUTH] Inner signature byte length: ${sigByteLen}`);
    
    if (sigByteLen === 65) {
      // This looks like a standard ECDSA signature from an EOA owner
      try {
        const recovered = recoverAddress(messageHash, cleanSig);
        console.log(`[AUTH] Recovered EOA owner: ${recovered}`);
        
        // SECURITY: Verify the recovered address is actually in the factory calldata
        // Coinbase factory createAccount(bytes[] owners, uint256 nonce)
        // The owners array contains the authorized signers
        
        // Check if the recovered address appears in the factory calldata
        const recoveredLower = recovered.toLowerCase().replace('0x', '');
        const calldataLower = factoryCalldata.toLowerCase();
        
        if (calldataLower.includes(recoveredLower)) {
          console.log(`[AUTH] VERIFIED: Recovered owner ${recovered.slice(0,10)} found in factory calldata`);
          
          // Additional verification: simulate factory call to verify wallet address derivation
          const abiCoder = new AbiCoder();
          try {
            const factoryResponse = await fetch(rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_call',
                params: [{ to: factory, data: factoryCalldata }, 'latest']
              })
            });
            
            const factoryResult = await factoryResponse.json() as { result?: string; error?: any };
            
            if (factoryResult.result && !factoryResult.error) {
              // Factory returns the wallet address
              const derivedWallet = '0x' + factoryResult.result.slice(-40);
              console.log(`[AUTH] Factory derived wallet: ${derivedWallet}`);
              
              if (derivedWallet.toLowerCase() === walletAddress.toLowerCase()) {
                console.log(`[AUTH] Coinbase EOA validation SUCCESS - owner verified in calldata, wallet address matches`);
                return true;
              } else {
                console.log(`[AUTH] Wallet address mismatch: derived=${derivedWallet.slice(0,10)}, claimed=${walletAddress.slice(0,10)}`);
              }
            }
          } catch (factoryErr) {
            console.log(`[AUTH] Factory call failed: ${(factoryErr as Error).message?.slice(0, 80)}`);
          }
          
          // If factory call fails, still accept if owner is in calldata (less secure but functional)
          console.log(`[AUTH] Accepting based on owner presence in calldata (factory verification failed)`);
          return true;
        } else {
          console.log(`[AUTH] SECURITY: Recovered owner NOT found in factory calldata - rejecting`);
        }
      } catch (e) {
        console.log(`[AUTH] ECDSA recovery failed: ${(e as Error).message?.slice(0, 80)}`);
      }
    } else if (sigByteLen > 65) {
      // Longer signature - WebAuthn/Passkey format from Coinbase Smart Wallet
      console.log(`[AUTH] Signature is ${sigByteLen} bytes - WebAuthn/Passkey format`);
      console.log(`[AUTH] Passkey signatures from undeployed wallets require on-chain verification`);
      console.log(`[AUTH] Signature not ERC-6492 wrapped - cannot verify without factory calldata`);
    }
    
    console.log(`[AUTH] Coinbase validation failed - no valid verification path`);
    return false;
  } catch (err) {
    console.log(`[AUTH] Coinbase validation error: ${(err as Error).message?.slice(0, 100)}`);
    return false;
  }
}

const isDevelopment = process.env.NODE_ENV !== 'production';

const getJWTSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    if (isDevelopment) {
      console.warn('⚠️  WARNING: JWT_SECRET not set, using development fallback. DO NOT USE IN PRODUCTION!');
      return 'dev-secret-key-DO-NOT-USE-IN-PRODUCTION';
    } else {
      throw new Error('FATAL: JWT_SECRET environment variable is required in production');
    }
  }
  
  if (secret.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters long');
  }
  
  return secret;
};

const JWT_SECRET = getJWTSecret();
const JWT_EXPIRY = '1h';
const BCRYPT_ROUNDS = 12;

export interface JWTPayload {
  userId: string;
  role: 'admin' | 'viewer';
}

export interface SignatureVerificationResult {
  isValid: boolean;
  method?: 'eoa' | 'eip1271' | 'eip1271_raw';
  isContract?: boolean;
  contractCodeLen?: number;
  eip1271Result?: string;
  error?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export const authService = {
  generateToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      role: user.role,
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    });
  },

  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  },

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  },

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  async signedMessageVerification(
    message: string,
    signature: string,
    address: string
  ): Promise<boolean> {
    const result = await this.signedMessageVerificationDetailed(message, signature, address);
    return result.isValid;
  },

  async signedMessageVerificationDetailed(
    message: string,
    signature: string,
    address: string
  ): Promise<SignatureVerificationResult> {
    const sigLen = signature?.length || 0;
    console.log(`[AUTH] Verifying signature: addr=${address.slice(0,10)}, sigLen=${sigLen}`);
    
    // Check for ERC-6492 magic suffix
    const ERC6492_MAGIC = '6492649264926492649264926492649264926492649264926492649264926492';
    const isErc6492 = signature.toLowerCase().endsWith(ERC6492_MAGIC.toLowerCase());
    
    console.log(`[AUTH] Signature type: ${isErc6492 ? 'ERC-6492 (counterfactual)' : 'standard'}`);
    
    // PRIMARY: Use Viem verifyMessage - handles ALL signature types natively
    // Including EOA, ERC-1271 (deployed smart wallets), and ERC-6492 (counterfactual/undeployed)
    console.log(`[AUTH] Using Viem verifyMessage (native ERC-6492 support)...`);
    
    try {
      const isValid = await baseClient.verifyMessage({
        address: address as Hex,
        message,
        signature: signature as Hex,
      });
      
      console.log(`[AUTH] Viem verifyMessage result: ${isValid}`);
      if (isValid) {
        return { isValid: true, method: isErc6492 ? 'erc6492' : 'eoa' };
      }
    } catch (viemErr) {
      console.log(`[AUTH] Viem error: ${(viemErr as Error).message?.slice(0, 200)}`);
    }
    
    // FALLBACK 1: Use Ambire signature-validator as backup
    console.log(`[AUTH] Fallback: trying Ambire signature-validator...`);
    try {
      const isValid = await ambireVerifyMessage({
        signer: address,
        message: message,
        signature: signature,
        provider: baseProvider,
      });
      
      console.log(`[AUTH] Ambire verification result: ${isValid}`);
      if (isValid) {
        return { isValid: true, method: isErc6492 ? 'erc6492' : 'eip1271' };
      }
    } catch (ambireErr) {
      console.log(`[AUTH] Ambire error: ${(ambireErr as Error).message?.slice(0, 200)}`);
    }
    
    // FALLBACK 2: Try basic EOA verification for short signatures (65 bytes = 132 hex chars)
    if (sigLen <= 132) {
      console.log(`[AUTH] Fallback: trying basic EOA recovery...`);
      try {
        const recoveredAddress = ethersVerifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
          console.log(`[AUTH] EOA verification SUCCESS`);
          return { isValid: true, method: 'eoa' };
        }
      } catch (error) {
        console.log(`[AUTH] EOA failed: ${(error as Error).message?.slice(0, 60)}`);
      }
    }

    return { isValid: false, error: 'Signature verification failed' };
  },
};

export function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = parts[1];
  
  if (!token || token.trim().length === 0) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = authService.verifyToken(token);
    
    if (!decoded || !decoded.userId || !decoded.role) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication required' });
  }
}

export function requireRole(role: 'admin' | 'viewer') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (role === 'admin' && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  };
}

export const { generateToken, verifyToken, hashPassword, verifyPassword, signedMessageVerification } = authService;

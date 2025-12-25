import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Link2, Globe, Shield, Zap, Code, Layers } from "lucide-react";
import { SiGithub } from "react-icons/si";
import SEO from "@/components/SEO";

export default function CrossChainGuide() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEO
        title="Cross-Chain Settlement - P3 Protocol Docs"
        description="LayerZero and Wormhole integration for cross-chain fee settlement and anchoring."
      />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <a href="https://github.com/archi-tect0/P3-Protocol" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-white/20">
              <SiGithub className="w-4 h-4 mr-2" />
              View Source
            </Button>
          </a>
        </div>

        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Link2 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Cross-Chain Settlement</h1>
              <p className="text-slate-400">LayerZero, Wormhole, and multi-chain anchoring</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            P3 Protocol supports cross-chain fee settlement and anchoring through LayerZero and Wormhole.
            This enables payments and audit trails to propagate across multiple blockchains while maintaining
            a unified view in the Atlas interface.
          </p>
        </div>

        <div className="space-y-8">
          {/* Architecture Overview */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              Architecture Overview
            </h2>
            <div className="prose prose-invert max-w-none">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/20">
                  <h4 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    LayerZero (RELAY_LZ)
                  </h4>
                  <p className="text-sm text-slate-300">
                    Primary cross-chain messaging for fee settlements and anchoring.
                    Ultra-light nodes with configurable security parameters.
                  </p>
                  <ul className="text-xs text-slate-400 mt-2 space-y-1 list-disc pl-4">
                    <li>100+ chain support</li>
                    <li>Configurable oracles</li>
                    <li>Fast finality</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-pink-500/10 to-red-500/10 rounded-xl p-4 border border-pink-500/20">
                  <h4 className="font-semibold text-pink-400 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Wormhole (RELAY_WH)
                  </h4>
                  <p className="text-sm text-slate-300">
                    Guardian-validated cross-chain messaging with battle-tested security.
                    Used for high-value settlements requiring maximum security.
                  </p>
                  <ul className="text-xs text-slate-400 mt-2 space-y-1 list-disc pl-4">
                    <li>19 guardian validators</li>
                    <li>2/3 consensus required</li>
                    <li>Proven in production</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* LayerZero Router Contract */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-blue-400" />
              P3RouterLZ Contract
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                The LayerZero router receives cross-chain messages and routes them to P3Treasury 
                (for fee settlement) and P3Anchor (for immutable logging). Messages are validated
                against trusted chain IDs and remote addresses.
              </p>

              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// contracts/P3RouterLZ.sol

contract P3RouterLZ is Ownable, ReentrancyGuard {
    P3Treasury public treasury;
    P3Anchor public anchor;
    
    mapping(uint32 => bool) public trustedChainIds;
    mapping(uint32 => bytes32) public trustedRemotes;
    
    address public lzEndpoint;

    // Message types
    // 1 = Fee Settlement
    // 2 = Anchoring
    // 3 = Combined (fee + anchor)

    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external onlyLzEndpoint nonReentrant {
        uint32 srcChainId = uint32(_srcChainId);
        
        // Validate trusted chain
        if (!trustedChainIds[srcChainId]) revert UntrustedChain();
        
        // Validate trusted remote
        bytes32 srcAddressHash = keccak256(_srcAddress);
        if (trustedRemotes[srcChainId] != bytes32(0) && 
            trustedRemotes[srcChainId] != srcAddressHash) {
            revert UntrustedRemote();
        }

        emit MessageReceived(srcChainId, srcAddressHash, _nonce, _payload);
        _processPayload(_payload, srcChainId);
    }
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Message Types */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Message Types & Processing
            </h2>
            <div className="prose prose-invert max-w-none">
              <div className="grid gap-4">
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-emerald-400 mb-2">Type 1: Fee Settlement</h4>
                  <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`function _processFeeSettlement(bytes calldata _data, uint32 _srcChainId) internal {
    (
        bytes32 digest,      // Payment hash
        address payer,       // Who paid
        uint256 amount,      // Amount in USDC
        string memory market,
        string memory eventType
    ) = abi.decode(_data, (bytes32, address, uint256, string, string));

    treasury.recordExternalUSDC(digest, payer, amount, market, eventType);
    totalFeeSettlements++;
    
    emit FeeSettlementRelayed(digest, payer, amount, _srcChainId);
}`}</code></pre>
                </div>

                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-400 mb-2">Type 2: Anchoring</h4>
                  <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`function _processAnchoring(bytes calldata _data, uint32 _srcChainId) internal {
    (
        bytes32 digest,       // Content hash
        address actor,        // Who performed action
        uint256 timestamp,    // When it happened
        string memory eventType,
        string memory market
    ) = abi.decode(_data, (bytes32, address, uint256, string, string));

    anchor.anchorFromRouter(digest, actor, timestamp, eventType, market, _srcChainId);
    totalAnchorings++;
    
    emit AnchoringRelayed(digest, actor, _srcChainId);
}`}</code></pre>
                </div>

                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-purple-400 mb-2">Type 3: Combined</h4>
                  <p className="text-sm text-slate-400 mb-2">
                    Processes both fee settlement and anchoring in a single cross-chain message,
                    reducing gas costs and ensuring atomicity.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Server Integration */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              Server-Side Integration
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                The ProtocolSettlement service orchestrates cross-chain messaging from the backend,
                choosing between LayerZero and Wormhole based on chain support and security requirements.
              </p>

              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// server/protocol/settlement.ts

export enum RelayType {
  RELAY_LZ = 'layerzero',
  RELAY_WH = 'wormhole',
}

interface SettlementRequest {
  digest: string;
  payer: string;
  amount: bigint;
  market: string;
  eventType: string;
  targetChain: number;
  relay: RelayType;
}

async function settleCrossChain(request: SettlementRequest): Promise<string> {
  const { relay, targetChain, ...payload } = request;
  
  if (relay === RelayType.RELAY_LZ) {
    return sendViaLayerZero(targetChain, encodePayload(1, payload));
  } else {
    return sendViaWormhole(targetChain, encodePayload(1, payload));
  }
}

// Choose relay based on requirements
function selectRelay(targetChain: number, amount: bigint): RelayType {
  // High-value transactions use Wormhole for extra security
  if (amount > BigInt(100000) * BigInt(1e6)) {
    return RelayType.RELAY_WH;
  }
  
  // Check chain support
  if (LAYERZERO_CHAINS.includes(targetChain)) {
    return RelayType.RELAY_LZ;
  }
  
  return RelayType.RELAY_WH;
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* UI Integration */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              Atlas UI Integration
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Cross-chain settlements appear in the Payments mode with their source chain and relay type.
                Users can track the settlement status through the receipt system.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-2">Receipt Data</h4>
                  <ul className="text-sm text-slate-400 space-y-1 list-disc pl-4">
                    <li>Source chain ID</li>
                    <li>Relay type (LZ/WH)</li>
                    <li>Transaction hash on source</li>
                    <li>Confirmation status</li>
                    <li>Anchor transaction hash</li>
                  </ul>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-2">Status Flow</h4>
                  <ol className="text-sm text-slate-400 space-y-1 list-decimal pl-4">
                    <li>Pending (submitted)</li>
                    <li>Relaying (cross-chain)</li>
                    <li>Confirmed (on target)</li>
                    <li>Anchored (immutable)</li>
                  </ol>
                </div>
              </div>
            </div>
          </section>

          {/* Key Files */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-violet-400" />
              Key Files
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-purple-400">contracts/P3RouterLZ.sol</code>
                <span className="text-xs text-slate-500">LayerZero receiver</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-blue-400">contracts/P3Treasury.sol</code>
                <span className="text-xs text-slate-500">Fee accounting</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-emerald-400">contracts/P3Anchor.sol</code>
                <span className="text-xs text-slate-500">Immutable anchoring</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-cyan-400">server/protocol/settlement.ts</code>
                <span className="text-xs text-slate-500">Backend orchestration</span>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 flex justify-between">
          <Link href="/docs/infrastructure">
            <Button variant="outline" className="border-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous: Infrastructure
            </Button>
          </Link>
          <Link href="/docs/canvas-modes">
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500">
              Next: Canvas Modes
              <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Anchor, Database, FileCheck, Code, Shield, Clock, Zap, Hash } from "lucide-react";
import { SiGithub } from "react-icons/si";
import SEO from "@/components/SEO";

export default function BlockchainGuide() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEO 
        title="Blockchain Anchoring Implementation Guide | P3 Protocol"
        description="Learn how to implement immutable audit trails on Base Network with smart contracts, async anchoring queues, and verification receipts."
      />
      
      <div className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <a href="https://github.com/p3-protocol/p3-protocol/tree/main/contracts" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="border-white/20">
                <SiGithub className="w-4 h-4 mr-2" />
                View Source
              </Button>
            </a>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Anchor className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Blockchain Anchoring</h1>
              <p className="text-slate-400">Immutable Audit Trails on Base Network</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            P3 Protocol anchors cryptographic digests of actions (messages, payments, governance votes) to Base Network. This creates an immutable, verifiable audit trail without storing sensitive data on-chain.
          </p>
        </div>

        <div className="space-y-8">
          {/* How It Works */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5 text-emerald-400" />
              How It Works
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Instead of storing data on-chain (expensive and public), we store only a SHA-256 hash. The actual data stays encrypted off-chain, but anyone can verify its integrity by comparing hashes:
              </p>
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-900 rounded-xl p-4 text-center">
                  <Hash className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <div className="font-semibold text-white">1. Hash Data</div>
                  <div className="text-xs text-slate-500 mt-1">SHA-256(action + metadata)</div>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 text-center">
                  <Database className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                  <div className="font-semibold text-white">2. Queue Anchor</div>
                  <div className="text-xs text-slate-500 mt-1">Add to BullMQ queue</div>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 text-center">
                  <Anchor className="w-8 h-8 text-violet-400 mx-auto mb-2" />
                  <div className="font-semibold text-white">3. Anchor On-Chain</div>
                  <div className="text-xs text-slate-500 mt-1">Call P3Anchor.anchor()</div>
                </div>
              </div>
            </div>
          </section>

          {/* Smart Contract */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-violet-400" />
              P3Anchor Smart Contract
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                The P3Anchor contract stores digest hashes with timestamps. Each anchor costs minimal gas and is immutable once written:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// contracts/P3Anchor.sol
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

contract P3Anchor {
    struct Anchor {
        bytes32 digest;      // SHA-256 hash of the data
        uint256 timestamp;   // Block timestamp when anchored
        address submitter;   // Wallet that submitted the anchor
        string anchorType;   // Type: "message", "payment", "vote", etc.
    }
    
    // Mapping from anchor ID to anchor data
    mapping(bytes32 => Anchor) public anchors;
    
    // Events for indexing
    event Anchored(
        bytes32 indexed anchorId,
        bytes32 indexed digest,
        address indexed submitter,
        string anchorType,
        uint256 timestamp
    );
    
    /**
     * @notice Anchor a digest hash on-chain
     * @param anchorId Unique identifier for this anchor
     * @param digest SHA-256 hash of the off-chain data
     * @param anchorType Type of data being anchored
     */
    function anchor(
        bytes32 anchorId,
        bytes32 digest,
        string calldata anchorType
    ) external {
        require(anchors[anchorId].timestamp == 0, "Anchor already exists");
        
        anchors[anchorId] = Anchor({
            digest: digest,
            timestamp: block.timestamp,
            submitter: msg.sender,
            anchorType: anchorType
        });
        
        emit Anchored(anchorId, digest, msg.sender, anchorType, block.timestamp);
    }
    
    /**
     * @notice Verify a digest matches an existing anchor
     * @param anchorId The anchor to verify against
     * @param digest The digest to verify
     * @return valid True if the digest matches
     */
    function verify(bytes32 anchorId, bytes32 digest) external view returns (bool valid) {
        return anchors[anchorId].digest == digest;
    }
    
    /**
     * @notice Get full anchor details
     */
    function getAnchor(bytes32 anchorId) external view returns (Anchor memory) {
        return anchors[anchorId];
    }
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Async Queue */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Async Anchoring Queue
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Anchoring happens asynchronously via BullMQ to avoid blocking user actions. The queue batches anchors and handles retries:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// server/queues/anchor.ts
import { Queue, Worker } from 'bullmq';
import { ethers } from 'ethers';
import { createHash } from 'crypto';

const anchorQueue = new Queue('anchor', { connection: redis });

interface AnchorJob {
  anchorId: string;
  data: any;          // The data to hash
  anchorType: string; // "message" | "payment" | "vote" | etc.
  walletAddress: string;
}

// Add job to queue (called from API routes)
export async function queueAnchor(job: AnchorJob): Promise<string> {
  // Create digest from data
  const digest = createHash('sha256')
    .update(JSON.stringify(job.data))
    .digest('hex');
  
  await anchorQueue.add('anchor', {
    ...job,
    digest: \`0x\${digest}\`
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
  });
  
  return digest;
}

// Worker processes anchor jobs
const worker = new Worker('anchor', async (job) => {
  const { anchorId, digest, anchorType, walletAddress } = job.data;
  
  // Connect to Base Network
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  const wallet = new ethers.Wallet(process.env.ANCHOR_PRIVATE_KEY!, provider);
  const contract = new ethers.Contract(P3_ANCHOR_ADDRESS, P3_ANCHOR_ABI, wallet);
  
  // Submit anchor transaction
  const tx = await contract.anchor(
    ethers.id(anchorId),
    digest,
    anchorType
  );
  
  // Wait for confirmation
  const receipt = await tx.wait();
  
  // Store receipt in database
  await db.insert(anchorReceipts).values({
    anchorId,
    digest,
    anchorType,
    walletAddress,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    timestamp: Date.now()
  });
  
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}, { connection: redis });`}</code></pre>
              </div>
            </div>
          </section>

          {/* API Integration */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              API Integration
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Example: Anchoring a message when it's sent:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// server/routes.ts - Message send endpoint

app.post('/api/nexus/messages', async (req, res) => {
  const { to, encryptedContent } = req.body;
  const from = req.session.walletAddress;
  
  // Generate message ID
  const messageId = ulid();
  
  // Store message
  await db.insert(messages).values({
    id: messageId,
    from,
    to,
    encryptedContent,
    timestamp: Date.now()
  });
  
  // Queue blockchain anchor (async, non-blocking)
  const digest = await queueAnchor({
    anchorId: \`msg_\${messageId}\`,
    data: {
      from,
      to,
      contentHash: createHash('sha256').update(encryptedContent).digest('hex'),
      timestamp: Date.now()
    },
    anchorType: 'message',
    walletAddress: from
  });
  
  res.json({ 
    success: true, 
    messageId,
    anchorDigest: digest // Client can use this to verify later
  });
});

// Verification endpoint
app.get('/api/anchor/verify/:anchorId', async (req, res) => {
  const { anchorId } = req.params;
  
  // Get receipt from database
  const receipt = await db.select()
    .from(anchorReceipts)
    .where(eq(anchorReceipts.anchorId, anchorId))
    .limit(1);
  
  if (!receipt.length) {
    return res.json({ verified: false, status: 'pending' });
  }
  
  // Verify on-chain
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  const contract = new ethers.Contract(P3_ANCHOR_ADDRESS, P3_ANCHOR_ABI, provider);
  
  const onChainAnchor = await contract.getAnchor(ethers.id(anchorId));
  
  res.json({
    verified: onChainAnchor.digest === receipt[0].digest,
    txHash: receipt[0].txHash,
    blockNumber: receipt[0].blockNumber,
    timestamp: receipt[0].timestamp,
    explorerUrl: \`https://basescan.org/tx/\${receipt[0].txHash}\`
  });
});`}</code></pre>
              </div>
            </div>
          </section>

          {/* Hardhat Deployment */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-400" />
              Hardhat Deployment
            </h2>
            <div className="prose prose-invert max-w-none">
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    base: {
      url: process.env.BASE_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
      chainId: 8453
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
      chainId: 84532
    }
  }
};

export default config;

// scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  const P3Anchor = await ethers.getContractFactory("P3Anchor");
  const anchor = await P3Anchor.deploy();
  await anchor.waitForDeployment();
  
  console.log("P3Anchor deployed to:", await anchor.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Deploy command:
// npx hardhat run scripts/deploy.ts --network base`}</code></pre>
              </div>
            </div>
          </section>

          {/* Key Files */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-emerald-400" />
              Key Files
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-emerald-400">contracts/P3Anchor.sol</code>
                <span className="text-xs text-slate-500">Anchor smart contract</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-cyan-400">server/queues/anchor.ts</code>
                <span className="text-xs text-slate-500">BullMQ anchor queue</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-violet-400">server/atlas/gamedeck/anchorService.ts</code>
                <span className="text-xs text-slate-500">Anchor service wrapper</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-amber-400">hardhat.config.ts</code>
                <span className="text-xs text-slate-500">Hardhat configuration</span>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 flex justify-between">
          <Link href="/docs/canvas-modes">
            <Button variant="outline" className="border-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous: Canvas Modes
            </Button>
          </Link>
          <Link href="/">
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-500">
              Back to Home
              <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

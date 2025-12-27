# P3 Protocol - Deployment Guide

**Privacy-Preserving Proof-of-Communication Protocol**

This guide provides comprehensive instructions for deploying the P3 Protocol to production environments.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Database Setup](#database-setup)
4. [Smart Contract Deployment](#smart-contract-deployment)
5. [ZK Circuit Compilation](#zk-circuit-compilation)
6. [Backend Server Deployment](#backend-server-deployment)
7. [Frontend Deployment](#frontend-deployment)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Scaling Considerations](#scaling-considerations)

---

## Prerequisites

### System Requirements

- **Node.js**: v20.x or higher
- **PostgreSQL**: v14.x or higher (Neon-backed recommended)
- **Memory**: Minimum 4GB RAM (8GB+ recommended for production)
- **Storage**: 50GB+ SSD for database and logs
- **Network**: Base RPC access (Sepolia for testnet, Mainnet for production)

### Required Tools

```bash
# Node.js and npm
node --version  # v20.x+
npm --version   # v10.x+

# PostgreSQL client
psql --version  # 14.x+

# Hardhat (for contract deployment)
npx hardhat --version

# Optional: PM2 for process management
npm install -g pm2

# Optional: Docker & Docker Compose
docker --version
docker-compose --version
```

### Access Requirements

- **Base RPC URL**: Access to Base Sepolia or Mainnet
- **Basescan API Key**: For contract verification
- **Private Key**: Ethereum wallet with sufficient ETH/gas
- **Database Connection**: PostgreSQL connection string

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

### Core Application

```bash
# Node Environment
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:password@host:5432/p3protocol
PGHOST=your-pg-host.com
PGPORT=5432
PGUSER=your-username
PGPASSWORD=your-password
PGDATABASE=p3protocol

# JWT Authentication
JWT_SECRET=<generate-with-openssl-rand-hex-64>
JWT_EXPIRES_IN=7d

# Security
IP_SALT=<generate-with-openssl-rand-hex-32>
WEBHOOK_ENCRYPTION_KEY=<generate-with-openssl-rand-hex-32>
```

### Blockchain & Smart Contracts

```bash
# Private Keys
PRIVATE_KEY=0x... # Deployer private key
PROPOSER_PRIVATE_KEY=0x... # DAO proposer key
ROLLUP_PRIVATE_KEY=0x... # Rollup sequencer key

# RPC URLs
RPC_URL=https://mainnet.base.org
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
L1_RPC_URL=https://mainnet.base.org
L2_RPC_URL=https://mainnet.base.org

# Contract Addresses (set after deployment)
GOVERNOR_CONTRACT_ADDRESS=0x...
ANCHOR_REGISTRY_ADDRESS=0x...
CHECKPOINT_REGISTRY_ADDRESS=0x...
CONSENT_REGISTRY_ADDRESS=0x...
GOVERNANCE_TOKEN_ADDRESS=0x...
RECEIPT_BOUND_TOKEN_ADDRESS=0x...
TREASURY_ADDRESS=0x...
TRUST_POLICY_ROUTER_ADDRESS=0x...
ZK_RECEIPTS_VERIFIER_ADDRESS=0x...

# Basescan
BASESCAN_API_KEY=your-basescan-api-key
```

### Rollup Services (Optional)

```bash
# Enable/Disable Services
ENABLE_SEQUENCER=true
ENABLE_DA_ADAPTER=true
ENABLE_CHECKPOINT=true
ENABLE_BLOB_STORAGE=false

# Rollup Configuration
BATCH_INTERVAL=30000 # milliseconds
MAX_BATCH_SIZE=1000
CHECKPOINT_INTERVAL=3600000 # 1 hour
MAX_CALLDATA_SIZE=131072
ROLLUP_STATE_DB_PATH=./data/rollup-state
```

### Observability

```bash
# Logging
LOG_LEVEL=info
PINO_LOG_LEVEL=info

# Metrics
ENABLE_METRICS=true
PROMETHEUS_PORT=9090

# Monitoring
ENABLE_HEALTH_CHECKS=true
HEALTH_CHECK_INTERVAL=60000
```

### External Services

```bash
# IPFS (optional)
IPFS_GATEWAY_URL=https://gateway.pinata.cloud
IPFS_API_KEY=your-ipfs-api-key

# ENS/Basename Resolution
ENS_RPC_URL=https://mainnet.infura.io/v3/your-project-id
```

---

## Database Setup

### 1. Create PostgreSQL Database

```bash
# Local PostgreSQL
createdb p3protocol

# Or using psql
psql -U postgres
CREATE DATABASE p3protocol;
\q
```

### 2. Run Database Migrations

Migrations are automatically run on server startup, but you can run them manually:

```bash
# Set DATABASE_URL
export DATABASE_URL=postgresql://user:password@host:5432/p3protocol

# Run migrations
npm run migrate

# Or run server (migrations run automatically)
npm run server
```

### 3. Verify Migration

```bash
# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Expected tables:
# - users
# - receipts
# - audit_log
# - ledger_events
# - allocations
# - telemetry_events
# - wallet_registry
# - call_sessions
# - telemetry_voice
# - trust_config
# - trust_rules
# - trust_plugins
# - bridge_jobs
# - messages
# - notes
# - directory_entries
# - inbox_items
# - dao_proposals

\q
```

### 4. Database Backup Strategy

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | gzip > backups/p3protocol_$DATE.sql.gz

# Keep last 30 days
find backups/ -name "*.sql.gz" -mtime +30 -delete
```

---

## Smart Contract Deployment

### 1. Compile Contracts

```bash
# Install dependencies
npm install

# Compile all contracts
npx hardhat compile

# Verify compilation
ls artifacts/contracts/
```

### 2. Configure Deployment Network

Edit `hardhat.config.ts` to ensure correct network configuration:

```typescript
// Base Mainnet
base: {
  url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
  chainId: 8453,
},
// Base Sepolia Testnet
baseSepolia: {
  url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
  chainId: 84532,
},
```

### 3. Deploy to Base Sepolia (Testnet)

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Deploy contracts
npx hardhat run scripts/deploy.ts --network baseSepolia

# Save deployment addresses
# Addresses will be saved to deployment-addresses.json
```

### 4. Deploy to Base Mainnet (Production)

```bash
# CRITICAL: Ensure you have sufficient ETH for gas
# Recommended: 0.1 ETH for all deployments

export PRIVATE_KEY=0x...
export BASE_RPC_URL=https://mainnet.base.org

# Deploy contracts
npx hardhat run scripts/deploy.ts --network base

# Deployment output will show:
# ✓ GovernanceToken deployed at: 0x...
# ✓ Timelock deployed at: 0x...
# ✓ GovernorP3 deployed at: 0x...
# ✓ Treasury deployed at: 0x...
# ✓ AnchorRegistry deployed at: 0x...
# ✓ ConsentRegistry deployed at: 0x...
# ✓ ReceiptBoundToken deployed at: 0x...
# ✓ TrustPolicyRouter deployed at: 0x...
# ✓ ZKReceiptsVerifier deployed at: 0x...
```

### 5. Verify Contracts on Basescan

```bash
# Set Basescan API key
export BASESCAN_API_KEY=your-api-key

# Verify each contract
npx hardhat verify --network base <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>

# Example: Verify GovernanceToken
npx hardhat verify --network base 0x... "P3 Governance Token" "P3GOV"

# Example: Verify Governor
npx hardhat verify --network base 0x... <TOKEN_ADDRESS> <TIMELOCK_ADDRESS>
```

### 6. Update Environment Variables

After deployment, update `.env` with deployed contract addresses:

```bash
GOVERNOR_CONTRACT_ADDRESS=0x...
ANCHOR_REGISTRY_ADDRESS=0x...
CONSENT_REGISTRY_ADDRESS=0x...
GOVERNANCE_TOKEN_ADDRESS=0x...
RECEIPT_BOUND_TOKEN_ADDRESS=0x...
TREASURY_ADDRESS=0x...
TRUST_POLICY_ROUTER_ADDRESS=0x...
ZK_RECEIPTS_VERIFIER_ADDRESS=0x...
```

---

## ZK Circuit Compilation

### 1. Install Circom

```bash
# Install Circom compiler
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# Verify installation
circom --version
```

### 2. Compile Circuits

```bash
# Navigate to ZK package
cd packages/zk

# Compile all circuits
npm run compile:circuits

# This will compile:
# - MessageReceipt.circom
# - MeetingReceipt.circom
# - PaymentReceipt.circom
# - ConsentState.circom

# Output files in packages/zk/build/:
# - *.wasm (WASM witness calculator)
# - *.zkey (Proving key)
# - verification_key.json (Verification key)
```

### 3. Generate Trusted Setup (Powers of Tau)

```bash
# Download powers of tau (or generate for production)
cd packages/zk

# Download phase 1 trusted setup (ptau file)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau

# For each circuit, generate proving and verification keys
snarkjs groth16 setup build/MessageReceipt.r1cs powersOfTau28_hez_final_15.ptau build/MessageReceipt_0000.zkey
snarkjs zkey contribute build/MessageReceipt_0000.zkey build/MessageReceipt.zkey --name="Contributor" -v

# Export verification key
snarkjs zkey export verificationkey build/MessageReceipt.zkey build/verification_key.json

# Repeat for all circuits
```

### 4. Verify Setup

```bash
# Test proof generation
npm run test:zk

# Expected output:
# ✓ MessageReceipt proof generation
# ✓ MeetingReceipt proof generation
# ✓ PaymentReceipt proof generation
# ✓ ConsentState proof generation
```

---

## Backend Server Deployment

### Option A: PM2 Deployment (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'p3-protocol',
    script: 'server/index.ts',
    interpreter: 'npx',
    interpreter_args: 'tsx',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 4000
  }]
};
EOF

# Start server
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup

# Monitor
pm2 monit

# View logs
pm2 logs p3-protocol
```

### Option B: Docker Deployment

```bash
# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --production
RUN cd client && npm ci --production

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["npm", "run", "server"]
EOF

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    env_file:
      - .env
    depends_on:
      - postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: p3protocol
      POSTGRES_USER: ${PGUSER}
      POSTGRES_PASSWORD: ${PGPASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
EOF

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f app

# Check health
curl http://localhost:5000/health
```

### Option C: Systemd Service

```bash
# Create systemd service file
sudo tee /etc/systemd/system/p3-protocol.service << 'EOF'
[Unit]
Description=P3 Protocol Server
After=network.target postgresql.service

[Service]
Type=simple
User=p3
WorkingDirectory=/opt/p3-protocol
Environment="NODE_ENV=production"
EnvironmentFile=/opt/p3-protocol/.env
ExecStart=/usr/bin/npm run server
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=p3-protocol

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable p3-protocol
sudo systemctl start p3-protocol

# Check status
sudo systemctl status p3-protocol

# View logs
sudo journalctl -u p3-protocol -f
```

---

## Frontend Deployment

### Option A: Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
cd client
vercel --prod

# Set environment variables in Vercel dashboard:
# VITE_API_URL=https://api.p3protocol.com
# VITE_CHAIN_ID=8453
# VITE_RPC_URL=https://mainnet.base.org

# Configure custom domain
vercel domains add p3protocol.com
```

### Option B: Netlify Deployment

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Build frontend
npm run build

# Deploy
netlify deploy --prod --dir=dist/client

# Configure in netlify.toml:
cat > netlify.toml << 'EOF'
[build]
  command = "npm run build"
  publish = "dist/client"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  VITE_API_URL = "https://api.p3protocol.com"
  VITE_CHAIN_ID = "8453"
EOF
```

### Option C: Self-Hosted Nginx

```bash
# Build frontend
npm run build

# Copy to web root
sudo cp -r dist/client/* /var/www/p3protocol/

# Nginx configuration
sudo tee /etc/nginx/sites-available/p3protocol << 'EOF'
server {
    listen 80;
    server_name p3protocol.com www.p3protocol.com;

    root /var/www/p3protocol;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/p3protocol /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Setup SSL with Let's Encrypt
sudo certbot --nginx -d p3protocol.com -d www.p3protocol.com
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
# Check server health
curl http://localhost:5000/health

# Expected response:
{
  "status": "healthy",
  "database": "connected",
  "uptime": 12345,
  "timestamp": "2025-11-15T00:00:00.000Z"
}
```

### 2. Metrics Endpoint

```bash
# Check Prometheus metrics
curl http://localhost:5000/metrics

# Should return Prometheus format metrics
```

### 3. Database Connection

```bash
# Verify database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### 4. Smart Contract Verification

```bash
# Verify contracts on Basescan
# Visit: https://basescan.org/address/<CONTRACT_ADDRESS>
# Check: Contract verified ✓
```

### 5. API Endpoints

```bash
# Test authentication
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'

# Test receipt creation
curl -X POST http://localhost:5000/api/receipts \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"type":"message","subjectId":"test-1","content":"Hello World"}'
```

### 6. ZK Proof Generation

```bash
# Test ZK proof endpoint
curl -X POST http://localhost:5000/api/zk/prove \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "circuit": "MessageReceipt",
    "inputs": {
      "messageHash": "0x123...",
      "sender": "0xabc...",
      "recipient": "0xdef..."
    }
  }'
```

---

## Scaling Considerations

### Horizontal Scaling

```bash
# PM2 cluster mode (already configured)
pm2 scale p3-protocol 4  # Scale to 4 instances

# Or in ecosystem.config.js:
instances: 'max'  # Use all CPU cores
```

### Database Scaling

```bash
# Connection pooling (already configured in code)
# Max connections: 20
# Idle timeout: 30s

# For high load, use PgBouncer
sudo apt-get install pgbouncer

# Configure /etc/pgbouncer/pgbouncer.ini
[databases]
p3protocol = host=localhost port=5432 dbname=p3protocol

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

### CDN Integration

```bash
# Use Cloudflare for static assets
# Configure in client/vite.config.ts
build: {
  rollupOptions: {
    output: {
      assetFileNames: 'assets/[name]-[hash][extname]'
    }
  }
}

# Upload to CDN
aws s3 sync dist/client s3://p3-cdn/ --cache-control max-age=31536000
```

### Monitoring & Alerting

```bash
# Prometheus + Grafana setup
docker-compose -f monitoring/docker-compose.yml up -d

# Alerts configured in monitoring/alerts.yml
# - High error rate (>5%)
# - Database connection failures
# - Memory usage >80%
# - Response time >2s
```

---

## Rollback Procedures

### Database Rollback

```bash
# Restore from backup
gunzip < backups/p3protocol_20251115_120000.sql.gz | psql $DATABASE_URL
```

### Application Rollback

```bash
# PM2
pm2 stop p3-protocol
git checkout v1.0.0
npm install
pm2 restart p3-protocol

# Docker
docker-compose down
git checkout v1.0.0
docker-compose up -d
```

### Smart Contract Rollback

**Note: Smart contracts cannot be rolled back. Deploy new versions and update addresses.**

---

## Support & Troubleshooting

For issues during deployment:

1. Check logs: `pm2 logs p3-protocol` or `docker-compose logs`
2. Verify environment variables: `env | grep -E "DATABASE|RPC|CONTRACT"`
3. Test database connection: `psql $DATABASE_URL -c "SELECT 1;"`
4. Review RUNBOOK.md for common issues
5. Check server health: `curl http://localhost:5000/health`

---

**Deployment Complete!** 🚀

Your P3 Protocol instance is now running in production.

Next steps:
- Review [RUNBOOK.md](RUNBOOK.md) for operations procedures
- Check [ARCHITECTURE.md](ARCHITECTURE.md) for system architecture
- See [API.md](API.md) for complete API documentation

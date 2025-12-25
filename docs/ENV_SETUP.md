# Environment Setup Guide

This document lists all environment variables required to run P3 Protocol. Create a `.env` file in the project root with these values.

---

## Required Variables

### Database
```env
DATABASE_URL=postgresql://user:password@host:5432/p3protocol
PGHOST=your-db-host
PGPORT=5432
PGUSER=your-db-user
PGPASSWORD=your-db-password
PGDATABASE=p3protocol
```

### Authentication
```env
JWT_SECRET=your-random-256-bit-secret
SESSION_SECRET=your-session-secret
```

### Wallet Configuration
```env
ADMIN_WALLET=0xYourAdminWalletAddress
TREASURY_ADDRESS=0xYourTreasuryWalletAddress
```
- `ADMIN_WALLET` - Wallet address with admin privileges for moderation, analytics, and governance
- `TREASURY_ADDRESS` - Wallet address for treasury/payment operations

---

## WalletConnect (Required for Wallet Connections)

Get your project IDs from [WalletConnect Cloud](https://cloud.walletconnect.com/):

```env
VITE_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
VITE_P3_WALLETCONNECT_PROJECT_ID=your-p3-walletconnect-project-id
```

---

## Blockchain (Optional - for on-chain features)

### Deployer Keys
```env
PRIVATE_KEY=your-deployer-private-key
PRIVATE_KEY_DEPLOYER=your-deployer-private-key
```
**WARNING**: Never commit private keys. These are only needed for contract deployment.

### Contract Addresses
```env
VITE_CONTRACT_BASE_MAINNET=0xYourDeployedContractAddress
```

After deploying contracts, update the default config in:
- `client/src/lib/sdk/types.ts` - Update `DEFAULT_CONFIG.contract`
- `scripts/verify-anchor.ts` - Update `CONTRACT_ADDRESS`

---

## API Keys (Optional - for extended features)

### Web3 Providers
```env
MORALIS_API_KEY=your-moralis-api-key
ALCHEMY_API_KEY=your-alchemy-api-key
HELIUS_API_KEY=your-helius-api-key
```
- [Moralis](https://moralis.io/) - EVM chain data
- [Alchemy](https://www.alchemy.com/) - Ethereum infrastructure
- [Helius](https://helius.xyz/) - Solana infrastructure

### Other Services
```env
COINGECKO_API_KEY=your-coingecko-api-key
TWITTER_BEARER_TOKEN=your-twitter-bearer-token
```

---

## Files with Hardcoded Values to Update

If you deploy your own contracts, update these files:

| File | Variable | Description |
|------|----------|-------------|
| `client/src/lib/sdk/types.ts` | `DEFAULT_CONFIG.contract` | Default contract address |
| `client/src/lib/sdk/types.ts` | `DEFAULT_CONFIG.treasury` | Default treasury address |
| `scripts/verify-anchor.ts` | `CONTRACT_ADDRESS` | Anchor registry contract |

---

## Quick Start

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in required values (at minimum):
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `SESSION_SECRET`
   - `VITE_WALLETCONNECT_PROJECT_ID`

3. Create your PostgreSQL database and push the schema:
   ```bash
   # Create database (example using psql)
   createdb p3protocol
   
   # Push schema to database
   npx drizzle-kit push
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

---

## Database Setup

The project uses **Drizzle ORM** with PostgreSQL. The schema is defined in `shared/schema.ts`.

### Option 1: Local PostgreSQL
```bash
# Install PostgreSQL locally
# Create database
createdb p3protocol

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://localhost:5432/p3protocol

# Push schema
npx drizzle-kit push
```

### Option 2: Cloud PostgreSQL (Neon, Supabase, etc.)
1. Create a PostgreSQL instance on your provider
2. Copy the connection string to `DATABASE_URL` in `.env`
3. Run `npx drizzle-kit push` to create tables

---

## Security Notes

- Never commit `.env` files (already in `.gitignore`)
- Use different WalletConnect project IDs for dev/production
- Rotate `JWT_SECRET` and `SESSION_SECRET` periodically
- Use hardware wallets for `ADMIN_WALLET` in production

# DataHaven Contracts Deployment

Deploy DataHaven AVS contracts to supported chains (Hoodi, Holesky, Mainnet).

## What Gets Deployed

- **DataHaven**: ServiceManager, VetoableSlasher, RewardsRegistry  
- **Snowbridge**: BeefyClient, AgentExecutor, Gateway, RewardsAgent
- **EigenLayer**: References existing contracts (not deployed)

## Prerequisites

1. **Account Setup**: Create or import an account in Metamask (you'll need the private key)
2. **Funding**: Get native tokens for deployment fees:
   - **Hoodi**: Use PoW Faucet at https://hoodi-faucet.pk910.de/#/mine/cc7df92c-9629-4ad8-aaa4-53b1e1c294e8
   - **Holesky**: Use public faucets or bridge from mainnet
   - **Mainnet**: Purchase ETH
3. **API Key** (optional): Generate API token from block explorer for contract verification:
   - Hoodi: Etherscan-compatible endpoint
   - Holesky: https://holesky.etherscan.io/apis  
   - Mainnet: https://etherscan.io/apis

## Setup

```bash
cd test && cp cli/handlers/contracts/.env.example .env
```

Edit `.env` with your values:
```bash
# Required: Private key with deployment funds
DEPLOYER_PRIVATE_KEY=0x...

# Required: AVS owner private key (can be same as DEPLOYER_PRIVATE_KEY)
AVS_OWNER_PRIVATE_KEY=0x...

# Optional: For contract verification
ETHERSCAN_API_KEY=your_api_key_here
```

## Deployment Commands

### Deploy to Hoodi
```bash
bun cli contracts deploy --chain hoodi
```

### Deploy to Holesky  
```bash
bun cli contracts deploy --chain holesky
```

### Deploy to Mainnet
```bash
bun cli contracts deploy --chain mainnet
```

### Custom RPC URL
```bash
bun cli contracts deploy --chain hoodi --rpc-url https://your-rpc-url.com
```

## Check Deployment Status
```bash
bun cli contracts status --chain hoodi
```

## Deployment Files

Successful deployments create:
- `../contracts/deployments/{chain}.json` - Contract addresses
- `../contracts/deployments/{chain}-rewards-info.json` - Rewards configuration
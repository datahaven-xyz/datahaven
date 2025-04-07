# End-to-End Test Environment

> [WARNING‼️]  
> 🏗️ Under construction!

## Contents

```sh
.
├── README.md
├── configs                 # Configurations for test networks
└── scripts                 # Helper scripts for interacting with the network
```

## Pre-requisites

- [Kurtosis](https://docs.kurtosis.com/install): For launching test networks
- [Bun](https://bun.sh/): TypeScript runtime and package manager
- [Docker](https://www.docker.com/): For container management

## QuickStart

Run: `bun start:e2e:minimal`

## Manual Deployment

Follow these steps to set up and interact with your test environment:

1. **Deploy a minimal test environment**

   ```bash
   bun start:e2e:minimal
   ```

2. **Explore the network**

   - Block Explorer: [http://localhost:3000](http://localhost:3000).
   - Kurtosis Dashboard: Run `kurtosis web` to access. From it you can see all the services running in the network, as well as their ports, status and logs.

3. **Send test transactions**

   ```bash
   bun script:send-txs
   ```

4. **Deploy and verify contracts**
   ```bash
   bun script:deploy-contracts
   ```

## Network Management

- **Stop the test environment**

  ```bash
  bun stop:e2e:minimal
  ```

- **Stop the Kurtosis engine completely**
  ```bash
  bun stop:kurtosis-engine
  ```

## Troubleshooting

### E2E Network Launch doesn't work

#### Linux: See if disabling ipV6 helps

I have found that ipV6 on Arch Linux does not play very nicely with Kurtosis networks. Disabling it completely fixed the issue for me.

#### macOS: Verify Docker networking settings

![Docker Network Settings](../resources/mac_docker.png)

If using Docker Desktop, make sure settings have permissive networking enabled.

## Further Information

- [Kurtosis](https://docs.kurtosis.com/): Used for launching a full Ethereum network
- [Zombienet](https://paritytech.github.io/zombienet/): Used for launching a Polkadot-SDK based network
- [Bun](https://bun.sh/): TypeScript runtime and ecosystem tooling

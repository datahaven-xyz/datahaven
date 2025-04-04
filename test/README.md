# End-to-End Test

> [!WARNING]  
> 🏗️ Under construction!

## Contents

```sh
.
├── README.md
├── configs                 <--- Configs used for launching networks
└── scripts                 <--- Misc stored procedureskur
```

## Pre-requisites

- Kurtosis: [https://docs.kurtosis.com/install](https://docs.kurtosis.com/install)

## Deployment

>[!TIP]  
> You can check it's all working hunky dory by running `bun script:send-txn`

```sh
cd ~/<repo_root>/contracts
forge script script/deploy/Deploy.s.sol --rpc-url http://localhost:<RETH_RPC_PORT> --verify --verifier blockscout --verifier-url http://localhost:<BLOCKSCOUT_PORT>/api/ --broadcast 
```

## Troubleshooting

### E2E Network Launch doesn't work

#### Linux: See if disabling  ipV6 helps

I have found that ipV6 on Arch linux does not play very nicely with kurtosis networks. Disabling it completely fixed the issue for me.

#### macOS: Verify Docker networking settings

![Docker Network Settings](./mac_docker.png)

If using Docker Desktop, make sure settings have permissive networking enabled.

## Further Info

- [Kurtosis](https://docs.kurtosis.com/) - Used for launching a full ethereum network.
- [Zombienet](https://paritytech.github.io/zombienet/) - Used for launching a polkadot-sdk based network.
- [Bun](https://bun.sh/) - TypeScript runtime and ecosystem tooling.

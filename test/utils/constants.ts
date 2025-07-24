export const DEFAULT_SUBSTRATE_WS_PORT = 9944;

export const ANVIL_FUNDED_ACCOUNTS = {
  0: {
    publicKey: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  },
  1: {
    publicKey: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  },
  2: {
    publicKey: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
  },
  3: {
    publicKey: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
  },
  4: {
    publicKey: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"
  },
  5: {
    publicKey: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    privateKey: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"
  },
  6: {
    publicKey: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    privateKey: "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e"
  },
  7: {
    publicKey: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
    privateKey: "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356"
  },
  8: {
    publicKey: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    privateKey: "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97"
  },
  9: {
    publicKey: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
    privateKey: "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6"
  },
  mnemonic: ["test test test test test test test test test test test junk"],
  derivationPath: "m/44'/60'/0'/0/"
} as const;

export const CHAIN_ID = 3151908;

export const CONTAINER_NAMES = {
  EL1: "el-1-reth-lodestar",
  EL2: "el-2-reth-lodestar",
  "blockscout-be": "blockscout--",
  "blockscout-fe": "blockscout-frontend--"
} as const;

export const SUBSTRATE_FUNDED_ACCOUNTS = {
  ALITH: {
    publicKey: "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac",
    privateKey: "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133"
  },
  BALTATHAR: {
    publicKey: "0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0",
    privateKey: "0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b"
  },
  CHARLETH: {
    publicKey: "0x798d4Ba9baf0064Ec19eB4F0a1a45785ae9D6DFc",
    privateKey: "0x0b6e18cafb6ed99687ec547bd28139cafdd2bffe70e6b688025de6b445aa5c5b"
  },
  DOROTHY: {
    publicKey: "0x773539d4Ac0e786233D90A233654ccEE26a613D9",
    privateKey: "0x39539ab1876910bbf3a223d84a29e28f1cb4e2e456503e7e91ed39b2e7223d68"
  },
  ETHAN: {
    publicKey: "0xFf64d3F6efE2317EE2807d223a0Bdc4c0c49dfDB",
    privateKey: "0x7dce9bc8babb68fec1409be38c8e1a52650206a7ed90ff956ae8a6d15eeaaef4"
  },
  FAITH: {
    publicKey: "0xC0F0f4ab324C46e55D02D0033343B4Be8A55532d",
    privateKey: "0xb9d2ea9a615f3165812e8d44de0d24da9bbd164b65c4f0573e1ce2c8dbd9c8df"
  },
  GOLIATH: {
    publicKey: "0x7BF369283338E12C90514468aa3868A551AB2929",
    privateKey: "0x96b8a38e12e1a31dee1eab2fffdf9d9990045f5b37e44d8cc27766ef294acf18"
  },
  HEATH: {
    publicKey: "0x931f3600a299fd9B24cEfB3BfF79388D19804BeA",
    privateKey: "0x0d6dcaaef49272a5411896be8ad16c01c35d6f8c18873387b71fbc734759b0ab"
  },
  IDA: {
    publicKey: "0xC41C5F1123ECCd5ce233578B2e7ebd5693869d73",
    privateKey: "0x4c42532034540267bf568198ccec4cb822a025da542861fcb146a5fab6433ff8"
  },
  JUDITH: {
    publicKey: "0x2898FE7a42Be376C8BC7AF536A940F7Fd5aDd423",
    privateKey: "0x94c49300a58d576011096bcb006aa06f5a91b34b4383891e8029c21dc39fbb8b"
  }
} as const;

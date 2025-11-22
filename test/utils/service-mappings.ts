export interface ServiceMapping {
  service: string;
  containerPattern: string;
  internalPort: number;
  protocol: string;
}

export interface ServiceInfo {
  service: string;
  port: string;
  url: string;
}

export const StandardServiceMappings: ServiceMapping[] = [
  {
    service: "reth-1-rpc",
    containerPattern: "el-1-reth-lodestar",
    internalPort: 8545,
    protocol: "tcp"
  },
  {
    service: "reth-2-rpc",
    containerPattern: "el-2-reth-lodestar",
    internalPort: 8545,
    protocol: "tcp"
  },
  {
    service: "blockscout-backend",
    containerPattern: "blockscout--",
    internalPort: 4000,
    protocol: "tcp"
  },
  {
    service: "dora",
    containerPattern: "dora--",
    internalPort: 8080,
    protocol: "tcp"
  }
];

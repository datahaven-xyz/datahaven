import { execSync } from "node:child_process";

export const findLocalEthRpcPort = () => {
  const stdout = execSync(`docker ps --format "{{.Names}} -> {{.Ports}}"`).toString();

  const lines = stdout.toString().split("\n");
  for (const line of lines) {
    if (/el-.*reth/.test(line)) {
      return line.match(/.+ -> .*:(\d+)->8545\/tcp/)?.[1];
    }
  }

  console.log(stdout.toString());
  throw new Error("No local Ethereum EL RPC port found");
};

export const findBlockscoutFrontendPort = () => {
  const stdout = execSync(`docker ps --format "{{.Names}} -> {{.Ports}}"`).toString();

  const lines = stdout.toString().split("\n");
  for (const line of lines) {
    if (/blockscout-frontend-.*/.test(line)) {
      return line.match(/.+ -> .*:(\d+)->3000\/tcp/)?.[1];
    }
  }

  console.log(stdout.toString());
  throw new Error("No local Blockscout frontend port found");
};

export const findBlockscoutBackendPort = () => {
  const stdout = execSync(`docker ps --format "{{.Names}} -> {{.Ports}}"`).toString();

  const lines = stdout.toString().split("\n");
  for (const line of lines) {
    if (/blockscout-verif/.test(line)) {
      return line.match(/.+ -> .*:(\d+)->4000\/tcp/)?.[1];
    }
  }

  console.log(stdout.toString());
  throw new Error("No local Blockscout backend port found");
};

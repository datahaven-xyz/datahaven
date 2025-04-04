import { spawn } from "node:child_process";
import { findLocalEthRpcPort, findBlockscoutBackendPort } from "./utils";

const NETWORK_RPC_URL = process.env.NETWORK_RPC_URL || `http://localhost:${findLocalEthRpcPort()}`;
const BLOCKSCOUT_BACKEND_URL =
  process.env.BLOCKSCOUT_BACKEND_URL || `http://localhost:${findBlockscoutBackendPort()}`;

async function main() {
  process.chdir("../contracts");

  console.log(`Deploying contracts to ${NETWORK_RPC_URL} and ${BLOCKSCOUT_BACKEND_URL}`);

  const args = [
    "script/deploy/Deploy.s.sol",
    "--rpc-url",
    NETWORK_RPC_URL,
    "--verify",
    "--verifier",
    "blockscout",
    "--verifier-url",
    `${BLOCKSCOUT_BACKEND_URL}/api/`,
    "--broadcast"
  ];

  const forge = spawn("forge", ["script", ...args], { stdio: "inherit" });

  forge.on("close", (code) => {
    console.log(`forge process exited with code ${code}`);
    if (code !== 0) {
      process.exit(code ?? 1);
    }
  });
}

main();

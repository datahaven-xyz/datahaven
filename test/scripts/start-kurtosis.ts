import { $ } from "bun";
import invariant from "tiny-invariant";
import { getServicesFromDocker } from "../util/docker-service-mapper";
import sendTxn from "./send-txn";

async function main() {
  const timeStart = performance.now();

  if (!(await checkKurtosisInstalled())) {
    console.error("Kurtosis CLI is required to be installed: https://docs.kurtosis.com/install");
    throw Error("❌ Kurtosis CLI application not found.");
  }

  if (!(await checkDockerRunning())) {
    console.error("Is Docker Running? Unable to make connection to docker daemon");
    throw Error("❌ Error connecting to Docker");
  }

  if (!(await checkForgeInstalled())) {
    console.error("Is foundry installed? https://book.getfoundry.sh/getting-started/installation");
    throw Error("❌ forge binary not found in PATH");
  }

  console.log("🪔 Starting Kurtosis network...");

  if (await checkKurtosisRunning()) {
    console.log("ℹ️  Kurtosis network is already running. Quitting...");
    return;
  }

  await $`docker system prune -f`.nothrow();
  await $`kurtosis clean`;

  // TODO: if mac, manually pull the images for network = linux/amd64 since blockscout doesnt have arm ones
  await $`docker pull ghcr.io/blockscout/smart-contract-verifier:latest --platform linux/amd64`;

  const { stderr, stdout, exitCode } =
    await $`kurtosis run github.com/ethpandaops/ethereum-package --args-file configs/minimal.yaml --enclave datahaven-ethereum`.nothrow();

  if (exitCode !== 0) {
    console.error(stderr.toString());
    throw Error("❌ Kurtosis network has failed to start properly.");
  }

  // Get service information from Docker instead of parsing stdout
  console.log("🔍 Detecting Docker container ports...");
  const services = await getServicesFromDocker();

  console.log("================================================");

  const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Anvil test acc1
  const networkRpcUrl = services.find((s) => s.service === "reth-1-rpc")?.url;
  invariant(networkRpcUrl, "❌ Network RPC URL not found");
  await sendTxn(privateKey, networkRpcUrl);

  // Deploy all the contracts
  console.log("🛳️ Deploying contracts...");
  const { exitCode: buildExitCode, stderr: buildStderr } = await $`forge build`
    .cwd("../contracts")
    .nothrow();

  if (buildExitCode !== 0) {
    console.error(buildStderr.toString());
    throw Error("❌ Contracts have failed to build properly.");
  }

  const { stdout: forgePath } = await $`which forge`.quiet();
  const forgeExecutable = forgePath.toString().trim();
  console.log(`Using forge at: ${forgeExecutable}`);

  const blockscoutBackendUrl = services.find((s) => s.service === "blockscout-backend")?.url;
  invariant(blockscoutBackendUrl, "❌ Blockscout backend URL not found");

  const deployCommand = `${forgeExecutable} script script/deploy/DeployLocal.s.sol --rpc-url ${networkRpcUrl} --color never -vv --no-rpc-rate-limit --non-interactive --verify --verifier blockscout --verifier-url ${blockscoutBackendUrl}/api/ --broadcast`;
  console.log(`Running command: ${deployCommand}`);

  const { exitCode: deployExitCode, stderr: deployStderr } = await $`sh -c ${deployCommand}`
    .cwd("../contracts")
    .nothrow();

  if (deployExitCode !== 0) {
    console.error(deployStderr.toString());
    throw Error("❌ Contracts have failed to deploy properly.");
  }

  console.log("================================================");

  console.table([
    ...services,
    { service: "blockscout", port: "3000", url: "http://127.0.0.1:3000" },
    {
      service: "kurtosis-web",
      port: "9711",
      url: "http://127.0.0.1:9711"
    }
  ]);

  console.log("================================================");

  const timeEnd = performance.now();

  console.log(
    `💚 Kurtosis network has started successfully in ${((timeEnd - timeStart) / (1000 * 60)).toFixed(1)} minutes`
  );
}

const checkKurtosisInstalled = async (): Promise<boolean> => {
  const { exitCode } = await $`kurtosis version`.nothrow().quiet();
  return exitCode === 0;
};

const checkKurtosisRunning = async (): Promise<boolean> => {
  const text = await $`kurtosis enclave ls | grep RUNNING`.text();
  return text.length > 0;
};

const checkDockerRunning = async (): Promise<boolean> => {
  const { exitCode } = await $`docker system info`.nothrow();
  return exitCode === 0;
};

const checkForgeInstalled = async (): Promise<boolean> => {
  const { exitCode } = await $`forge --version`.nothrow();
  return exitCode === 0;
};

main();

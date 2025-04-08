import { $ } from "bun";
import invariant from "tiny-invariant";
import sendTxn from "./send-txn";

async function main() {
  const timeStart = performance.now();
  if (!(await checkKurtosisInstalled())) {
    console.error("Kurtosis CLI is required to be installed: https://docs.kurtosis.com/install");
    invariant(false, "❌ Kurtosis CLI application not found.");
  }

  if (!(await checkDockerRunning())) {
    console.error("Is Docker Running? Unable to make connection to docker daemon");
    invariant(false, "❌ Error connecting to Docker");
  }
  // TODO: Check that forge is installed
  // TODO: if mac, manually pull the images for network = linux/amd64 since blockscout doesnt have arm ones

  console.log("🪔 Starting Kurtosis network...");

  if (await checkKurtosisRunning()) {
    console.log("ℹ️  Kurtosis network is already running. Quitting...");
    return;
  }

  // This is to clear any previous port bindings on local machine
  await $`docker system prune -f`.nothrow();
  await $`kurtosis clean`;

  const { stderr, stdout, exitCode } =
    await $`kurtosis run github.com/ethpandaops/ethereum-package --args-file configs/minimal.yaml --enclave datahaven-ethereum`.nothrow();

  if (exitCode !== 0) {
    console.error(stderr.toString());
    invariant(false, "❌ Kurtosis network has failed to start properly.");
  }

  const userServices = stdout
    .toString()
    .split(
      "========================================== User Services =========================================="
    )[1];

  invariant(userServices, "❌ User services not found in Kurtosis output");

  const serviceDefinitions = [
    {
      name: "reth-1-rpc",
      serviceName: "el-1-reth-lighthouse",
      portType: "rpc:"
    },
    {
      name: "reth-2-rpc",
      serviceName: "el-2-reth-lighthouse",
      portType: "rpc:"
    },
    {
      name: "blockscout-backend",
      serviceName: "blockscout",
      portType: "http:"
    },
    { name: "dora", serviceName: "dora", portType: "http:" }
  ];

  const services = serviceDefinitions.map(({ name, serviceName, portType }) => {
    const line = extractServiceLine(userServices, serviceName, portType);
    const port = extractPortFromLine(line);
    return {
      service: name,
      port,
      url: port !== "Not found" ? `http://127.0.0.1:${port}` : "N/A"
    };
  });

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
    invariant(false, "❌ Contracts have failed to build properly.");
  }

  const { stdout: forgePath } = await $`which forge`.quiet();
  const forgeExecutable = forgePath.toString().trim();
  console.log(`Using forge at: ${forgeExecutable}`);

  const deployCommand = `${forgeExecutable} script script/deploy/Deploy.s.sol --rpc-url ${services.find((s) => s.service === "reth-1-rpc")?.url} --color never -vv --no-rpc-rate-limit --non-interactive --verify --verifier blockscout --verifier-url ${services.find((s) => s.service === "blockscout-backend")?.url}/api/ --broadcast`;
  console.log(`Running command: ${deployCommand}`);

  const { exitCode: deployExitCode, stderr: deployStderr } = await $`sh -c ${deployCommand}`
    .cwd("../contracts")
    .nothrow();

  if (deployExitCode !== 0) {
    console.error(deployStderr.toString());
    invariant(false, "❌ Contracts have failed to deploy properly.");
  }

  console.log("================================================");

  console.table([
    ...services,
    { service: "blockscout", port: "3000", url: "http://127.0.0.1:3000" },
    {
      service: "kurtosis-web",
      port: "9711",
      url: "http://127.0.0.1:9711/enclaves"
    }
  ]);

  console.log("================================================");

  const timeEnd = performance.now();

  console.log(
    `💚 Kurtosis network has started successfully in ${((timeEnd - timeStart) / (1000 * 60)).toFixed(1)} minutes`
  );
}

const extractServiceLine = (output: string, serviceName: string, portType: string): string => {
  const lines = output.split("\n");

  for (const line of lines) {
    if (
      line.includes(serviceName) &&
      line.includes(portType) &&
      !(portType === "rpc:" && line.includes("engine-rpc:"))
    ) {
      return line;
    }
  }

  const serviceLineIndex = lines.findIndex((line) => line.includes(serviceName));
  if (serviceLineIndex >= 0) {
    for (let i = serviceLineIndex; i < Math.min(serviceLineIndex + 10, lines.length); i++) {
      if (
        lines[i].includes(portType) &&
        !(portType === "rpc:" && lines[i].includes("engine-rpc:"))
      ) {
        return lines[i];
      }
    }
  }

  return "";
};

const extractPortFromLine = (line: string): string => {
  if (!line) return "Not found";

  const portMatch = line.match(/127\.0\.0\.1:(\d+)/);
  return portMatch?.[1] || "Not found";
};

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
main();

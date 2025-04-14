import { $ } from "bun";
import invariant from "tiny-invariant";
import { getServicesFromDocker, logger, printDivider, printHeader, printProgress } from "utils";
import sendTxn from "./send-txn";
import readline from "node:readline";
import chalk from "chalk";

interface ScriptOptions {
  verified: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    verified: args.includes("--verified")
  };

  logger.info(`Running with options: ${options.verified ? "verified" : "unverified"}`);

  const timeStart = performance.now();

  // Progress indicator
  printHeader("Environment Checks");

  await checkDependencies();

  printProgress(30);

  // Start Kurtosis network
  printHeader("Starting Kurtosis Network");

  if (await checkKurtosisRunning()) {
    logger.info("ℹ️  Kurtosis network is already running.");

    // Ask if the user wants to clean and redeploy
    const shouldRedeploy = await promptWithTimeout(
      "Do you want to clean and redeploy the Kurtosis enclave?",
      true,
      5
    );

    if (!shouldRedeploy) {
      logger.info("Keeping existing Kurtosis enclave. Exiting...");
      return;
    }

    logger.info("Proceeding to clean and redeploy the Kurtosis enclave...");
  }

  // Clean up Docker and Kurtosis
  logger.info("🧹 Cleaning up Docker and Kurtosis environments...");
  logger.debug(await $`kurtosis clean`.text());
  logger.debug(await $`docker system prune -f`.nothrow().text());

  // Pull necessary Docker images
  if (process.platform === "darwin") {
    logger.debug("Detected macOS, pulling container images with linux/amd64 platform...");
    logger.debug(
      await $`docker pull ghcr.io/blockscout/smart-contract-verifier:latest --platform linux/amd64`.text()
    );
  }

  // Run Kurtosis
  logger.info("🚀 Starting Kurtosis enclave...");
  const { stderr, stdout, exitCode } =
    await $`kurtosis run github.com/Moonsong-Labs/ethereum-package --args-file configs/minimal.yaml --enclave datahaven-ethereum`
      .nothrow()
      .quiet();

  if (exitCode !== 0) {
    logger.error(stderr.toString());
    throw Error("❌ Kurtosis network has failed to start properly.");
  }
  logger.debug(stdout.toString());

  printProgress(70);

  // Get service information from Docker
  logger.info("🔍 Detecting Docker container ports...");
  const services = await getServicesFromDocker();

  printDivider();

  // Send test transaction
  printHeader("Setting Up Blockchain");
  const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Anvil test acc1
  const networkRpcUrl = services.find((s) => s.service === "reth-1-rpc")?.url;
  invariant(networkRpcUrl, "❌ Network RPC URL not found");

  logger.info("💸 Sending test transaction...");
  await sendTxn(privateKey, networkRpcUrl);

  printProgress(90);

  printDivider();

  // Display service information in a clean table
  printHeader("Service Endpoints");

  console.table(
    services
      .filter((s) => ["reth-1-rpc", "reth-2-rpc", "blockscout-backend", "dora"].includes(s.service))
      .concat([
        { service: "blockscout", port: "3000", url: "http://127.0.0.1:3000" },
        { service: "kurtosis-web", port: "9711", url: "http://127.0.0.1:9711" }
      ])
  );

  printDivider();

  // Show completion information
  const timeEnd = performance.now();
  const minutes = ((timeEnd - timeStart) / (1000 * 60)).toFixed(1);

  printProgress(100);

  logger.success(`Kurtosis network started successfully in ${minutes} minutes`);

  printDivider();

  // Ask if the user wants to deploy smart contracts
  const shouldDeployContracts = await promptWithTimeout(
    "Do you want to deploy the smart contracts?",
    true,
    20
  );

  if (!shouldDeployContracts) {
    logger.info("Skipping contract deployment. Done!");
    return;
  }

  // Deploy contracts
  printHeader("Deploying Smart Contracts");
  logger.info("🛳️ Building contracts...");
  const {
    exitCode: buildExitCode,
    stderr: buildStderr,
    stdout: buildStdout
  } = await $`forge build`.cwd("../contracts").nothrow().quiet();

  if (buildExitCode !== 0) {
    logger.error(buildStderr.toString());
    throw Error("❌ Contracts have failed to build properly.");
  }
  logger.debug(buildStdout.toString());

  const { stdout: forgePath } = await $`which forge`.quiet();
  const forgeExecutable = forgePath.toString().trim();

  const blockscoutBackendUrl = services.find((s) => s.service === "blockscout-backend")?.url;
  invariant(blockscoutBackendUrl, "❌ Blockscout backend URL not found");

  let deployCommand = `${forgeExecutable} script script/deploy/DeployLocal.s.sol --rpc-url ${networkRpcUrl} --color never -vv --no-rpc-rate-limit --non-interactive --broadcast`;

  if (options.verified) {
    deployCommand += ` --verify --verifier blockscout --verifier-url ${blockscoutBackendUrl}/api/ --delay 0`;
    logger.info("🔍 Contract verification enabled");
  }

  logger.info("⏳ Deploying contracts (this might take a few minutes)...");

  const { exitCode: deployExitCode, stderr: deployStderr } = await $`sh -c ${deployCommand}`
    .cwd("../contracts")
    .nothrow();

  if (deployExitCode !== 0) {
    logger.error(deployStderr.toString());
    throw Error("❌ Contracts have failed to deploy properly.");
  }

  logger.success("Contracts deployed successfully");
}

// Helper function to check all dependencies at once
const checkDependencies = async (): Promise<void> => {
  if (!(await checkKurtosisInstalled())) {
    logger.error("Kurtosis CLI is required to be installed: https://docs.kurtosis.com/install");
    throw Error("❌ Kurtosis CLI application not found.");
  }

  logger.success("Kurtosis CLI found");

  if (!(await checkDockerRunning())) {
    logger.error("Is Docker Running? Unable to make connection to docker daemon");
    throw Error("❌ Error connecting to Docker");
  }

  logger.success("Docker is running");

  if (!(await checkForgeInstalled())) {
    logger.error("Is foundry installed? https://book.getfoundry.sh/getting-started/installation");
    throw Error("❌ forge binary not found in PATH");
  }

  logger.success("Forge is installed");
};

const checkKurtosisInstalled = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`kurtosis version`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.error(stderr.toString());
    return false;
  }
  logger.debug(stdout.toString());
  return true;
};

const checkKurtosisRunning = async (): Promise<boolean> => {
  const text = await $`kurtosis enclave ls | grep "datahaven-ethereum" | grep RUNNING`.text();
  return text.length > 0;
};

const checkDockerRunning = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`docker system info`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.error(stderr.toString());
    return false;
  }
  logger.debug(stdout.toString());
  return true;
};

const checkForgeInstalled = async (): Promise<boolean> => {
  const { exitCode, stderr, stdout } = await $`forge --version`.nothrow().quiet();
  if (exitCode !== 0) {
    logger.error(stderr.toString());
    return false;
  }
  logger.debug(stdout.toString());
  return true;
};

// Helper function to create an interactive prompt with timeout
const promptWithTimeout = async (
  question: string,
  defaultValue: boolean,
  timeoutSeconds: number
): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise<boolean>((resolve) => {
    const defaultText = defaultValue ? "Y/n" : "y/N";

    // Create a visually striking prompt
    const border = chalk.yellow("=".repeat(question.length + 40));
    console.log("\n");
    console.log(border);
    console.log(chalk.yellow("▶ ") + chalk.bold.cyan(question));
    console.log(
      chalk.magenta(
        `⏱  Will default to ${chalk.bold(defaultValue ? "YES" : "NO")} in ${chalk.bold(timeoutSeconds)} seconds`
      )
    );
    console.log(border);
    const fullQuestion = chalk.green(`\n➤ Please enter your choice [${chalk.bold(defaultText)}]: `);

    const timer = setTimeout(() => {
      console.log(
        `\n${chalk.yellow("⏱")} ${chalk.bold("Timeout reached, using default:")} ${chalk.green(defaultValue ? "YES" : "NO")}\n`
      );
      rl.close();
      resolve(defaultValue);
    }, timeoutSeconds * 1000);

    rl.question(fullQuestion, (answer) => {
      clearTimeout(timer);
      rl.close();

      if (answer.trim() === "") {
        resolve(defaultValue);
      } else {
        const normalizedAnswer = answer.trim().toLowerCase();
        console.log("");
        resolve(normalizedAnswer === "y" || normalizedAnswer === "yes");
      }
    });
  });
};

main();

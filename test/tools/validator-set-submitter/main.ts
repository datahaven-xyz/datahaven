import { Command } from "@commander-js/extra-typings";
import { logger } from "utils/logger";
import { privateKeyToAccount } from "viem/accounts";
import { getOnChainSubmitter } from "./chain";
import { loadConfig } from "./config";
import { createClients, startSubmitter } from "./submitter";

const program = new Command()
  .name("validator-set-submitter")
  .description("Automatically submits validator-set updates from Ethereum to DataHaven each era");

program
  .command("run")
  .description("Start the submitter daemon")
  .option(
    "--config <path>",
    "Path to YAML config file",
    "./tools/validator-set-submitter/config.yml"
  )
  .option(
    "--submitter-private-key <key>",
    "Override submitter private key (or use SUBMITTER_PRIVATE_KEY env var)"
  )
  .option("--dry-run", "Log what would be submitted without sending transactions", false)
  .action(async (opts) => {
    const config = await loadConfig(opts.config, {
      dryRun: opts.dryRun,
      submitterPrivateKey: opts.submitterPrivateKey
    });

    logger.info("Validator Set Submitter starting...");
    logger.info(`Ethereum RPC: ${config.ethereumRpcUrl}`);
    logger.info(`DataHaven WS: ${config.datahavenWsUrl}`);
    logger.info(`ServiceManager: ${config.serviceManagerAddress}`);
    logger.info(`Dry run: ${config.dryRun}`);

    const clients = createClients(config);

    // Startup self-checks
    try {
      const blockNumber = await clients.publicClient.getBlockNumber();
      logger.info(`Ethereum connected — block #${blockNumber}`);
    } catch (err) {
      logger.error(`Cannot connect to Ethereum RPC: ${err}`);
      process.exit(1);
    }

    try {
      const header = await clients.papiClient.getBlockHeader();
      logger.info(`DataHaven connected — block #${header.number}`);
    } catch (err) {
      logger.error(`Cannot connect to DataHaven WS: ${err}`);
      process.exit(1);
    }

    // Verify our account is authorized on-chain
    try {
      const account = privateKeyToAccount(config.submitterPrivateKey);
      const onChainSubmitter = await getOnChainSubmitter(
        clients.publicClient,
        config.serviceManagerAddress
      );
      if (onChainSubmitter.toLowerCase() !== account.address.toLowerCase()) {
        logger.error(
          `Account ${account.address} is not the authorized submitter (on-chain: ${onChainSubmitter})`
        );
        process.exit(1);
      }
      logger.info(`Authorized submitter verified: ${account.address}`);
    } catch (err) {
      logger.error(`Failed to verify submitter authorization: ${err}`);
      process.exit(1);
    }

    // Graceful shutdown
    const ac = new AbortController();
    const shutdown = () => {
      logger.info("Shutdown signal received, stopping...");
      ac.abort();
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    try {
      await startSubmitter(clients, config, ac.signal);
    } finally {
      clients.papiClient.destroy();
      logger.info("Submitter stopped, PAPI client destroyed");
    }
  });

program.parse();

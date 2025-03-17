// Script to submit a force_checkpoint extrinsic to the flamingo runtime
const { ApiPromise, WsProvider, Keyring } = require("@polkadot/api");
const { cryptoWaitReady } = require("@polkadot/util-crypto");
const fs = require("fs");
const path = require("path");

// Configuration
const NODE_URL = "ws://127.0.0.1:30444"; // Default Substrate node WebSocket endpoint

async function main() {
  // Check if checkpoint file path is provided as an argument
  if (process.argv.length < 3) {
    console.error("Usage: node submit-checkpoint.js <path-to-checkpoint-json-file>");
    console.error("Example: node submit-checkpoint.js ./path/to/checkpoint.json");
    process.exit(1);
  }

  const checkpointFilePath = process.argv[2];

  // Wait for the crypto libraries to be ready
  await cryptoWaitReady();

  // Create a keyring instance (for signing transactions)
  const keyring = new Keyring({ type: "sr25519" });

  // Add the sudo account (//Alice is the default development account with sudo access)
  const sudoAccount = keyring.addFromUri("//Alice");
  console.log(`Using account: ${sudoAccount.address}`);

  // Connect to the node
  console.log(`Connecting to node at ${NODE_URL}...`);
  const provider = new WsProvider(NODE_URL);
  const api = await ApiPromise.create({ provider });

  // Get the chain information
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
  ]);
  console.log(`Connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

  try {
    // Read and parse the checkpoint data from the file
    const resolvedFilePath = path.resolve(checkpointFilePath);
    console.log(`Reading checkpoint data from file: ${resolvedFilePath}`);

    if (!fs.existsSync(resolvedFilePath)) {
      console.error(`Error: File not found: ${resolvedFilePath}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(resolvedFilePath, 'utf8');
    let checkpointData;

    try {
      checkpointData = JSON.parse(fileContent);
      console.log("Successfully parsed checkpoint data from file");
    } catch (parseError) {
      console.error(`Error parsing JSON file: ${parseError.message}`);
      process.exit(1);
    }

    // Log the checkpoint data for debugging
    console.log("Checkpoint data:", JSON.stringify(checkpointData, null, 2));

    // Create the extrinsic for force_checkpoint
    // We need to use sudo since force_checkpoint requires root privileges
    console.log("Creating extrinsic...");
    const extrinsic = api.tx.sudo.sudo(
      api.tx.ethereumBeaconClient.forceCheckpoint(checkpointData),
    );

    // Sign and send the transaction
    console.log("Submitting extrinsic...");
    const hash = await extrinsic.signAndSend(sudoAccount);

    console.log(`Extrinsic submitted with hash: ${hash.toHex()}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Disconnect from the API
    await api.disconnect();
    console.log("Disconnected from the node");
  }
}

// Run the main function
main()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error in main function:", error);
    process.exit(1);
  });

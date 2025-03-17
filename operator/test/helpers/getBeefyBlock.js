const { ethers } = require('ethers');

async function getBeefyBlock(contractAddress, providerUrl) {
    // Connect to the network
    const provider = new ethers.JsonRpcProvider(providerUrl);

    // BeefyClient ABI - we only need the latestBeefyBlock function
    const abi = [
        "function latestBeefyBlock() view returns (uint64)",
        "function latestMMRRoot() view returns (bytes32)"
    ];

    // Create contract instance
    const beefyClient = new ethers.Contract(contractAddress, abi, provider);

    try {
        // Get the latest beefy block
        const blockNumber = await beefyClient.latestBeefyBlock();
        const mmrRoot = await beefyClient.latestMMRRoot();

        console.log('Latest Beefy Block Number:', blockNumber.toString());
        console.log('Latest MMR Root:', mmrRoot);

        return {
            blockNumber: blockNumber,
            mmrRoot: mmrRoot
        };
    } catch (error) {
        console.error('Error fetching beefy block:', error);
        throw error;
    }
}

// If this file is being run directly (not imported)
if (require.main === module) {
    // Get command line arguments
    const args = process.argv.slice(2);
    const contractAddress = args[0];
    const providerUrl = args[1];

    if (!contractAddress || !providerUrl) {
        console.error('Usage: node beefyBlockClient.js <contract-address> <provider-url>');
        console.error('Example: node beefyBlockClient.js 0x1234... http://localhost:8545');
        process.exit(1);
    }

    // Run the script
    getBeefyBlock(contractAddress, providerUrl)
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
} else {
    // Export for use in other files
    module.exports = { getBeefyBlock };
} 
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

module.exports = { getBeefyBlock }; 
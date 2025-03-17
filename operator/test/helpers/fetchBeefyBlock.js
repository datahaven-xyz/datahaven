#!/usr/bin/env node
const { getBeefyBlock } = require('./getBeefyBlock');

// Get command line arguments
const args = process.argv.slice(2);
const contractAddress = args[0];
const providerUrl = args[1];

if (!contractAddress || !providerUrl) {
    console.error('Usage: node fetchBeefyBlock.js <contract-address> <provider-url>');
    console.error('Example: node fetchBeefyBlock.js 0x1234... http://localhost:8545');
    process.exit(1);
}

// Run the script
getBeefyBlock(contractAddress, providerUrl)
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    }); 
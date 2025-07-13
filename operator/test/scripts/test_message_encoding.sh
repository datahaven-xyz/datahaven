#!/bin/bash

# This script is used to test the message encoding for the snowbridge message processor.
# You can pass the -v flag to run the test with a more verbose output.

set -e

echo "🚀 Starting message encoding test..."

cd ../../../
echo "📁 Changed to contracts directory"

cd contracts
echo "🔨 Compiling contracts with forge..."
forge build --force
echo "✅ Contracts compiled successfully"

mkdir -p ../operator/primitives/bridge/test_data
echo "📂 Create test_data directory if doesn't exist"

echo "🔧 Running forge test to generate ReceiveValidators encoded message..."
forge test --match-test testEncodeReceiveValidatorsMessage -vvv | grep -A 10 "Logs:" | grep -E "0x[a-fA-F0-9]+" | tail -n 1 | sed 's/0x//' | xxd -r -p > ../operator/primitives/bridge/test_data/receive_validators_message.bin
echo "💾 Generated receive_validators_message.bin file"

cd ../operator
echo "📁 Changed to operator directory"

echo "🧪 Running cargo test for snowbridge message processor..."
cargo test --test snowbridge_message_processor ${1:+-v -- --nocapture}
echo "✅ Cargo test completed successfully!" 
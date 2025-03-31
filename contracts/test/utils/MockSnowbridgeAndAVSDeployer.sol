// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {BeefyClient} from "snowbridge/src/BeefyClient.sol";
import {Gateway} from "snowbridge/src/Gateway.sol";
import {GatewayProxy} from "snowbridge/src/GatewayProxy.sol";
import {AgentExecutor} from "snowbridge/src/AgentExecutor.sol";
import {Agent} from "snowbridge/src/Agent.sol";
import {Initializer} from "snowbridge/src/Initializer.sol";
import {OperatingMode} from "snowbridge/src/types/Common.sol";
import {ud60x18} from "snowbridge/lib/prb-math/src/UD60x18.sol";

import {MockAVSDeployer} from "./MockAVSDeployer.sol";

import "forge-std/Test.sol";

contract MockSnowbridgeAndAVSDeployer is MockAVSDeployer {
    // Snowbridge contracts
    BeefyClient public beefyClient;
    GatewayProxy public gateway;
    Gateway public gatewayImplementation;
    AgentExecutor public agentExecutor;
    Agent public rewardsAgent;

    // Snowbridge contracts params
    bytes32[] public initialValidators = [
        keccak256(abi.encodePacked("validator1")),
        keccak256(abi.encodePacked("validator2")),
        keccak256(abi.encodePacked("validator3"))
    ];
    bytes32[] public nextValidators = [
        keccak256(abi.encodePacked("validator4")),
        keccak256(abi.encodePacked("validator5")),
        keccak256(abi.encodePacked("validator6"))
    ];
    // In reality this should be set to MAX_SEED_LOOKAHEAD (4 epochs = 128 blocks/slots)
    // https://eth2book.info/capella/part3/config/preset/#time-parameters
    uint256 public constant RANDAO_COMMIT_DELAY = 4;
    // In reality this is set to 24 blocks https://etherscan.io/address/0x6eD05bAa904df3DE117EcFa638d4CB84e1B8A00C#readContract#F10
    uint256 public constant RANDAO_COMMIT_EXPIRATION = 24;
    // In reality this is set to 17 https://etherscan.io/address/0x6eD05bAa904df3DE117EcFa638d4CB84e1B8A00C#readContract#F7
    uint256 public constant MIN_NUM_REQUIRED_SIGNATURES = 2;
    uint64 public constant START_BLOCK = 1;

    function _deployMockAllContracts() internal {
        _deployMockSnowbridge();
        _deployMockEigenLayerAndAVS();
        _connectSnowbridgeToAVS();
    }

    function _deployMockSnowbridge() internal {
        BeefyClient.ValidatorSet memory validatorSet = _buildValidatorSet(0, initialValidators);
        BeefyClient.ValidatorSet memory nextValidatorSet = _buildValidatorSet(1, nextValidators);

        cheats.prank(regularDeployer);
        beefyClient = new BeefyClient(
            RANDAO_COMMIT_DELAY,
            RANDAO_COMMIT_EXPIRATION,
            MIN_NUM_REQUIRED_SIGNATURES,
            START_BLOCK,
            validatorSet,
            nextValidatorSet
        );

        console.log("BeefyClient deployed at", address(beefyClient));

        cheats.prank(regularDeployer);
        agentExecutor = new AgentExecutor();

        console.log("AgentExecutor deployed at", address(agentExecutor));

        cheats.prank(regularDeployer);
        gatewayImplementation = new Gateway(address(beefyClient), address(agentExecutor));

        console.log("GatewayImplementation deployed at", address(gatewayImplementation));

        OperatingMode defaultOperatingMode = OperatingMode.Normal;

        Initializer.Config memory config = Initializer.Config({
            mode: defaultOperatingMode,
            deliveryCost: 1, // This is for v1, we don't really care about this
            registerTokenFee: 1, // This is for v1, we don't really care about this
            assetHubCreateAssetFee: 1, // This is for v1, we don't really care about this
            assetHubReserveTransferFee: 1, // This is for v1, we don't really care about this
            exchangeRate: ud60x18(1), // This is for v1, we don't really care about this
            multiplier: ud60x18(1), // This is for v1, we don't really care about this
            foreignTokenDecimals: 18, // This is for v1, we don't really care about this
            maxDestinationFee: 1 // This is for v1, we don't really care about this
        });

        cheats.prank(regularDeployer);
        gateway = new GatewayProxy(address(gatewayImplementation), abi.encode(config));

        console.log("Gateway deployed at", address(gateway));
    }

    function _connectSnowbridgeToAVS() internal {}

    function _buildValidatorSet(
        uint128 id,
        bytes32[] memory validators
    ) internal pure returns (BeefyClient.ValidatorSet memory) {
        // Calculate the merkle root from the validators array
        bytes32 merkleRoot = _calculateMerkleRoot(validators);

        // Create and return the validator set with the calculated merkle root
        return
            BeefyClient.ValidatorSet({id: id, length: uint128(validators.length), root: merkleRoot});
    }

    function _calculateMerkleRoot(
        bytes32[] memory validators
    ) internal pure returns (bytes32) {
        // If there are no validators, return empty hash
        if (validators.length == 0) {
            return bytes32(0);
        }

        // If there's only one validator, its hash is the root
        if (validators.length == 1) {
            return validators[0];
        }

        // Create a new array to hold the current layer's hashes
        bytes32[] memory currentLayer = new bytes32[](validators.length);
        for (uint256 i = 0; i < validators.length; i++) {
            currentLayer[i] = validators[i];
        }

        // Iterate until we reach the root
        while (currentLayer.length > 1) {
            // Calculate size of the next layer
            uint256 nextLayerSize = currentLayer.length / 2;
            // If there's an odd number of elements, add one more slot for the unpaired element
            if (currentLayer.length % 2 == 1) {
                nextLayerSize += 1;
            }

            bytes32[] memory nextLayer = new bytes32[](nextLayerSize);

            // Process pairs and build the next layer
            uint256 nextIndex = 0;
            for (uint256 i = 0; i < currentLayer.length; i += 2) {
                // If this is the last element and we have an odd number, propagate it to the next layer
                if (i + 1 >= currentLayer.length) {
                    nextLayer[nextIndex] = currentLayer[i];
                    nextIndex++;
                } else {
                    // Hash the pair and add to next layer
                    nextLayer[nextIndex] = _hashPair(currentLayer[i], currentLayer[i + 1]);
                    nextIndex++;
                }
            }

            currentLayer = nextLayer;
        }

        // Return the root (the only element left in currentLayer)
        return currentLayer[0];
    }

    function _hashPair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a < b ? _efficientHash(a, b) : _efficientHash(b, a);
    }

    function _efficientHash(bytes32 a, bytes32 b) private pure returns (bytes32 value) {
        assembly {
            mstore(0x00, a)
            mstore(0x20, b)
            value := keccak256(0x00, 0x40)
        }
    }
}

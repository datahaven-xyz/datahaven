// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Gateway} from "snowbridge/src/Gateway.sol";
import {IGatewayV2} from "snowbridge/src/v2/IGateway.sol";
import {GatewayProxy} from "snowbridge/src/GatewayProxy.sol";
import {AgentExecutor} from "snowbridge/src/AgentExecutor.sol";
import {Agent} from "snowbridge/src/Agent.sol";
import {Initializer} from "snowbridge/src/Initializer.sol";
import {OperatingMode} from "snowbridge/src/types/Common.sol";
import {ud60x18} from "snowbridge/lib/prb-math/src/UD60x18.sol";

import {MockAVSDeployer} from "./MockAVSDeployer.sol";
import {BeefyClientMock} from "../mocks/BeefyClientMock.sol";

import "forge-std/Test.sol";

contract MockSnowbridgeAndAVSDeployer is MockAVSDeployer {
    // Snowbridge contracts
    BeefyClientMock public beefyClient;
    IGatewayV2 public gateway;
    Gateway public gatewayImplementation;
    AgentExecutor public agentExecutor;
    Agent public rewardsAgent;
    Agent public wrongAgent;

    // Snowbridge contracts params
    bytes32[] public initialValidators = [
        keccak256(abi.encodePacked("validator1")),
        keccak256(abi.encodePacked("validator2")),
        keccak256(abi.encodePacked("validator3")),
        keccak256(abi.encodePacked("validator4")),
        keccak256(abi.encodePacked("validator5")),
        keccak256(abi.encodePacked("validator6")),
        keccak256(abi.encodePacked("validator7")),
        keccak256(abi.encodePacked("validator8")),
        keccak256(abi.encodePacked("validator9")),
        keccak256(abi.encodePacked("validator10"))
    ];
    bytes32[] public nextValidators = [
        keccak256(abi.encodePacked("validator11")),
        keccak256(abi.encodePacked("validator12")),
        keccak256(abi.encodePacked("validator13")),
        keccak256(abi.encodePacked("validator14")),
        keccak256(abi.encodePacked("validator15")),
        keccak256(abi.encodePacked("validator16")),
        keccak256(abi.encodePacked("validator17")),
        keccak256(abi.encodePacked("validator18")),
        keccak256(abi.encodePacked("validator19")),
        keccak256(abi.encodePacked("validator20"))
    ];
    // In reality this should be set to MAX_SEED_LOOKAHEAD (4 epochs = 128 blocks/slots)
    // https://eth2book.info/capella/part3/config/preset/#time-parameters
    uint256 public constant RANDAO_COMMIT_DELAY = 4;
    // In reality this is set to 24 blocks https://etherscan.io/address/0x6eD05bAa904df3DE117EcFa638d4CB84e1B8A00C#readContract#F10
    uint256 public constant RANDAO_COMMIT_EXPIRATION = 24;
    // In reality this is set to 17 https://etherscan.io/address/0x6eD05bAa904df3DE117EcFa638d4CB84e1B8A00C#readContract#F7
    uint256 public constant MIN_NUM_REQUIRED_SIGNATURES = 2;
    uint64 public constant START_BLOCK = 1;
    bytes32 public constant REWARDS_MESSAGE_ORIGIN = bytes32(0);
    bytes32 public constant WRONG_MESSAGE_ORIGIN = bytes32("wrong origin");

    function _deployMockAllContracts() internal {
        _deployMockSnowbridge();
        _deployMockEigenLayerAndAVS();
        _connectSnowbridgeToAVS();
    }

    function _deployMockSnowbridge() internal {
        BeefyClientMock.ValidatorSet memory validatorSet = _buildValidatorSet(0, initialValidators);
        BeefyClientMock.ValidatorSet memory nextValidatorSet = _buildValidatorSet(1, nextValidators);

        cheats.prank(regularDeployer);
        beefyClient = new BeefyClientMock(
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
        gateway = IGatewayV2(
            address(new GatewayProxy(address(gatewayImplementation), abi.encode(config)))
        );

        console.log("Gateway deployed at", address(gateway));
    }

    function _connectSnowbridgeToAVS() internal {
        cheats.prank(regularDeployer);
        gateway.v2_createAgent(REWARDS_MESSAGE_ORIGIN);

        // Get the agent address after creation
        address payable agentAddress = payable(gateway.agentOf(REWARDS_MESSAGE_ORIGIN));
        rewardsAgent = Agent(agentAddress);

        console.log("Rewards agent deployed at", address(rewardsAgent));

        cheats.prank(avsOwner);
        serviceManager.setRewardsAgent(0, address(rewardsAgent));

        console.log("Rewards agent set for operator set 0");

        cheats.prank(regularDeployer);
        gateway.v2_createAgent(WRONG_MESSAGE_ORIGIN);

        // Get the agent address after creation
        address payable wrongAgentAddress = payable(gateway.agentOf(WRONG_MESSAGE_ORIGIN));
        wrongAgent = Agent(wrongAgentAddress);

        console.log("Wrong agent deployed at", address(wrongAgent));
    }

    function _buildValidatorSet(
        uint128 id,
        bytes32[] memory validators
    ) internal pure returns (BeefyClientMock.ValidatorSet memory) {
        // Calculate the merkle root from the validators array
        bytes32 merkleRoot = _calculateMerkleRoot(validators);

        // Create and return the validator set with the calculated merkle root
        return BeefyClientMock.ValidatorSet({
            id: id,
            length: uint128(validators.length),
            root: merkleRoot
        });
    }

    function _calculateMerkleRoot(
        bytes32[] memory leaves
    ) internal pure returns (bytes32) {
        // If there are no validators, return empty hash
        if (leaves.length == 0) {
            return bytes32(0);
        }

        // If there's only one validator, its hash is the root
        if (leaves.length == 1) {
            return leaves[0];
        }

        // Create a new array to hold the current layer's hashes
        bytes32[] memory currentLayer = new bytes32[](leaves.length);
        for (uint256 i = 0; i < leaves.length; i++) {
            currentLayer[i] = leaves[i];
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

    function _buildMerkleProof(
        bytes32[] memory leaves,
        uint256 leafIndex
    ) internal pure returns (bytes32[] memory) {
        require(leaves.length > 0, "Empty leaves");
        require(leafIndex < leaves.length, "Leaf index out of bounds");

        // For a single leaf, there's no proof needed
        if (leaves.length == 1) {
            return new bytes32[](0);
        }

        // Initialize proof array with maximum possible length
        // The maximum depth of a binary tree with n leaves is log2(n) rounded up
        uint256 maxDepth = 0;
        uint256 layerSize = leaves.length;
        while (layerSize > 1) {
            layerSize = (layerSize + 1) / 2;
            maxDepth++;
        }

        bytes32[] memory proof = new bytes32[](maxDepth);
        uint256 proofIndex = 0;

        // Create a copy of the leaves array
        bytes32[] memory currentLayer = new bytes32[](leaves.length);
        for (uint256 i = 0; i < leaves.length; i++) {
            currentLayer[i] = leaves[i];
        }

        // Track the current position of our target leaf
        uint256 currentPosition = leafIndex;

        // Traverse from leaves to root
        while (currentLayer.length > 1) {
            // Calculate size of the next layer
            uint256 nextLayerSize = currentLayer.length / 2;
            if (currentLayer.length % 2 == 1) {
                nextLayerSize += 1;
            }

            bytes32[] memory nextLayer = new bytes32[](nextLayerSize);

            // Collect the sibling for our proof and build the next layer
            uint256 nextIndex = 0;
            for (uint256 i = 0; i < currentLayer.length; i += 2) {
                if (i + 1 >= currentLayer.length) {
                    // Handle the case of an odd number of elements
                    nextLayer[nextIndex] = currentLayer[i];

                    // If our target is the last unpaired element
                    if (currentPosition == i) {
                        // For odd element at the end with no pair, we don't add anything to the proof here
                        // But we update the position for the next layer
                        currentPosition = nextIndex;
                    }
                } else {
                    // Normal case: pair of elements
                    nextLayer[nextIndex] = _hashPair(currentLayer[i], currentLayer[i + 1]);

                    // If our target is in this pair, add the sibling to the proof
                    if (currentPosition == i) {
                        proof[proofIndex] = currentLayer[i + 1];
                        proofIndex++;
                        currentPosition = nextIndex;
                    } else if (currentPosition == i + 1) {
                        proof[proofIndex] = currentLayer[i];
                        proofIndex++;
                        currentPosition = nextIndex;
                    }
                }
                nextIndex++;
            }

            currentLayer = nextLayer;
        }

        // Resize the proof array to the actual number of elements
        bytes32[] memory finalProof = new bytes32[](proofIndex);
        for (uint256 i = 0; i < proofIndex; i++) {
            finalProof[i] = proof[i];
        }

        return finalProof;
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

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
import {BeefyClient} from "snowbridge/src/BeefyClient.sol";
import {AVSDeployer} from "./AVSDeployer.sol";
import {MerkleUtils} from "../../src/libraries/MerkleUtils.sol";
import {IAllocationManagerTypes} from
    "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";

import "forge-std/Test.sol";

contract SnowbridgeAndAVSDeployer is AVSDeployer {
    // Snowbridge contracts
    BeefyClient public beefyClient;
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

    function _setupValidatorsAsOperators() internal {
        // TODO: Implement the rest
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
    ) internal pure returns (BeefyClient.ValidatorSet memory) {
        // Calculate the merkle root from the validators array using the shared library
        bytes32 merkleRoot = MerkleUtils.calculateMerkleRoot(validators);

        // Create and return the validator set with the calculated merkle root
        return
            BeefyClient.ValidatorSet({id: id, length: uint128(validators.length), root: merkleRoot});
    }

    function _buildMerkleProof(
        bytes32[] memory leaves,
        uint256 leafIndex
    ) internal pure returns (bytes32[] memory) {
        return MerkleUtils.buildMerkleProof(leaves, leafIndex);
    }
}

// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
import {TestUtils} from "./TestUtils.sol";
import {
    IAllocationManagerTypes
} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {ValidatorsUtils} from "../../script/utils/ValidatorsUtils.sol";

import {console} from "forge-std/Test.sol";

contract SnowbridgeAndAVSDeployer is AVSDeployer {
    // Snowbridge contracts
    BeefyClient public beefyClient;
    IGatewayV2 public gateway;
    Gateway public gatewayImplementation;
    AgentExecutor public agentExecutor;
    Agent public rewardsAgent;
    Agent public wrongAgent;

    // The addresses of the validators that are allowed to register to the DataHaven service.
    address[] public validatorsAllowlist = [
        0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, // First pre-funded address in anvil
        0x70997970C51812dc3A010C7d01b50e0d17dc79C8, // Second pre-funded address in anvil
        0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, // Third pre-funded address in anvil
        0x90F79bf6EB2c4f870365E785982E1f101E93b906, // Fourth pre-funded address in anvil
        0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65, // Fifth pre-funded address in anvil
        0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc, // Sixth pre-funded address in anvil
        0x976EA74026E726554dB657fA54763abd0C3a0aa9, // Seventh pre-funded address in anvil
        0x14dC79964da2C08b23698B3D3cc7Ca32193d9955, // Eighth pre-funded address in anvil
        0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f, // Ninth pre-funded address in anvil
        0xa0Ee7A142d267C1f36714E4a8F75612F20a79720 // Tenth pre-funded address in anvil
    ];

    // Snowbridge contracts params
    // The hashes of the initial (current) Validators in the DataHaven solochain.
    bytes32[] public initialValidatorHashes;
    // The hashes of the next Validators in the DataHaven solochain.
    bytes32[] public nextValidatorHashes;
    // In reality this should be set to MAX_SEED_LOOKAHEAD (4 epochs = 128 blocks/slots)
    // https://eth2book.info/capella/part3/config/preset/#time-parameters
    uint256 public constant RANDAO_COMMIT_DELAY = 4;
    // In reality this is set to 24 blocks https://etherscan.io/address/0x6eD05bAa904df3DE117EcFa638d4CB84e1B8A00C#readContract#F10
    uint256 public constant RANDAO_COMMIT_EXPIRATION = 24;
    // In reality this is set to 17 https://etherscan.io/address/0x6eD05bAa904df3DE117EcFa638d4CB84e1B8A00C#readContract#F7
    uint256 public constant MIN_NUM_REQUIRED_SIGNATURES = 2;
    uint64 public constant START_BLOCK = 1;
    bytes32 public constant REWARDS_MESSAGE_ORIGIN = bytes32(0);
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant WRONG_MESSAGE_ORIGIN = bytes32("wrong origin");

    function _deployMockAllContracts() internal {
        _deployMockSnowbridge();
        _deployMockEigenLayerAndAVS();
        _connectSnowbridgeToAVS();
    }

    function _deployMockSnowbridge() internal {
        // Generate validator arrays using the generator functions
        initialValidatorHashes = TestUtils.generateMockValidators(10);
        nextValidatorHashes = TestUtils.generateMockValidators(10, 10);

        BeefyClient.ValidatorSet memory validatorSet =
            ValidatorsUtils._buildValidatorSet(0, initialValidatorHashes);
        BeefyClient.ValidatorSet memory nextValidatorSet =
            ValidatorsUtils._buildValidatorSet(1, nextValidatorHashes);

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

        // Get the agent address after creation.
        address payable agentAddress = payable(gateway.agentOf(REWARDS_MESSAGE_ORIGIN));
        rewardsAgent = Agent(agentAddress);

        console.log("Rewards agent deployed at", address(rewardsAgent));

        cheats.prank(regularDeployer);
        gateway.v2_createAgent(WRONG_MESSAGE_ORIGIN);

        // Get the agent address after creation.
        address payable wrongAgentAddress = payable(gateway.agentOf(WRONG_MESSAGE_ORIGIN));
        wrongAgent = Agent(wrongAgentAddress);

        console.log("Wrong agent deployed at", address(wrongAgent));

        // Set the Snowbridge Gateway address in the DataHaven service.
        cheats.prank(avsOwner);
        serviceManager.setSnowbridgeGateway(address(gateway));
    }

    function setupValidatorsAsOperators() public {
        for (uint256 i = 0; i < validatorsAllowlist.length; i++) {
            console.log("Setting up validator %s as operator", validatorsAllowlist[i]);

            // Whitelist the validator in the DataHaven service.
            cheats.prank(avsOwner);
            serviceManager.addValidatorToAllowlist(validatorsAllowlist[i]);

            cheats.startPrank(validatorsAllowlist[i]);
            for (uint256 j = 0; j < deployedStrategies.length; j++) {
                console.log(
                    "Depositing tokens from validator %s into strategy %s",
                    validatorsAllowlist[i],
                    address(deployedStrategies[j])
                );

                // Give the validator some balance in the strategy's linked token.
                IERC20 linkedToken = deployedStrategies[j].underlyingToken();
                _setERC20Balance(address(linkedToken), validatorsAllowlist[i], 1000 ether);

                // Stake some of the validator's balance as stake for the strategy.
                linkedToken.approve(address(strategyManager), 1000 ether);
                strategyManager.depositIntoStrategy(deployedStrategies[j], linkedToken, 1000 ether);

                console.log(
                    "Staked %s tokens from validator %s into strategy %s",
                    1000 ether,
                    validatorsAllowlist[i],
                    address(deployedStrategies[j])
                );
            }

            // Register the validator as an operator in EigenLayer.
            delegationManager.registerAsOperator(address(0), 0, "");

            // Register the validator as an operator for the DataHaven service.
            uint32[] memory operatorSetIds = new uint32[](1);
            operatorSetIds[0] = serviceManager.VALIDATORS_SET_ID();
            IAllocationManagerTypes.RegisterParams memory registerParams =
                IAllocationManagerTypes.RegisterParams({
                    avs: address(serviceManager),
                    operatorSetIds: operatorSetIds,
                    data: abi.encodePacked(address(uint160(uint256(initialValidatorHashes[i]))))
                });
            allocationManager.registerForOperatorSets(validatorsAllowlist[i], registerParams);
            cheats.stopPrank();

            console.log("Validator %s setup as operator", validatorsAllowlist[i]);
        }
    }
}

// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {EmptyContract} from "eigenlayer-contracts/src/test/mocks/EmptyContract.sol";
import {Config} from "./Config.sol";
import {Script} from "forge-std/Script.sol";
import {TestUtils} from "../../test/utils/TestUtils.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

contract DeployParams is Script, Config {
    using SafeCast for uint256;

    function getSnowbridgeConfig() public view returns (SnowbridgeConfig memory) {
        SnowbridgeConfig memory config;

        string memory configPath = string.concat(
            vm.projectRoot(), "/config/", vm.envOr("NETWORK", string("anvil")), ".json"
        );
        string memory configJson = vm.readFile(configPath);

        config.randaoCommitDelay = vm.parseJsonUint(configJson, ".snowbridge.randaoCommitDelay");
        config.randaoCommitExpiration =
            vm.parseJsonUint(configJson, ".snowbridge.randaoCommitExpiration");
        config.minNumRequiredSignatures =
            vm.parseJsonUint(configJson, ".snowbridge.minNumRequiredSignatures");
        config.startBlock = vm.parseJsonUint(configJson, ".snowbridge.startBlock").toUint64();
        config.rewardsMessageOrigin =
            vm.parseJsonBytes32(configJson, ".snowbridge.rewardsMessageOrigin");

        // Load validators from file or generate placeholder ones in dev mode
        bool isDevMode = keccak256(abi.encodePacked(vm.envOr("DEV_MODE", string("false"))))
            == keccak256(abi.encodePacked("true"));
        if (isDevMode) {
            config.initialValidatorSetId = 0;
            config.initialValidatorHashes = TestUtils.generateMockValidators(10);
            config.nextValidatorSetId = 1;
            config.nextValidatorHashes = TestUtils.generateMockValidators(10);
        } else {
            // Load validator set IDs (default to 0/1 for backwards compatibility)
            try vm.parseJsonUint(configJson, ".snowbridge.initialValidatorSetId") returns (
                uint256 val
            ) {
                config.initialValidatorSetId = uint128(val);
            } catch {
                config.initialValidatorSetId = 0;
            }
            try vm.parseJsonUint(configJson, ".snowbridge.nextValidatorSetId") returns (
                uint256 val
            ) {
                config.nextValidatorSetId = uint128(val);
            } catch {
                config.nextValidatorSetId = config.initialValidatorSetId + 1;
            }

            config.initialValidatorHashes =
                _loadValidatorsFromConfig(configJson, ".snowbridge.initialValidatorHashes");
            config.nextValidatorHashes =
                _loadValidatorsFromConfig(configJson, ".snowbridge.nextValidatorHashes");
        }

        return config;
    }

    function getAVSConfig() public view returns (AVSConfig memory) {
        AVSConfig memory config;

        string memory configPath = string.concat(
            vm.projectRoot(), "/config/", vm.envOr("NETWORK", string("anvil")), ".json"
        );
        string memory configJson = vm.readFile(configPath);

        address avsOwnerOverride = vm.envOr("AVS_OWNER_ADDRESS", address(0));
        if (avsOwnerOverride != address(0)) {
            config.avsOwner = avsOwnerOverride;
        } else {
            config.avsOwner = vm.parseJsonAddress(configJson, ".avs.avsOwner");
        }
        config.rewardsInitiator = vm.parseJsonAddress(configJson, ".avs.rewardsInitiator");
        config.vetoCommitteeMember = vm.parseJsonAddress(configJson, ".avs.vetoCommitteeMember");
        config.vetoWindowBlocks = vm.parseJsonUint(configJson, ".avs.vetoWindowBlocks").toUint32();
        config.validatorsStrategies =
            vm.parseJsonAddressArray(configJson, ".avs.validatorsStrategies");

        return config;
    }

    function getEigenLayerConfig() public view returns (EigenLayerConfig memory) {
        EigenLayerConfig memory config;

        string memory configPath = string.concat(
            vm.projectRoot(), "/config/", vm.envOr("NETWORK", string("anvil")), ".json"
        );
        string memory configJson = vm.readFile(configPath);

        // Load from JSON config or use environment variables as fallback
        config.pauserAddresses = _loadAddressesFromConfig(configJson, ".eigenLayer.pausers");
        config.unpauserAddress = vm.parseJsonAddress(configJson, ".eigenLayer.unpauser");
        config.rewardsUpdater = vm.parseJsonAddress(configJson, ".eigenLayer.rewardsUpdater");
        config.calculationIntervalSeconds =
            vm.parseJsonUint(configJson, ".eigenLayer.calculationIntervalSeconds").toUint32();
        config.maxRewardsDuration =
            vm.parseJsonUint(configJson, ".eigenLayer.maxRewardsDuration").toUint32();
        config.maxRetroactiveLength =
            vm.parseJsonUint(configJson, ".eigenLayer.maxRetroactiveLength").toUint32();
        config.maxFutureLength =
            vm.parseJsonUint(configJson, ".eigenLayer.maxFutureLength").toUint32();
        config.genesisRewardsTimestamp =
            vm.parseJsonUint(configJson, ".eigenLayer.genesisRewardsTimestamp").toUint32();
        config.activationDelay =
            vm.parseJsonUint(configJson, ".eigenLayer.activationDelay").toUint32();
        config.globalCommissionBips =
            uint16(vm.parseJsonUint(configJson, ".eigenLayer.globalCommissionBips"));
        config.executorMultisig = vm.parseJsonAddress(configJson, ".eigenLayer.executorMultisig");
        config.operationsMultisig =
            vm.parseJsonAddress(configJson, ".eigenLayer.operationsMultisig");

        // Use default values if not specified in config
        try vm.parseJsonUint(configJson, ".eigenLayer.minWithdrawalDelayBlocks") returns (
            uint256 val
        ) {
            config.minWithdrawalDelayBlocks = val.toUint32();
        } catch {
            config.minWithdrawalDelayBlocks = 7 days / 12 seconds; // Default: 1 week in blocks at 12s per block
        }

        try vm.parseJsonUint(configJson, ".eigenLayer.delegationWithdrawalDelayBlocks") returns (
            uint256 val
        ) {
            config.delegationWithdrawalDelayBlocks = val.toUint32();
        } catch {
            config.delegationWithdrawalDelayBlocks = 7 days / 12 seconds; // Default: 1 week
        }

        try vm.parseJsonUint(configJson, ".eigenLayer.strategyManagerInitPausedStatus") returns (
            uint256 val
        ) {
            config.strategyManagerInitPausedStatus = val;
        } catch {
            config.strategyManagerInitPausedStatus = 0; // Unpause all
        }

        try vm.parseJsonUint(configJson, ".eigenLayer.delegationInitPausedStatus") returns (
            uint256 val
        ) {
            config.delegationInitPausedStatus = val;
        } catch {
            config.delegationInitPausedStatus = 0; // Unpause all
        }

        try vm.parseJsonUint(configJson, ".eigenLayer.eigenPodManagerInitPausedStatus") returns (
            uint256 val
        ) {
            config.eigenPodManagerInitPausedStatus = val;
        } catch {
            config.eigenPodManagerInitPausedStatus = 0; // Unpause all
        }

        try vm.parseJsonUint(configJson, ".eigenLayer.rewardsCoordinatorInitPausedStatus") returns (
            uint256 val
        ) {
            config.rewardsCoordinatorInitPausedStatus = val;
        } catch {
            config.rewardsCoordinatorInitPausedStatus = 0; // Unpause all
        }

        try vm.parseJsonUint(configJson, ".eigenLayer.allocationManagerInitPausedStatus") returns (
            uint256 val
        ) {
            config.allocationManagerInitPausedStatus = val;
        } catch {
            config.allocationManagerInitPausedStatus = 0; // Unpause all
        }

        try vm.parseJsonUint(configJson, ".eigenLayer.deallocationDelay") returns (uint256 val) {
            config.deallocationDelay = val.toUint32();
        } catch {
            config.deallocationDelay = 7 days; // Default: 1 week
        }

        try vm.parseJsonUint(configJson, ".eigenLayer.allocationConfigurationDelay") returns (
            uint256 val
        ) {
            config.allocationConfigurationDelay = val.toUint32();
        } catch {
            config.allocationConfigurationDelay = 1 days; // Default: 1 day
        }

        try vm.parseJsonUint(configJson, ".eigenLayer.beaconChainGenesisTimestamp") returns (
            uint256 val
        ) {
            config.beaconChainGenesisTimestamp = val.toUint64();
        } catch {
            config.beaconChainGenesisTimestamp = 1616508000; // Mainnet default
        }

        // Load EigenLayer-specific contract addresses (if they exist in config)
        try vm.parseJsonAddress(configJson, ".eigenLayer.delegationManager") returns (
            address addr
        ) {
            config.delegationManager = addr;
        } catch {
            config.delegationManager = address(0);
        }

        try vm.parseJsonAddress(configJson, ".eigenLayer.strategyManager") returns (address addr) {
            config.strategyManager = addr;
        } catch {
            config.strategyManager = address(0);
        }

        try vm.parseJsonAddress(configJson, ".eigenLayer.avsDirectory") returns (address addr) {
            config.avsDirectory = addr;
        } catch {
            config.avsDirectory = address(0);
        }

        try vm.parseJsonAddress(configJson, ".eigenLayer.rewardsCoordinator") returns (
            address addr
        ) {
            config.rewardsCoordinator = addr;
        } catch {
            config.rewardsCoordinator = address(0);
        }

        try vm.parseJsonAddress(configJson, ".eigenLayer.allocationManager") returns (
            address addr
        ) {
            config.allocationManager = addr;
        } catch {
            config.allocationManager = address(0);
        }

        try vm.parseJsonAddress(configJson, ".eigenLayer.permissionController") returns (
            address addr
        ) {
            config.permissionController = addr;
        } catch {
            config.permissionController = address(0);
        }

        return config;
    }

    function getETHPOSDepositAddress() public returns (address) {
        string memory configPath = string.concat(
            vm.projectRoot(), "/config/", vm.envOr("NETWORK", string("anvil")), ".json"
        );
        string memory configJson = vm.readFile(configPath);

        // On mainnet, use the real ETH2 deposit contract. Otherwise, deploy a mock
        if (block.chainid == 1) {
            return 0x00000000219ab540356cBB839Cbe05303d7705Fa;
        } else {
            // For non-mainnet environments, check if there's a configured address or deploy a mock
            try vm.parseJsonAddress(configJson, ".eigenLayer.ethPOSDepositAddress") returns (
                address addr
            ) {
                if (addr != address(0)) {
                    return addr;
                }
            } catch {}

            // Deploy a mock ETH deposit contract if not configured
            return address(new EmptyContract());
        }
    }

    function _loadValidatorsFromConfig(
        string memory configJson,
        string memory path
    ) internal pure returns (bytes32[] memory) {
        // Load validators from JSON config
        string[] memory validatorsArray = vm.parseJsonStringArray(configJson, path);
        bytes32[] memory validators = new bytes32[](validatorsArray.length);
        for (uint256 i = 0; i < validatorsArray.length; i++) {
            validators[i] = vm.parseBytes32(validatorsArray[i]);
        }
        return validators;
    }

    function _loadAddressesFromConfig(
        string memory configJson,
        string memory path
    ) internal pure returns (address[] memory) {
        // Load addresses from JSON config
        string[] memory addressStrings = vm.parseJsonStringArray(configJson, path);
        address[] memory addresses = new address[](addressStrings.length);
        for (uint256 i = 0; i < addressStrings.length; i++) {
            addresses[i] = vm.parseAddress(addressStrings[i]);
        }
        return addresses;
    }
}

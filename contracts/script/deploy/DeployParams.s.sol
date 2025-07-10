// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {EmptyContract} from "eigenlayer-contracts/src/test/mocks/EmptyContract.sol";
import {Config} from "./Config.sol";
import {Script} from "forge-std/Script.sol";

contract DeployParams is Script, Config {
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
        config.startBlock = uint64(vm.parseJsonUint(configJson, ".snowbridge.startBlock"));
        config.rewardsMessageOrigin =
            vm.parseJsonBytes32(configJson, ".snowbridge.rewardsMessageOrigin");

        // Load validators from file or generate placeholder ones in dev mode
        bool isDevMode = keccak256(abi.encodePacked(vm.envOr("DEV_MODE", string("false"))))
            == keccak256(abi.encodePacked("true"));
        if (isDevMode) {
            config.initialValidators = _generateMockValidators(10);
            config.nextValidators = _generateMockValidators(10);
        } else {
            config.initialValidators =
                _loadValidatorsFromConfig(configJson, ".snowbridge.initialValidators");
            config.nextValidators =
                _loadValidatorsFromConfig(configJson, ".snowbridge.nextValidators");
        }

        return config;
    }

    function getAVSConfig() public view returns (AVSConfig memory) {
        AVSConfig memory config;

        string memory configPath = string.concat(
            vm.projectRoot(), "/config/", vm.envOr("NETWORK", string("anvil")), ".json"
        );
        string memory configJson = vm.readFile(configPath);

        // Load from JSON config or use environment variables as fallback
        config.avsOwner = vm.parseJsonAddress(configJson, ".avs.avsOwner");
        config.rewardsInitiator = vm.parseJsonAddress(configJson, ".avs.rewardsInitiator");
        config.vetoCommitteeMember = vm.parseJsonAddress(configJson, ".avs.vetoCommitteeMember");
        config.vetoWindowBlocks = uint32(vm.parseJsonUint(configJson, ".avs.vetoWindowBlocks"));
        config.validatorsStrategies =
            vm.parseJsonAddressArray(configJson, ".avs.validatorsStrategies");
        config.bspsStrategies = vm.parseJsonAddressArray(configJson, ".avs.bspsStrategies");
        config.mspsStrategies = vm.parseJsonAddressArray(configJson, ".avs.mspsStrategies");

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
            uint32(vm.parseJsonUint(configJson, ".eigenLayer.calculationIntervalSeconds"));
        config.maxRewardsDuration =
            uint32(vm.parseJsonUint(configJson, ".eigenLayer.maxRewardsDuration"));
        config.maxRetroactiveLength =
            uint32(vm.parseJsonUint(configJson, ".eigenLayer.maxRetroactiveLength"));
        config.maxFutureLength = uint32(vm.parseJsonUint(configJson, ".eigenLayer.maxFutureLength"));
        config.genesisRewardsTimestamp =
            uint32(vm.parseJsonUint(configJson, ".eigenLayer.genesisRewardsTimestamp"));
        config.activationDelay = uint32(vm.parseJsonUint(configJson, ".eigenLayer.activationDelay"));
        config.globalCommissionBips =
            uint16(vm.parseJsonUint(configJson, ".eigenLayer.globalCommissionBips"));
        config.executorMultisig = vm.parseJsonAddress(configJson, ".eigenLayer.executorMultisig");
        config.operationsMultisig =
            vm.parseJsonAddress(configJson, ".eigenLayer.operationsMultisig");

        // Use default values if not specified in config
        try vm.parseJsonUint(configJson, ".eigenLayer.minWithdrawalDelayBlocks") returns (
            uint256 val
        ) {
            config.minWithdrawalDelayBlocks = uint32(val);
        } catch {
            config.minWithdrawalDelayBlocks = 7 days / 12 seconds; // Default: 1 week in blocks at 12s per block
        }

        try vm.parseJsonUint(configJson, ".eigenLayer.delegationWithdrawalDelayBlocks") returns (
            uint256 val
        ) {
            config.delegationWithdrawalDelayBlocks = uint32(val);
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
            config.deallocationDelay = uint32(val);
        } catch {
            config.deallocationDelay = 7 days; // Default: 1 week
        }

        try vm.parseJsonUint(configJson, ".eigenLayer.allocationConfigurationDelay") returns (
            uint256 val
        ) {
            config.allocationConfigurationDelay = uint32(val);
        } catch {
            config.allocationConfigurationDelay = 1 days; // Default: 1 day
        }

        try vm.parseJsonUint(configJson, ".eigenLayer.beaconChainGenesisTimestamp") returns (
            uint256 val
        ) {
            config.beaconChainGenesisTimestamp = uint64(val);
        } catch {
            config.beaconChainGenesisTimestamp = 1616508000; // Mainnet default
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

    function _generateMockValidators(
        uint256 count
    ) internal pure returns (bytes32[] memory) {
        // Generate mock validators for testing
        bytes32[] memory validators = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            validators[i] = keccak256(abi.encodePacked("validator", i + 1));
        }
        return validators;
    }

    function _loadValidatorsFromConfig(
        string memory configJson,
        string memory path
    ) internal pure returns (address[] memory) {
        // Load validators from JSON config
        string[] memory validatorsArray = vm.parseJsonStringArray(configJson, path);
        address[] memory validators = new address[](validatorsArray.length);
        for (uint256 i = 0; i < validatorsArray.length; i++) {
            validators[i] = vm.parseAddress(validatorsArray[i]);
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

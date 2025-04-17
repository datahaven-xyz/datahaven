// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

contract Config {
    // Snowbridge parameters
    struct SnowbridgeConfig {
        uint256 randaoCommitDelay;
        uint256 randaoCommitExpiration;
        uint256 minNumRequiredSignatures;
        uint64 startBlock;
        bytes32[] initialValidators;
        bytes32[] nextValidators;
        bytes32 rewardsMessageOrigin;
    }

    // AVS parameters
    struct AVSConfig {
        address avsOwner;
        address rewardsInitiator;
        address vetoCommitteeMember;
        uint32 vetoWindowBlocks;
        address[] validatorsStrategies;
        address[] bspsStrategies;
        address[] mspsStrategies;
    }

    // EigenLayer parameters
    struct EigenLayerConfig {
        address[] pauserAddresses;
        address unpauserAddress;
        address rewardsUpdater;
        uint32 calculationIntervalSeconds;
        uint32 maxRewardsDuration;
        uint32 maxRetroactiveLength;
        uint32 maxFutureLength;
        uint32 genesisRewardsTimestamp;
        uint32 activationDelay;
        uint16 globalCommissionBips;
        address executorMultisig;
        address operationsMultisig;
        uint32 minWithdrawalDelayBlocks;
        uint32 delegationWithdrawalDelayBlocks;
        uint256 strategyManagerInitPausedStatus;
        uint256 delegationInitPausedStatus;
        uint256 eigenPodManagerInitPausedStatus;
        uint256 rewardsCoordinatorInitPausedStatus;
        uint256 allocationManagerInitPausedStatus;
        uint32 deallocationDelay;
        uint32 allocationConfigurationDelay;
        uint64 beaconChainGenesisTimestamp;
    }
}

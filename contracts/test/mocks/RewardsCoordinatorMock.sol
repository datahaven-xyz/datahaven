// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPauserRegistry} from "eigenlayer-contracts/src/contracts/interfaces/IPauserRegistry.sol";
import {IRewardsCoordinator} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";

contract RewardsCoordinatorMock is IRewardsCoordinator {
    function initialize(
        address initialOwner,
        uint256 initialPausedStatus,
        address _rewardsUpdater,
        uint32 _activationDelay,
        uint16 _defaultSplitBips
    ) external override {}

    function createAVSRewardsSubmission(
        RewardsSubmission[] calldata rewardsSubmissions
    ) external override {}

    function createRewardsForAllSubmission(
        RewardsSubmission[] calldata rewardsSubmissions
    ) external override {}

    function createRewardsForAllEarners(
        RewardsSubmission[] calldata rewardsSubmissions
    ) external override {}

    function createOperatorDirectedOperatorSetRewardsSubmission(
        OperatorSet calldata operatorSet,
        OperatorDirectedRewardsSubmission[]
            calldata operatorDirectedRewardsSubmissions
    ) external {}

    function getOperatorSetSplit(
        address operator,
        OperatorSet calldata operatorSet
    ) external view returns (uint16) {}

    function setOperatorSetSplit(
        address operator,
        OperatorSet calldata operatorSet,
        uint16 split
    ) external {}

    function createOperatorDirectedAVSRewardsSubmission(
        address avs,
        OperatorDirectedRewardsSubmission[]
            calldata operatorDirectedRewardsSubmissions
    ) external override {}

    function processClaim(
        RewardsMerkleClaim calldata claim,
        address recipient
    ) external override {}

    function processClaims(
        RewardsMerkleClaim[] calldata claims,
        address recipient
    ) external override {}

    function submitRoot(
        bytes32 root,
        uint32 rewardsCalculationEndTimestamp
    ) external override {}

    function disableRoot(uint32 rootIndex) external override {}

    function setClaimerFor(address claimer) external override {}

    function setClaimerFor(address earner, address claimer) external override {}

    function setActivationDelay(uint32 _activationDelay) external override {}

    function setDefaultOperatorSplit(uint16 split) external override {}

    function setOperatorAVSSplit(
        address operator,
        address avs,
        uint16 split
    ) external override {}

    function setOperatorPISplit(
        address operator,
        uint16 split
    ) external override {}

    function setRewardsUpdater(address _rewardsUpdater) external override {}

    function setRewardsForAllSubmitter(
        address _submitter,
        bool _newValue
    ) external override {}

    function activationDelay() external view override returns (uint32) {}

    function currRewardsCalculationEndTimestamp()
        external
        view
        override
        returns (uint32)
    {}

    function claimerFor(
        address earner
    ) external view override returns (address) {}

    function cumulativeClaimed(
        address claimer,
        IERC20 token
    ) external view override returns (uint256) {}

    function defaultOperatorSplitBips()
        external
        view
        override
        returns (uint16)
    {}

    function getOperatorAVSSplit(
        address operator,
        address avs
    ) external view override returns (uint16) {}

    function getOperatorPISplit(
        address operator
    ) external view override returns (uint16) {}

    function calculateEarnerLeafHash(
        EarnerTreeMerkleLeaf calldata leaf
    ) external pure override returns (bytes32) {}

    function calculateTokenLeafHash(
        TokenTreeMerkleLeaf calldata leaf
    ) external pure override returns (bytes32) {}

    function checkClaim(
        RewardsMerkleClaim calldata claim
    ) external view override returns (bool) {}

    function getDistributionRootsLength()
        external
        view
        override
        returns (uint256)
    {}

    function getDistributionRootAtIndex(
        uint256 index
    ) external view override returns (DistributionRoot memory) {}

    function getCurrentDistributionRoot()
        external
        view
        override
        returns (DistributionRoot memory)
    {}

    function getCurrentClaimableDistributionRoot()
        external
        view
        override
        returns (DistributionRoot memory)
    {}

    function getRootIndexFromHash(
        bytes32 rootHash
    ) external view override returns (uint32) {}

    function rewardsUpdater() external view override returns (address) {}

    function CALCULATION_INTERVAL_SECONDS()
        external
        view
        override
        returns (uint32)
    {}

    function MAX_REWARDS_DURATION() external view override returns (uint32) {}

    function MAX_RETROACTIVE_LENGTH() external view override returns (uint32) {}

    function MAX_FUTURE_LENGTH() external view override returns (uint32) {}

    function GENESIS_REWARDS_TIMESTAMP()
        external
        view
        override
        returns (uint32)
    {}

    function version() external pure override returns (string memory) {
        return "mock";
    }
}

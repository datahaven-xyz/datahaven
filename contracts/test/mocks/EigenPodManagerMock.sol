// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.9;

import "forge-std/Test.sol";
import "eigenlayer-contracts/src/contracts/permissions/Pausable.sol";
import "eigenlayer-contracts/src/contracts/interfaces/IEigenPodManager.sol";

contract EigenPodManagerMock is Test, Pausable, IEigenPodManager {
    receive() external payable {}

    fallback() external payable {}

    mapping(address => int256) public podShares;

    constructor(IPauserRegistry _pauserRegistry) Pausable(_pauserRegistry) {
        _setPausedStatus(0);
    }

    function podOwnerShares(address podOwner) external view returns (int256) {
        return podShares[podOwner];
    }

    function setPodOwnerShares(address podOwner, int256 shares) external {
        podShares[podOwner] = shares;
    }

    function denebForkTimestamp() external pure returns (uint64) {
        return type(uint64).max;
    }

    function createPod() external returns (address) {}

    function stake(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes32 depositDataRoot
    ) external payable {}

    function recordBeaconChainETHBalanceUpdate(
        address podOwner,
        int256 sharesDelta,
        uint64 proportionPodBalanceDecrease
    ) external {}

    function ownerToPod(address podOwner) external view returns (IEigenPod) {}

    function getPod(address podOwner) external view returns (IEigenPod) {}

    function ethPOS() external view returns (IETHPOSDeposit) {}

    function eigenPodBeacon() external view returns (IBeacon) {}

    function strategyManager() external view returns (IStrategyManager) {}

    function hasPod(address podOwner) external view returns (bool) {}

    function numPods() external view returns (uint256) {}

    function podOwnerDepositShares(
        address podOwner
    ) external view returns (int256) {}

    function beaconChainETHStrategy() external view returns (IStrategy) {}

    function stakerDepositShares(
        address user,
        IStrategy strategy
    ) external view returns (uint256 depositShares) {}

    function withdrawSharesAsTokens(
        address staker,
        IStrategy strategy,
        IERC20 token,
        uint256 shares
    ) external {}

    function addShares(
        address staker,
        IStrategy strategy,
        IERC20 token,
        uint256 shares
    ) external returns (uint256, uint256) {}

    function beaconChainSlashingFactor(
        address staker
    ) external view returns (uint64) {}

    function recordBeaconChainETHBalanceUpdate(
        address podOwner,
        uint256 prevRestakedBalanceWei,
        int256 balanceDeltaWei
    ) external {}

    function burnableETHShares() external view returns (uint256) {}

    function increaseBurnableShares(
        IStrategy strategy,
        uint256 addedSharesToBurn
    ) external {}

    function addShares(
        address staker,
        IStrategy strategy,
        uint256 shares
    ) external override returns (uint256, uint256) {}

    function version() external view override returns (string memory) {}

    function removeDepositShares(
        address staker,
        IStrategy strategy,
        uint256 depositSharesToRemove
    ) external override returns (uint256) {}
}

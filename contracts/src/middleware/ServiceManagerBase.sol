// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {Initializable} from "@openzeppelin-upgrades/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISignatureUtils} from "eigenlayer-contracts/src/contracts/interfaces/ISignatureUtils.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IRewardsCoordinator} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {IAllocationManager, IAllocationManagerTypes} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IPermissionController} from "eigenlayer-contracts/src/contracts/interfaces/IPermissionController.sol";
import {IPermissionController} from "eigenlayer-contracts/src/contracts/interfaces/IPermissionController.sol";

import {ServiceManagerBaseStorage} from "./ServiceManagerBaseStorage.sol";
import {IServiceManager} from "../interfaces/IServiceManager.sol";
import {ISlashingRegistryCoordinator} from "../interfaces/ISlashingRegistryCoordinator.sol";
import {IStakeRegistry} from "../interfaces/IStakeRegistry.sol";

import {BitmapUtils} from "../libraries/BitmapUtils.sol";
import {LibMergeSort} from "../libraries/LibMergeSort.sol";

/**
 * @title Minimal implementation of a ServiceManager-type contract.
 * This contract can be inherited from or simply used as a point-of-reference.
 * @author Layr Labs, Inc.
 */
abstract contract ServiceManagerBase is ServiceManagerBaseStorage {
    using SafeERC20 for IERC20;
    using BitmapUtils for *;

    /// @notice when applied to a function, only allows the RegistryCoordinator to call it
    modifier onlyRegistryCoordinator() {
        require(
            msg.sender == address(_registryCoordinator),
            OnlyRegistryCoordinator()
        );
        _;
    }

    /// @notice only rewardsInitiator can call createAVSRewardsSubmission
    modifier onlyRewardsInitiator() {
        _checkRewardsInitiator();
        _;
    }

    /// @notice Sets the (immutable) `_registryCoordinator` address
    constructor(
        IRewardsCoordinator __rewardsCoordinator,
        ISlashingRegistryCoordinator __registryCoordinator,
        IStakeRegistry __stakeRegistry,
        IPermissionController __permissionController,
        IAllocationManager __allocationManager
    )
        ServiceManagerBaseStorage(
            __rewardsCoordinator,
            __registryCoordinator,
            __stakeRegistry,
            __permissionController,
            __allocationManager
        )
    {
        _disableInitializers();
    }

    function __ServiceManagerBase_init(
        address initialOwner,
        address _rewardsInitiator
    ) internal virtual onlyInitializing {
        _transferOwnership(initialOwner);
        _setRewardsInitiator(_rewardsInitiator);
    }

    /// @inheritdoc IServiceManager
    function addPendingAdmin(address admin) external onlyOwner {
        _permissionController.addPendingAdmin({
            account: address(this),
            admin: admin
        });
    }

    /// @inheritdoc IServiceManager
    function removePendingAdmin(address pendingAdmin) external onlyOwner {
        _permissionController.removePendingAdmin({
            account: address(this),
            admin: pendingAdmin
        });
    }

    /// @inheritdoc IServiceManager
    function removeAdmin(address admin) external onlyOwner {
        _permissionController.removeAdmin({
            account: address(this),
            admin: admin
        });
    }

    /// @inheritdoc IServiceManager
    function setAppointee(
        address appointee,
        address target,
        bytes4 selector
    ) external onlyOwner {
        _permissionController.setAppointee({
            account: address(this),
            appointee: appointee,
            target: target,
            selector: selector
        });
    }

    /// @inheritdoc IServiceManager
    function removeAppointee(
        address appointee,
        address target,
        bytes4 selector
    ) external onlyOwner {
        _permissionController.removeAppointee({
            account: address(this),
            appointee: appointee,
            target: target,
            selector: selector
        });
    }

    /**
     * @notice Updates the metadata URI for the AVS
     * @param _metadataURI is the metadata URI for the AVS
     * @dev only callable by the owner
     */
    function updateAVSMetadataURI(
        string memory _metadataURI
    ) public virtual onlyOwner {
        // TODO: Implement
        revert("Not implemented");
    }

    /**
     * @notice Creates a new rewards submission to the EigenLayer RewardsCoordinator contract, to be split amongst the
     * set of stakers delegated to operators who are registered to this `avs`
     * @param rewardsSubmissions The rewards submissions being created
     * @dev Only callable by the permissioned rewardsInitiator address
     * @dev The duration of the `rewardsSubmission` cannot exceed `MAX_REWARDS_DURATION`
     * @dev The tokens are sent to the `RewardsCoordinator` contract
     * @dev Strategies must be in ascending order of addresses to check for duplicates
     * @dev This function will revert if the `rewardsSubmission` is malformed,
     * e.g. if the `strategies` and `weights` arrays are of non-equal lengths
     * @dev This function may fail to execute with a large number of submissions due to gas limits. Use a
     * smaller array of submissions if necessary.
     */
    function createAVSRewardsSubmission(
        IRewardsCoordinator.RewardsSubmission[] calldata rewardsSubmissions
    ) public virtual onlyRewardsInitiator {
        for (uint256 i = 0; i < rewardsSubmissions.length; ++i) {
            // transfer token to ServiceManager and approve RewardsCoordinator to transfer again
            // in createAVSRewardsSubmission() call
            rewardsSubmissions[i].token.safeTransferFrom(
                msg.sender,
                address(this),
                rewardsSubmissions[i].amount
            );
            rewardsSubmissions[i].token.safeIncreaseAllowance(
                address(_rewardsCoordinator),
                rewardsSubmissions[i].amount
            );
        }

        _rewardsCoordinator.createAVSRewardsSubmission(rewardsSubmissions);
    }

    /**
     * @notice Creates a new operator-directed rewards submission, to be split amongst the operators and
     * set of stakers delegated to operators who are registered to this `avs`.
     * @param operatorDirectedRewardsSubmissions The operator-directed rewards submissions being created.
     * @dev Only callable by the permissioned rewardsInitiator address
     * @dev The duration of the `rewardsSubmission` cannot exceed `MAX_REWARDS_DURATION`
     * @dev The tokens are sent to the `RewardsCoordinator` contract
     * @dev This contract needs a token approval of sum of all `operatorRewards` in the `operatorDirectedRewardsSubmissions`, before calling this function.
     * @dev Strategies must be in ascending order of addresses to check for duplicates
     * @dev Operators must be in ascending order of addresses to check for duplicates.
     * @dev This function will revert if the `operatorDirectedRewardsSubmissions` is malformed.
     * @dev This function may fail to execute with a large number of submissions due to gas limits. Use a
     * smaller array of submissions if necessary.
     */
    function createOperatorDirectedAVSRewardsSubmission(
        IRewardsCoordinator.OperatorDirectedRewardsSubmission[]
            calldata operatorDirectedRewardsSubmissions
    ) public virtual onlyRewardsInitiator {
        for (
            uint256 i = 0;
            i < operatorDirectedRewardsSubmissions.length;
            ++i
        ) {
            // Calculate total amount of token to transfer
            uint256 totalAmount = 0;
            for (
                uint256 j = 0;
                j <
                operatorDirectedRewardsSubmissions[i].operatorRewards.length;
                ++j
            ) {
                totalAmount += operatorDirectedRewardsSubmissions[i]
                    .operatorRewards[j]
                    .amount;
            }

            // Transfer token to ServiceManager and approve RewardsCoordinator to transfer again
            // in createOperatorDirectedAVSRewardsSubmission() call
            operatorDirectedRewardsSubmissions[i].token.safeTransferFrom(
                msg.sender,
                address(this),
                totalAmount
            );
            operatorDirectedRewardsSubmissions[i].token.safeIncreaseAllowance(
                address(_rewardsCoordinator),
                totalAmount
            );
        }

        _rewardsCoordinator.createOperatorDirectedAVSRewardsSubmission(
            address(this),
            operatorDirectedRewardsSubmissions
        );
    }

    /**
     * @notice Forwards a call to Eigenlayer's RewardsCoordinator contract to set the address of the entity that can call `processClaim` on behalf of this contract.
     * @param claimer The address of the entity that can call `processClaim` on behalf of the earner
     * @dev Only callable by the owner.
     */
    function setClaimerFor(address claimer) public virtual onlyOwner {
        _rewardsCoordinator.setClaimerFor(claimer);
    }

    /**
     * @notice Forwards a call to EigenLayer's AVSDirectory contract to confirm operator registration with the AVS
     * @param operator The address of the operator to register.
     * @param operatorSignature The signature, salt, and expiry of the operator's signature.
     */
    function registerOperatorToAVS(
        address operator,
        ISignatureUtils.SignatureWithSaltAndExpiry memory operatorSignature
    ) public virtual onlyRegistryCoordinator {
        // TODO: Implement
        revert("Not implemented");
    }

    /**
     * @notice Forwards a call to EigenLayer's AVSDirectory contract to confirm operator deregistration from the AVS
     * @param operator The address of the operator to deregister.
     */
    function deregisterOperatorFromAVS(
        address operator
    ) public virtual onlyRegistryCoordinator {
        // TODO: Implement
        revert("Not implemented");
    }

    function deregisterOperatorFromOperatorSets(
        address operator,
        uint32[] memory operatorSetIds
    ) public virtual onlyRegistryCoordinator {
        IAllocationManager.DeregisterParams
            memory params = IAllocationManagerTypes.DeregisterParams({
                operator: operator,
                avs: address(this),
                operatorSetIds: operatorSetIds
            });
        _allocationManager.deregisterFromOperatorSets(params);
    }

    /**
     * @notice Sets the rewards initiator address
     * @param newRewardsInitiator The new rewards initiator address
     * @dev only callable by the owner
     */
    function setRewardsInitiator(
        address newRewardsInitiator
    ) external onlyOwner {
        _setRewardsInitiator(newRewardsInitiator);
    }

    function _setRewardsInitiator(address newRewardsInitiator) internal {
        emit RewardsInitiatorUpdated(rewardsInitiator, newRewardsInitiator);
        rewardsInitiator = newRewardsInitiator;
    }

    /**
     * @notice Returns the list of strategies that the AVS supports for restaking
     * @dev This function is intended to be called off-chain
     * @dev No guarantee is made on uniqueness of each element in the returned array.
     *      The off-chain service should do that validation separately
     */
    function getRestakeableStrategies()
        external
        view
        virtual
        returns (address[] memory)
    {
        uint256 quorumCount = _registryCoordinator.quorumCount();

        if (quorumCount == 0) {
            return new address[](0);
        }

        uint256 strategyCount;
        for (uint256 i = 0; i < quorumCount; i++) {
            strategyCount += _stakeRegistry.strategyParamsLength(uint8(i));
        }

        address[] memory restakedStrategies = new address[](strategyCount);
        uint256 index = 0;
        for (uint256 i = 0; i < _registryCoordinator.quorumCount(); i++) {
            uint256 strategyParamsLength = _stakeRegistry.strategyParamsLength(
                uint8(i)
            );
            for (uint256 j = 0; j < strategyParamsLength; j++) {
                restakedStrategies[index] = address(
                    _stakeRegistry.strategyParamsByIndex(uint8(i), j).strategy
                );
                index++;
            }
        }
        return restakedStrategies;
    }

    /**
     * @notice Returns the list of strategies that the operator has potentially restaked on the AVS
     * @param operator The address of the operator to get restaked strategies for
     * @dev This function is intended to be called off-chain
     * @dev No guarantee is made on whether the operator has shares for a strategy in a quorum or uniqueness
     *      of each element in the returned array. The off-chain service should do that validation separately
     */
    function getOperatorRestakedStrategies(
        address operator
    ) external view virtual returns (address[] memory) {
        bytes32 operatorId = _registryCoordinator.getOperatorId(operator);
        uint192 operatorBitmap = _registryCoordinator.getCurrentQuorumBitmap(
            operatorId
        );

        if (operatorBitmap == 0 || _registryCoordinator.quorumCount() == 0) {
            return new address[](0);
        }

        // Get number of strategies for each quorum in operator bitmap
        bytes memory operatorRestakedQuorums = BitmapUtils.bitmapToBytesArray(
            operatorBitmap
        );
        uint256 strategyCount;
        for (uint256 i = 0; i < operatorRestakedQuorums.length; i++) {
            strategyCount += _stakeRegistry.strategyParamsLength(
                uint8(operatorRestakedQuorums[i])
            );
        }

        // Get strategies for each quorum in operator bitmap
        address[] memory restakedStrategies = new address[](strategyCount);
        uint256 index = 0;
        for (uint256 i = 0; i < operatorRestakedQuorums.length; i++) {
            uint8 quorum = uint8(operatorRestakedQuorums[i]);
            uint256 strategyParamsLength = _stakeRegistry.strategyParamsLength(
                quorum
            );
            for (uint256 j = 0; j < strategyParamsLength; j++) {
                restakedStrategies[index] = address(
                    _stakeRegistry.strategyParamsByIndex(quorum, j).strategy
                );
                index++;
            }
        }
        return restakedStrategies;
    }

    function _checkRewardsInitiator() internal view {
        require(msg.sender == rewardsInitiator, OnlyRewardsInitiator());
    }
}

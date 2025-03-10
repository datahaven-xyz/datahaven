// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {Initializable} from "@openzeppelin-upgrades/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISignatureUtils} from "eigenlayer-contracts/src/contracts/interfaces/ISignatureUtils.sol";
import {IStrategy} from "eigenlayer-contracts/src/contracts/interfaces/IStrategy.sol";
import {IRewardsCoordinator} from "eigenlayer-contracts/src/contracts/interfaces/IRewardsCoordinator.sol";
import {OperatorSet} from "eigenlayer-contracts/src/contracts/libraries/OperatorSetLib.sol";
import {IAllocationManager, IAllocationManagerTypes} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IAVSRegistrar} from "eigenlayer-contracts/src/contracts/interfaces/IAVSRegistrar.sol";
import {IPermissionController} from "eigenlayer-contracts/src/contracts/interfaces/IPermissionController.sol";
import {IPermissionController} from "eigenlayer-contracts/src/contracts/interfaces/IPermissionController.sol";

import {IServiceManager, IServiceManagerUI} from "../interfaces/IServiceManager.sol";

import {ServiceManagerBaseStorage} from "./ServiceManagerBaseStorage.sol";

/**
 * @title Minimal implementation of a ServiceManager-type contract.
 * This contract can be inherited from or simply used as a point-of-reference.
 */
abstract contract ServiceManagerBase is
    ServiceManagerBaseStorage,
    IAVSRegistrar
{
    using SafeERC20 for IERC20;

    /// @notice only rewardsInitiator can call createAVSRewardsSubmission
    modifier onlyRewardsInitiator() {
        _checkRewardsInitiator();
        _;
    }

    /// @notice Sets the (immutable) `_registryCoordinator` address
    constructor(
        IRewardsCoordinator __rewardsCoordinator,
        IPermissionController __permissionController,
        IAllocationManager __allocationManager
    )
        ServiceManagerBaseStorage(
            __rewardsCoordinator,
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

    /**
     * @notice Updates the metadata URI for the AVS
     * @param _metadataURI is the metadata URI for the AVS
     * @dev only callable by the owner
     */
    function updateAVSMetadataURI(
        string memory _metadataURI
    ) external virtual onlyOwner {
        _allocationManager.updateAVSMetadataURI(address(this), _metadataURI);
    }

    /**
     * Forwards the call to the AllocationManager.createOperatorSets() function
     */
    function createOperatorSets(
        address avs,
        IAllocationManager.CreateSetParams[] calldata params
    ) external virtual onlyOwner {
        _allocationManager.createOperatorSets(avs, params);
    }

    /**
     * Forwards the call to the AllocationManager.addStrategiesToOperatorSet() function
     */
    function addStrategiesToOperatorSet(
        address avs,
        uint32 operatorSetId,
        IStrategy[] calldata strategies
    ) external virtual onlyOwner {
        _allocationManager.addStrategiesToOperatorSet(
            avs,
            operatorSetId,
            strategies
        );
    }

    /**
     * Forwards the call to the AllocationManager.removeStrategiesFromOperatorSet() function
     */
    function removeStrategiesFromOperatorSet(
        address avs,
        uint32 operatorSetId,
        IStrategy[] calldata strategies
    ) external virtual onlyOwner {
        _allocationManager.removeStrategiesFromOperatorSet(
            avs,
            operatorSetId,
            strategies
        );
    }

    /**
     * Forwards the call to the AllocationManager.slashOperator() function
     */
    function slashOperator(
        address avs,
        IAllocationManager.SlashingParams calldata params
    ) external virtual onlyOwner {
        _allocationManager.slashOperator(avs, params);
    }

    /**
     * @notice Creates a new operator-directed rewards submission, to be split amongst the operators and
     * set of stakers delegated to operators who are registered to this AVS' OperatorSet.
     * @param operatorSet The OperatorSet to create the rewards submission for
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
    function createOperatorDirectedOperatorSetRewardsSubmission(
        OperatorSet calldata operatorSet,
        IRewardsCoordinator.OperatorDirectedRewardsSubmission[]
            calldata operatorDirectedRewardsSubmissions
    ) public virtual onlyRewardsInitiator {
        for (
            uint256 i = 0;
            i < operatorDirectedRewardsSubmissions.length;
            ++i
        ) {
            // Calculate total amount of tokens to transfer
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
            // in createOperatorDirectedOperatorSetRewardsSubmission() call
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

        _rewardsCoordinator.createOperatorDirectedOperatorSetRewardsSubmission(
            operatorSet,
            operatorDirectedRewardsSubmissions
        );
    }

    /// @inheritdoc IServiceManager
    function deregisterOperatorFromOperatorSets(
        address operator,
        uint32[] memory operatorSetIds
    ) external virtual override {
        IAllocationManagerTypes.DeregisterParams
            memory params = IAllocationManagerTypes.DeregisterParams({
                operator: operator,
                avs: address(this),
                operatorSetIds: operatorSetIds
            });
        _allocationManager.deregisterFromOperatorSets(params);
    }

    /// @inheritdoc IAVSRegistrar
    function supportsAVS(
        address avs
    ) external view virtual override returns (bool) {
        return avs == address(this);
    }

    /// @inheritdoc IAVSRegistrar
    function registerOperator(
        address, // operator,
        address, // avs,
        uint32[] calldata, // operatorSetIds,
        bytes calldata // data
    ) external virtual {
        // Always accepts Operator registration.
        return;
    }

    /// @inheritdoc IAVSRegistrar
    function deregisterOperator(
        address, // operator,
        address, // avs,
        uint32[] calldata // operatorSetIds
    ) external virtual {
        // Always rejects Operator deregistration.
        revert("ServiceManagerBase: deregistration not supported");
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
     * @notice Forwards a call to Eigenlayer's RewardsCoordinator contract to set the address of the entity that can call `processClaim` on behalf of this contract.
     * @param claimer The address of the entity that can call `processClaim` on behalf of the earner
     * @dev Only callable by the owner.
     */
    function setClaimerFor(address claimer) public virtual onlyOwner {
        _rewardsCoordinator.setClaimerFor(claimer);
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
        // TODO: Implement this
        return new address[](0);
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
        // TODO: Implement this
        return new address[](0);
    }

    /// @dev DEPRECATED ❗️ This function is not used in the ServiceManagerBase contract
    /// as it would use the deprecated `IAVSRegistrar` interface.
    /// Calling this function will revert.
    function registerOperatorToAVS(
        address, // operator
        ISignatureUtils.SignatureWithSaltAndExpiry calldata // operatorSignature
    ) external virtual override {
        revert("ServiceManagerBase: registerOperatorToAVS is deprecated");
    }

    /// @dev DEPRECATED ❗️ This function is not used in the ServiceManagerBase contract
    /// as it would use the deprecated `IAVSRegistrar` interface.
    /// Calling this function will revert.
    function deregisterOperatorFromAVS(
        address // operator
    ) external virtual override {
        revert("ServiceManagerBase: deregisterOperatorFromAVS is deprecated");
    }

    /// @dev NOT IMPLEMENTED ❗️ This function is not implemented in the ServiceManagerBase
    /// contract as this contract only handles operator-directed rewards submissions.
    /// Calling this function will revert.
    function createAVSRewardsSubmission(
        IRewardsCoordinator.RewardsSubmission[] calldata rewardsSubmissions
    ) external virtual override {}

    function _checkRewardsInitiator() internal view {
        require(msg.sender == rewardsInitiator, OnlyRewardsInitiator());
    }
}

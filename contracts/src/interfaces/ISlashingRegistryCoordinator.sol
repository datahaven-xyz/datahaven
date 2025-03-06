// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {IStakeRegistry} from "./IStakeRegistry.sol";
import {IAllocationManager} from "eigenlayer-contracts/src/contracts/interfaces/IAllocationManager.sol";
import {IStakeRegistry, IStakeRegistryTypes} from "./IStakeRegistry.sol";
import {IIndexRegistry} from "./IIndexRegistry.sol";
import {ISocketRegistry} from "./ISocketRegistry.sol";
import {IAVSRegistrar} from "eigenlayer-contracts/src/contracts/interfaces/IAVSRegistrar.sol";

interface ISlashingRegistryCoordinatorErrors {
    /// @notice Thrown when array lengths in input parameters don't match.
    error InputLengthMismatch();
    /// @notice Thrown when an invalid registration type is provided.
    error InvalidRegistrationType();
    /// @notice Thrown when non-allocation manager calls restricted function.
    error OnlyAllocationManager();
    /// @notice Thrown when non-ejector calls restricted function.
    error OnlyEjector();
    /// @notice Thrown when operating on a non-existent quorum.
    error QuorumDoesNotExist();
    /// @notice Thrown when registering/deregistering with empty bitmap.
    error BitmapEmpty();
    /// @notice Thrown when registering for already registered quorums.
    error AlreadyRegisteredForQuorums();
    /// @notice Thrown when registering before ejection cooldown expires.
    error CannotReregisterYet();
    /// @notice Thrown when unregistered operator attempts restricted operation.
    error NotRegistered();
    /// @notice Thrown when operator attempts self-churn.
    error CannotChurnSelf();
    /// @notice Thrown when operator count doesn't match quorum requirements.
    error QuorumOperatorCountMismatch();
    /// @notice Thrown when operator has insufficient stake for churn.
    error InsufficientStakeForChurn();
    /// @notice Thrown when attempting to kick operator above stake threshold.
    error CannotKickOperatorAboveThreshold();
    /// @notice Thrown when updating to zero bitmap.
    error BitmapCannotBeZero();
    /// @notice Thrown when deregistering from unregistered quorum.
    error NotRegisteredForQuorum();
    /// @notice Thrown when churn approver salt is already used.
    error ChurnApproverSaltUsed();
    /// @notice Thrown when operators or quorums list is not sorted ascending.
    error NotSorted();
    /// @notice Thrown when maximum quorum count is reached.
    error MaxQuorumsReached();
    /// @notice Thrown when the provided AVS address does not match the expected one.
    error InvalidAVS();
}

interface ISlashingRegistryCoordinatorTypes {
    /// @notice Core data structure for tracking operator information.
    /// @dev Links an operator's unique identifier with their current registration status.
    /// @param operatorId Unique identifier for the operator, typically derived from their BLS public key.
    /// @param status Current registration state of the operator in the system.
    struct OperatorInfo {
        bytes32 operatorId;
        OperatorStatus status;
    }

    /// @notice Records historical changes to an operator's quorum registrations.
    /// @dev Used for querying an operator's quorum memberships at specific block numbers.
    /// @param updateBlockNumber Block number when this update occurred (inclusive).
    /// @param nextUpdateBlockNumber Block number when the next update occurred (exclusive), or 0 if this is the latest update.
    /// @param quorumBitmap Bitmap where each bit represents registration in a specific quorum (1 = registered, 0 = not registered).
    struct QuorumBitmapUpdate {
        uint32 updateBlockNumber;
        uint32 nextUpdateBlockNumber;
        uint192 quorumBitmap;
    }

    /// @notice Configuration parameters for operator management within a quorum.
    /// @dev All BIPs (Basis Points) values are in relation to BIPS_DENOMINATOR (10000).
    /// @param maxOperatorCount Maximum number of operators allowed in the quorum.
    /// @param kickBIPsOfOperatorStake Required stake ratio (in BIPs) between new and existing operator for churn.
    ///        Example: 10500 means new operator needs 105% of existing operator's stake.
    /// @param kickBIPsOfTotalStake Minimum stake ratio (in BIPs) of total quorum stake an operator must maintain.
    ///        Example: 100 means operator needs 1% of total quorum stake to avoid being churned.
    struct OperatorSetParam {
        uint32 maxOperatorCount;
        uint16 kickBIPsOfOperatorStake;
        uint16 kickBIPsOfTotalStake;
    }

    /// @notice Parameters for removing an operator during churn.
    /// @dev Used in registerOperatorWithChurn to specify which operator to replace.
    /// @param quorumNumber The quorum from which to remove the operator.
    /// @param operator Address of the operator to be removed.
    struct OperatorKickParam {
        uint8 quorumNumber;
        address operator;
    }

    /// @notice Represents the registration state of an operator.
    /// @dev Used to track an operator's lifecycle in the system.
    /// @custom:enum NEVER_REGISTERED The operator has never registered with the system.
    /// @custom:enum REGISTERED The operator is currently registered and active.
    /// @custom:enum DEREGISTERED The operator was previously registered but has since deregistered.
    enum OperatorStatus {
        NEVER_REGISTERED,
        REGISTERED,
        DEREGISTERED
    }

    /**
     * @notice Enum representing the type of operator registration.
     * @custom:enum NORMAL Represents a normal operator registration.
     * @custom:enum CHURN Represents an operator registration during a churn event.
     */
    enum RegistrationType {
        NORMAL,
        CHURN
    }

    /**
     * @notice Data structure for storing the results of a registerOperator call.
     * @dev Contains arrays storing per-quorum information about operator counts and stakes.
     * @param numOperatorsPerQuorum For each quorum the operator registered for, stores the number of operators registered.
     * @param operatorStakes For each quorum the operator registered for, stores the stake of the operator in the quorum.
     * @param totalStakes For each quorum the operator registered for, stores the total stake of the quorum.
     */
    struct RegisterResults {
        uint32[] numOperatorsPerQuorum;
        uint96[] operatorStakes;
        uint96[] totalStakes;
    }
}

interface ISlashingRegistryCoordinatorEvents is
    ISlashingRegistryCoordinatorTypes
{
    /**
     * @notice Emitted when an operator registers for service in one or more quorums.
     * @dev Emitted in _registerOperator() and _registerOperatorToOperatorSet().
     * @param operator The address of the registered operator.
     * @param operatorId The unique identifier of the operator (BLS public key hash).
     */
    event OperatorRegistered(
        address indexed operator,
        bytes32 indexed operatorId
    );

    /**
     * @notice Emitted when an operator deregisters from service in one or more quorums.
     * @dev Emitted in _deregisterOperator().
     * @param operator The address of the deregistered operator.
     * @param operatorId The unique identifier of the operator (BLS public key hash).
     */
    event OperatorDeregistered(
        address indexed operator,
        bytes32 indexed operatorId
    );

    /**
     * @notice Emitted when a quorum's operator set parameters are updated.
     * @dev Emitted in _setOperatorSetParams().
     * @param quorumNumber The identifier of the quorum being updated.
     * @param operatorSetParams The new operator set parameters for the quorum.
     */
    event OperatorSetParamsUpdated(
        uint8 indexed quorumNumber,
        OperatorSetParam operatorSetParams
    );

    /**
     * @notice Emitted when the churn approver address is updated.
     * @dev Emitted in _setChurnApprover().
     * @param prevChurnApprover The previous churn approver address.
     * @param newChurnApprover The new churn approver address.
     */
    event ChurnApproverUpdated(
        address prevChurnApprover,
        address newChurnApprover
    );

    /**
     * @notice Emitted when the ejector address is updated.
     * @dev Emitted in _setEjector().
     * @param prevEjector The previous ejector address.
     * @param newEjector The new ejector address.
     */
    event EjectorUpdated(address prevEjector, address newEjector);

    /**
     * @notice Emitted when all operators in a quorum are updated simultaneously.
     * @dev Emitted in updateOperatorsForQuorum().
     * @param quorumNumber The identifier of the quorum being updated.
     * @param blocknumber The block number at which the quorum update occurred.
     */
    event QuorumBlockNumberUpdated(
        uint8 indexed quorumNumber,
        uint256 blocknumber
    );

    /**
     * @notice Emitted when an operator's socket is updated.
     * @dev Emitted in updateSocket().
     * @param operatorId The unique identifier of the operator (BLS public key hash).
     * @param socket The new socket address for the operator (typically an IP address).
     */
    event OperatorSocketUpdate(bytes32 indexed operatorId, string socket);
}

interface ISlashingRegistryCoordinator is
    IAVSRegistrar,
    ISlashingRegistryCoordinatorErrors,
    ISlashingRegistryCoordinatorEvents
{
    /// IMMUTABLES & CONSTANTS

    /**
     * @notice EIP-712 typehash for operator churn approval signatures.
     * @return The typehash constant.
     */
    function OPERATOR_CHURN_APPROVAL_TYPEHASH() external view returns (bytes32);

    /**
     * @notice EIP-712 typehash for pubkey registration signatures.
     * @return The typehash constant.
     */
    function PUBKEY_REGISTRATION_TYPEHASH() external view returns (bytes32);

    /**
     * @notice Reference to the StakeRegistry contract.
     * @return The StakeRegistry contract interface.
     */
    function stakeRegistry() external view returns (IStakeRegistry);

    /**
     * @notice Reference to the IndexRegistry contract.
     * @return The IndexRegistry contract interface.
     */
    function indexRegistry() external view returns (IIndexRegistry);

    /**
     * @notice Reference to the AllocationManager contract.
     * @return The AllocationManager contract interface.
     * @dev This is only relevant for Slashing AVSs
     */
    function allocationManager() external view returns (IAllocationManager);

    /**
     * @notice Reference to the SocketRegistry contract.
     * @return The SocketRegistry contract interface.
     */
    function socketRegistry() external view returns (ISocketRegistry);

    /// STORAGE

    /**
     * @notice The total number of quorums that have been created.
     * @return The count of quorums.
     */
    function quorumCount() external view returns (uint8);

    /**
     * @notice Checks if a churn approver salt has been used.
     * @param salt The salt to check.
     * @return True if the salt has been used, false otherwise.
     */
    function isChurnApproverSaltUsed(bytes32 salt) external view returns (bool);

    /**
     * @notice Gets the last block number when all operators in a quorum were updated.
     * @param quorumNumber The quorum identifier.
     * @return The block number of the last update.
     */
    function quorumUpdateBlockNumber(
        uint8 quorumNumber
    ) external view returns (uint256);

    /**
     * @notice Gets the registry contract address at a specific index.
     * @param index The index in the registries array.
     * @return The registry contract address.
     */
    function registries(uint256 index) external view returns (address);

    /**
     * @notice The address authorized to approve operator churn operations.
     * @return The churn approver address.
     */
    function churnApprover() external view returns (address);

    /**
     * @notice The address authorized to forcibly eject operators.
     * @return The ejector address.
     */
    function ejector() external view returns (address);

    /**
     * @notice Gets the timestamp of an operator's last ejection.
     * @param operator The operator address.
     * @return The timestamp of the last ejection.
     */
    function lastEjectionTimestamp(
        address operator
    ) external view returns (uint256);

    /**
     * @notice The cooldown period after ejection before an operator can re-register.
     * @return The cooldown duration in seconds.
     */
    function ejectionCooldown() external view returns (uint256);

    /// ACTIONS

    /**
     * @notice Updates stake weights for specified operators. If any operator is found to be below
     * the minimum stake for their registered quorums, they are deregistered from those quorums.
     * @param operators The operators whose stakes should be updated.
     * @dev Stakes are queried from the Eigenlayer core DelegationManager contract.
     * @dev WILL BE DEPRECATED IN FAVOR OF updateOperatorsForQuorum
     */
    function updateOperators(address[] memory operators) external;

    /**
     * @notice For each quorum in `quorumNumbers`, updates the StakeRegistry's view of ALL its registered operators' stakes.
     * Each quorum's `quorumUpdateBlockNumber` is also updated, which tracks the most recent block number when ALL registered
     * operators were updated.
     * @dev stakes are queried from the Eigenlayer core DelegationManager contract
     * @param operatorsPerQuorum for each quorum in `quorumNumbers`, this has a corresponding list of operators to update.
     * @dev Each list of operator addresses MUST be sorted in ascending order
     * @dev Each list of operator addresses MUST represent the entire list of registered operators for the corresponding quorum
     * @param quorumNumbers is an ordered byte array containing the quorum numbers being updated
     * @dev invariant: Each list of `operatorsPerQuorum` MUST be a sorted version of `IndexRegistry.getOperatorListAtBlockNumber`
     * for the corresponding quorum.
     * @dev note on race condition: if an operator registers/deregisters for any quorum in `quorumNumbers` after a txn to
     * this method is broadcast (but before it is executed), the method will fail
     */
    function updateOperatorsForQuorum(
        address[][] memory operatorsPerQuorum,
        bytes calldata quorumNumbers
    ) external;

    /**
     * @notice Updates the socket of the msg.sender given they are a registered operator.
     * @param socket The new socket address for the operator (typically an IP address).
     * @dev Will revert if msg.sender is not a registered operator.
     */
    function updateSocket(string memory socket) external;

    /**
     * @notice Forcibly removes an operator from specified quorums and sets their ejection timestamp.
     * @param operator The operator address to eject.
     * @param quorumNumbers The quorum numbers to eject the operator from.
     * @dev Can only be called by the ejector address.
     * @dev The operator cannot re-register until ejectionCooldown period has passed.
     */
    function ejectOperator(
        address operator,
        bytes memory quorumNumbers
    ) external;

    /**
     * @notice Creates a new quorum that tracks total delegated stake for operators.
     * @param operatorSetParams Configures the quorum's max operator count and churn parameters.
     * @param minimumStake Sets the minimum stake required for an operator to register or remain registered.
     * @param strategyParams A list of strategies and multipliers used by the StakeRegistry to calculate
     * an operator's stake weight for the quorum.
     * @dev For m2 AVS this function has the same behavior as createQuorum before.
     * @dev For migrated AVS that enable operator sets this will create a quorum that measures total delegated stake for operator set.
     */
    function createTotalDelegatedStakeQuorum(
        OperatorSetParam memory operatorSetParams,
        uint96 minimumStake,
        IStakeRegistryTypes.StrategyParams[] memory strategyParams
    ) external;

    /**
     * @notice Creates a new quorum that tracks slashable stake for operators.
     * @param operatorSetParams Configures the quorum's max operator count and churn parameters.
     * @param minimumStake Sets the minimum stake required for an operator to register or remain registered.
     * @param strategyParams A list of strategies and multipliers used by the StakeRegistry to calculate
     * an operator's stake weight for the quorum.
     * @param lookAheadPeriod The number of blocks to look ahead when calculating slashable stake.
     * @dev Can only be called when operator sets are enabled.
     */
    function createSlashableStakeQuorum(
        OperatorSetParam memory operatorSetParams,
        uint96 minimumStake,
        IStakeRegistryTypes.StrategyParams[] memory strategyParams,
        uint32 lookAheadPeriod
    ) external;

    /**
     * @notice Updates the configuration parameters for an existing operator set quorum.
     * @param quorumNumber The identifier of the quorum to update.
     * @param operatorSetParams The new operator set parameters to apply.
     * @dev Can only be called by the contract owner.
     */
    function setOperatorSetParams(
        uint8 quorumNumber,
        OperatorSetParam memory operatorSetParams
    ) external;

    /**
     * @notice Updates the address authorized to approve operator churn operations.
     * @param _churnApprover The new churn approver address.
     * @dev Can only be called by the contract owner.
     * @dev The churn approver is responsible for signing off on operator replacements in full quorums.
     */
    function setChurnApprover(address _churnApprover) external;

    /**
     * @notice Updates the address authorized to forcibly eject operators.
     * @param _ejector The new ejector address.
     * @dev Can only be called by the contract owner.
     * @dev The ejector can force-remove operators from quorums regardless of their stake.
     */
    function setEjector(address _ejector) external;

    /**
     * @notice Updates the duration operators must wait after ejection before re-registering.
     * @param _ejectionCooldown The new cooldown duration in seconds.
     * @dev Can only be called by the contract owner.
     */
    function setEjectionCooldown(uint256 _ejectionCooldown) external;

    /**
     * @notice Updates the avs address for this AVS (used for UAM integration in EigenLayer)
     * @param _avs The new avs address
     * @dev Can only be called by the contract owner
     * @dev NOTE: Updating this value will break existing OperatorSets and UAM integration. This value should only be set once.
     */
    function setAVS(address _avs) external;

    /// VIEW

    /**
     * @notice Returns the hash of the message that operators must sign with their BLS key to register
     * @param operator The operator's Ethereum address
     */
    function calculatePubkeyRegistrationMessageHash(
        address operator
    ) external view returns (bytes32);

    /**
     * @notice Returns the operator set parameters for a given quorum.
     * @param quorumNumber The identifier of the quorum to query.
     * @return The OperatorSetParam struct containing max operator count and churn thresholds.
     */
    function getOperatorSetParams(
        uint8 quorumNumber
    ) external view returns (OperatorSetParam memory);

    /**
     * @notice Returns the complete operator information for a given address.
     * @param operator The operator address to query.
     * @return An OperatorInfo struct containing the operator's ID and registration status.
     */
    function getOperator(
        address operator
    ) external view returns (OperatorInfo memory);

    /**
     * @notice Returns the unique identifier for a given operator address.
     * @param operator The operator address to query.
     * @return The operator's ID (derived from their BLS public key hash).
     */
    function getOperatorId(address operator) external view returns (bytes32);

    /**
     * @notice Returns the operator address associated with a given operator ID.
     * @param operatorId The unique identifier to look up.
     * @return The operator's address.
     * @dev Returns address(0) if the ID is not registered.
     */
    function getOperatorFromId(
        bytes32 operatorId
    ) external view returns (address);

    /**
     * @notice Returns the current registration status for a given operator.
     * @param operator The operator address to query.
     * @return The operator's status (NEVER_REGISTERED, REGISTERED, or DEREGISTERED).
     */
    function getOperatorStatus(
        address operator
    ) external view returns (OperatorStatus);

    /**
     * @notice Returns the indices needed to look up quorum bitmaps for operators at a specific block.
     * @param blockNumber The historical block number to query.
     * @param operatorIds Array of operator IDs to get indices for.
     * @return Array of indices corresponding to each operator ID.
     * @dev Reverts if any operator had not yet registered at the specified block.
     * @dev This function is designed to find proper inputs for getQuorumBitmapAtBlockNumberByIndex.
     */
    function getQuorumBitmapIndicesAtBlockNumber(
        uint32 blockNumber,
        bytes32[] memory operatorIds
    ) external view returns (uint32[] memory);

    /**
     * @notice Returns the quorum bitmap for an operator at a specific historical block.
     * @param operatorId The operator's unique identifier.
     * @param blockNumber The historical block number to query.
     * @param index The index in the operator's bitmap history (from getQuorumBitmapIndicesAtBlockNumber).
     * @return The quorum bitmap showing which quorums the operator was registered for.
     * @dev Reverts if the index is incorrect for the specified block number.
     */
    function getQuorumBitmapAtBlockNumberByIndex(
        bytes32 operatorId,
        uint32 blockNumber,
        uint256 index
    ) external view returns (uint192);

    /**
     * @notice Returns a specific update from an operator's quorum bitmap history.
     * @param operatorId The operator's unique identifier.
     * @param index The index in the bitmap history to query.
     * @return The QuorumBitmapUpdate struct at that index.
     */
    function getQuorumBitmapUpdateByIndex(
        bytes32 operatorId,
        uint256 index
    ) external view returns (QuorumBitmapUpdate memory);

    /**
     * @notice Returns the current quorum bitmap for an operator.
     * @param operatorId The operator's unique identifier.
     * @return A bitmap where each bit represents registration in a specific quorum.
     * @dev Returns 0 if the operator is not registered for any quorums.
     */
    function getCurrentQuorumBitmap(
        bytes32 operatorId
    ) external view returns (uint192);

    /**
     * @notice Returns the number of updates in an operator's bitmap history.
     * @param operatorId The operator's unique identifier.
     * @return The length of the bitmap history array.
     */
    function getQuorumBitmapHistoryLength(
        bytes32 operatorId
    ) external view returns (uint256);

    /**
     * @notice Returns the number of registry contracts managed by this coordinator.
     * @return The count of registry contracts (typically 3: stake, BLS, and index).
     */
    function numRegistries() external view returns (uint256);

    /**
     * @notice Calculates the digest hash that must be signed by the churn approver.
     * @param registeringOperator The address of the operator attempting to register.
     * @param registeringOperatorId The unique ID of the registering operator.
     * @param operatorKickParams Parameters specifying which operators to replace in full quorums.
     * @param salt Random value to ensure signature uniqueness.
     * @param expiry Timestamp after which the signature becomes invalid.
     * @return The EIP-712 typed data hash to be signed.
     */
    function calculateOperatorChurnApprovalDigestHash(
        address registeringOperator,
        bytes32 registeringOperatorId,
        OperatorKickParam[] memory operatorKickParams,
        bytes32 salt,
        uint256 expiry
    ) external view returns (bytes32);

    /**
     * @notice Returns the avs address for this AVS (used for UAM integration in EigenLayer)
     * @dev NOTE: Updating this value will break existing OperatorSets and UAM integration. This value should only be set once.
     * @return The avs address
     */
    function avs() external view returns (address);
}

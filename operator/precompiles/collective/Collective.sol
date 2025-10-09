// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

/// @dev The Collective Council contract's address.
address constant COLLECTIVE_COUNCIL_ADDRESS = 0x000000000000000000000000000000000000080e;
/// @dev The Collective Technical Committee contract's address.
address constant COLLECTIVE_TECHNICAL_ADDRESS = 0x000000000000000000000000000000000000080F;
/// @dev The Collective Treasury Council contract's address.
address constant COLLECTIVE_TREASURY_ADDRESS = 0x0000000000000000000000000000000000000810;

/// @dev The Collective Council contract's instance.
Collective constant COLLECTIVE_COUNCIL_CONTRACT = Collective(
    COLLECTIVE_COUNCIL_ADDRESS
);
/// @dev The Collective Technical Committee contract's instance.
Collective constant COLLECTIVE_TECHNICAL_CONTRACT = Collective(
    COLLECTIVE_TECHNICAL_ADDRESS
);
/// @dev The Collective Treasury Council contract's instance.
Collective constant COLLECTIVE_TREASURY_CONTRACT = Collective(
    COLLECTIVE_TREASURY_ADDRESS
);

/// @title Collective precompile
/// Allows to interact with Substrate pallet_collective from the EVM.
/// Addresses:
/// - 0x000000000000000000000000000000000000080e: Council
/// - 0x000000000000000000000000000000000000080f: Technical Committee
/// - 0x0000000000000000000000000000000000000810: Treasury Council.
interface Collective {
    /// @dev Execute a proposal as a single member of the collective.
    /// The sender must be a member of the collective.
    /// This will NOT revert if the Substrate proposal is dispatched but fails !
    ///
    /// @param proposal SCALE-encoded Substrate call.
    ///
    /// @custom:selector 09c5eabe
    function execute(bytes memory proposal) external;

    /// @dev Make a proposal for a call.
    /// The sender must be a member of the collective.
    /// If the threshold is less than 2 then the proposal will be dispatched
    /// directly from the group of one member of the collective.
    ///
    /// @param threshold Amount of members required to dispatch the proposal.
    /// @param proposal SCALE-encoded Substrate call.
    /// @return index Index of the new proposal. Meaningless if threshold < 2
    ///
    /// @custom:selector c57f3260
    function propose(uint32 threshold, bytes memory proposal)
        external
        returns (uint32 index);

    /// @dev Vote for a proposal.
    /// The sender must be a member of the collective.
    ///
    /// @param proposalHash Hash of the proposal to vote for. Ensure the caller knows what they're
    /// voting in case of front-running or reorgs.
    /// @param proposalIndex Index of the proposal (returned by propose).
    /// @param approve The vote itself, is the caller approving or not the proposal.
    ///
    /// @custom:selector 73e37688
    function vote(
        bytes32 proposalHash,
        uint32 proposalIndex,
        bool approve
    ) external;

    /// @dev Close a proposal.
    /// Can be called by anyone once there is enough votes.
    /// Reverts if called at a non appropriate time.
    ///
    /// @param proposalHash Hash of the proposal to close.
    /// @param proposalIndex Index of the proposal.
    /// @param proposalWeightBound Maximum amount of Substrate weight the proposal can use.
    /// This call will revert if the proposal call would use more.
    /// @param lengthBound Must be a value higher or equal to the length of the SCALE-encoded
    /// proposal in bytes.
    /// @return executed Was the proposal executed or removed?
    ///
    /// @custom:selector 638d9d47
    function close(
        bytes32 proposalHash,
        uint32 proposalIndex,
        uint64 proposalWeightBound,
        uint32 lengthBound
    ) external returns (bool executed);

    /// @dev Compute the hash of a proposal.
    ///
    /// @param proposal SCALE-encoded Substrate call.
    /// @return proposalHash Hash of the proposal.
    ///
    /// @custom:selector fc379417
    function proposalHash(bytes memory proposal)
        external
        view
        returns (bytes32 proposalHash);

    /// @dev Get the hashes of active proposals.
    ///
    /// @return proposalsHash Hashes of active proposals.
    ///
    /// @custom:selector 55ef20e6
    function proposals() external view returns (bytes32[] memory proposalsHash);

    /// @dev Get the list of members.
    ///
    /// @return members List of members.
    ///
    /// @custom:selector bdd4d18d
    function members() external view returns (address[] memory members);

    /// @dev Check if the given account is a member of the collective.
    ///
    /// @param account Account to check membership.
    ///
    /// @custom:selector a230c524
    function isMember(address account) external view returns (bool);

    /// @dev Get the prime account if there is one.
    ///
    /// @return prime Prime account of 0x00..00 if None.
    ///
    /// @custom:selector c7ee005e
    function prime() external view returns (address prime);

    event Executed(bytes32 indexed proposalHash);
    event Proposed(
        address indexed who,
        uint32 indexed proposalIndex,
        bytes32 indexed proposalHash,
        uint32 threshold
    );
    event Voted(address indexed who, bytes32 indexed proposalHash, bool voted);
    event Closed(bytes32 indexed proposalHash);
}

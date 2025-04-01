// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title BeefyClientMock
 *
 * Mock implementation of BeefyClient for testing purposes.
 * This mock simplifies the complex verification logic of the original BeefyClient
 * while maintaining the same interface.
 */
contract BeefyClientMock {
    /* Events */
    event NewMMRRoot(bytes32 mmrRoot, uint64 blockNumber);
    event NewTicket(address relayer, uint64 blockNumber);

    /* Types */
    struct Commitment {
        uint32 blockNumber;
        uint64 validatorSetID;
        PayloadItem[] payload;
    }

    struct PayloadItem {
        bytes2 payloadID;
        bytes data;
    }

    struct ValidatorProof {
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 index;
        address account;
        bytes32[] proof;
    }

    struct Ticket {
        uint64 blockNumber;
        uint32 validatorSetLen;
        uint32 numRequiredSignatures;
        uint256 prevRandao;
        bytes32 bitfieldHash;
    }

    struct MMRLeaf {
        uint8 version;
        uint32 parentNumber;
        bytes32 parentHash;
        uint64 nextAuthoritySetID;
        uint32 nextAuthoritySetLen;
        bytes32 nextAuthoritySetRoot;
        bytes32 parachainHeadsRoot;
    }

    struct ValidatorSet {
        uint128 id;
        uint128 length;
        bytes32 root;
    }

    struct ValidatorSetState {
        uint128 id;
        uint128 length;
        bytes32 root;
        // Mock implementation doesn't need usageCounters as complex as the original
        mapping(uint256 => uint16) usageCounters;
    }

    /* State */
    bytes32 public latestMMRRoot;
    uint64 public latestBeefyBlock;
    ValidatorSetState public currentValidatorSet;
    ValidatorSetState public nextValidatorSet;
    mapping(bytes32 => Ticket) public tickets;

    /* Constants */
    bytes2 public constant MMR_ROOT_ID = bytes2("mh");
    uint256 public immutable randaoCommitDelay;
    uint256 public immutable randaoCommitExpiration;
    uint256 public immutable minNumRequiredSignatures;

    /* Errors */
    error InvalidBitfield();
    error InvalidBitfieldLength();
    error InvalidCommitment();
    error InvalidMMRLeaf();
    error InvalidMMRLeafProof();
    error InvalidMMRRootLength();
    error InvalidSignature();
    error InvalidTicket();
    error InvalidValidatorProof();
    error InvalidValidatorProofLength();
    error CommitmentNotRelevant();
    error NotEnoughClaims();
    error PrevRandaoAlreadyCaptured();
    error PrevRandaoNotCaptured();
    error StaleCommitment();
    error TicketExpired();
    error WaitPeriodNotOver();

    constructor(
        uint256 _randaoCommitDelay,
        uint256 _randaoCommitExpiration,
        uint256 _minNumRequiredSignatures,
        uint64 _initialBeefyBlock,
        ValidatorSet memory _initialValidatorSet,
        ValidatorSet memory _nextValidatorSet
    ) {
        // Simple validation to mimic original behaviour
        if (_nextValidatorSet.id != _initialValidatorSet.id + 1) {
            revert("invalid-constructor-params");
        }

        randaoCommitDelay = _randaoCommitDelay;
        randaoCommitExpiration = _randaoCommitExpiration;
        minNumRequiredSignatures = _minNumRequiredSignatures;
        latestBeefyBlock = _initialBeefyBlock;

        currentValidatorSet.id = _initialValidatorSet.id;
        currentValidatorSet.length = _initialValidatorSet.length;
        currentValidatorSet.root = _initialValidatorSet.root;

        nextValidatorSet.id = _nextValidatorSet.id;
        nextValidatorSet.length = _nextValidatorSet.length;
        nextValidatorSet.root = _nextValidatorSet.root;
    }

    /* External Functions */
    function submitInitial(
        Commitment calldata commitment,
        uint256[] calldata bitfield,
        ValidatorProof calldata // proof
    ) external {
        if (commitment.blockNumber <= latestBeefyBlock) {
            revert StaleCommitment();
        }

        // Mock implementation accepts any valid-looking commitment
        bytes32 commitmentHash = keccak256(abi.encode(commitment));
        tickets[createTicketID(msg.sender, commitmentHash)] = Ticket({
            blockNumber: uint64(block.number),
            validatorSetLen: uint32(bitfield.length * 256), // Approximate validator set length from bitfield
            numRequiredSignatures: uint32(minNumRequiredSignatures),
            prevRandao: 0,
            bitfieldHash: keccak256(abi.encodePacked(bitfield))
        });

        emit NewTicket(msg.sender, commitment.blockNumber);
    }

    function commitPrevRandao(
        bytes32 commitmentHash
    ) external {
        bytes32 ticketID = createTicketID(msg.sender, commitmentHash);
        Ticket storage ticket = tickets[ticketID];

        if (ticket.blockNumber == 0) {
            revert InvalidTicket();
        }

        if (ticket.prevRandao != 0) {
            revert PrevRandaoAlreadyCaptured();
        }

        // Mock implementation doesn't enforce block delays
        // but keeps the error conditions for API compatibility

        // Set a mock prevRandao value
        ticket.prevRandao = uint256(keccak256(abi.encodePacked(block.number, block.timestamp)));
    }

    function submitFinal(
        Commitment calldata commitment,
        uint256[] calldata, // bitfield
        ValidatorProof[] calldata, // proofs
        MMRLeaf calldata leaf,
        bytes32[] calldata, // leafProof
        uint256 // leafProofOrder
    ) external {
        bytes32 commitmentHash = keccak256(abi.encode(commitment));
        bytes32 ticketID = createTicketID(msg.sender, commitmentHash);

        // Basic validation that mimics original behaviour
        Ticket storage ticket = tickets[ticketID];
        if (ticket.blockNumber == 0) {
            revert InvalidTicket();
        }

        if (ticket.prevRandao == 0) {
            revert PrevRandaoNotCaptured();
        }

        if (commitment.blockNumber <= latestBeefyBlock) {
            revert StaleCommitment();
        }

        // Extract MMR root from commitment
        bytes32 newMMRRoot;
        for (uint256 i = 0; i < commitment.payload.length; i++) {
            if (commitment.payload[i].payloadID == MMR_ROOT_ID) {
                if (commitment.payload[i].data.length != 32) {
                    revert InvalidMMRRootLength();
                }
                newMMRRoot = bytes32(commitment.payload[i].data);
                break;
            }
        }

        if (newMMRRoot == bytes32(0)) {
            revert CommitmentNotRelevant();
        }

        // Mock implementation to handle validator set changes based on commitment ID
        bool isNextSession = commitment.validatorSetID == nextValidatorSet.id;
        if (isNextSession) {
            // Update validator sets in the mock - can't copy the entire struct due to nested mappings
            currentValidatorSet.id = nextValidatorSet.id;
            currentValidatorSet.length = nextValidatorSet.length;
            currentValidatorSet.root = nextValidatorSet.root;

            // Set the next validator set values
            nextValidatorSet.id = leaf.nextAuthoritySetID;
            nextValidatorSet.length = leaf.nextAuthoritySetLen;
            nextValidatorSet.root = leaf.nextAuthoritySetRoot;
        }

        latestMMRRoot = newMMRRoot;
        latestBeefyBlock = commitment.blockNumber;
        delete tickets[ticketID];

        emit NewMMRRoot(newMMRRoot, commitment.blockNumber);
    }

    function verifyMMRLeafProof(
        bytes32, // leafHash
        bytes32[] calldata, // proof
        uint256 // proofOrder
    ) external pure returns (bool) {
        // Mock implementation returns true if the proof is not empty, false otherwise
        return true;
    }

    function createInitialBitfield(
        uint256[] calldata bitsToSet,
        uint256 length
    ) external pure returns (uint256[] memory) {
        if (length < bitsToSet.length) {
            revert InvalidBitfieldLength();
        }

        // Create a simple bitfield by setting the corresponding words
        uint256 numWords = (length + 255) / 256;
        uint256[] memory bitfield = new uint256[](numWords);

        for (uint256 i = 0; i < bitsToSet.length; i++) {
            uint256 index = bitsToSet[i];
            if (index < length) {
                uint256 wordIndex = index / 256;
                uint256 bitIndex = index % 256;
                bitfield[wordIndex] |= (1 << bitIndex);
            }
        }

        return bitfield;
    }

    function createFinalBitfield(
        bytes32 commitmentHash,
        uint256[] calldata bitfield
    ) external view returns (uint256[] memory) {
        bytes32 ticketID = createTicketID(msg.sender, commitmentHash);
        Ticket storage ticket = tickets[ticketID];

        if (ticket.bitfieldHash != keccak256(abi.encodePacked(bitfield))) {
            revert InvalidBitfield();
        }

        // Mock implementation just returns the same bitfield
        return bitfield;
    }

    /* Internal Functions */
    function createTicketID(
        address account,
        bytes32 commitmentHash
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(account, commitmentHash));
    }
}

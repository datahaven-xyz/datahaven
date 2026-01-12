import {
  createReadContract,
  createWriteContract,
  createSimulateContract,
  createWatchContractEvent,
} from 'wagmi/codegen'

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AVSDirectory
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const avsDirectoryAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_delegation',
        internalType: 'contract IDelegationManager',
        type: 'address',
      },
      {
        name: '_pauserRegistry',
        internalType: 'contract IPauserRegistry',
        type: 'address',
      },
      { name: '_version', internalType: 'string', type: 'string' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'OPERATOR_AVS_REGISTRATION_TYPEHASH',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'OPERATOR_SET_FORCE_DEREGISTRATION_TYPEHASH',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'OPERATOR_SET_REGISTRATION_TYPEHASH',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      { name: 'operator', internalType: 'address', type: 'address' },
    ],
    name: 'avsOperatorStatus',
    outputs: [
      {
        name: '',
        internalType: 'enum IAVSDirectoryTypes.OperatorAVSRegistrationStatus',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'avs', internalType: 'address', type: 'address' },
      { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
      { name: 'expiry', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'calculateOperatorAVSRegistrationDigestHash',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'salt', internalType: 'bytes32', type: 'bytes32' }],
    name: 'cancelSalt',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'delegation',
    outputs: [
      {
        name: '',
        internalType: 'contract IDelegationManager',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'deregisterOperatorFromAVS',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'domainSeparator',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'initialOwner', internalType: 'address', type: 'address' },
      { name: 'initialPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'operatorSaltIsSpent',
    outputs: [{ name: 'isSpent', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauseAll',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'index', internalType: 'uint8', type: 'uint8' }],
    name: 'paused',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauserRegistry',
    outputs: [
      { name: '', internalType: 'contract IPauserRegistry', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'operatorSignature',
        internalType:
          'struct ISignatureUtilsMixinTypes.SignatureWithSaltAndExpiry',
        type: 'tuple',
        components: [
          { name: 'signature', internalType: 'bytes', type: 'bytes' },
          { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
          { name: 'expiry', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    name: 'registerOperatorToAVS',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'metadataURI', internalType: 'string', type: 'string' }],
    name: 'updateAVSMetadataURI',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'metadataURI',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
    ],
    name: 'AVSMetadataURIUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'version', internalType: 'uint8', type: 'uint8', indexed: false },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'avs', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'status',
        internalType: 'enum IAVSDirectoryTypes.OperatorAVSRegistrationStatus',
        type: 'uint8',
        indexed: false,
      },
    ],
    name: 'OperatorAVSRegistrationStatusUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Paused',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Unpaused',
  },
  { type: 'error', inputs: [], name: 'CurrentlyPaused' },
  { type: 'error', inputs: [], name: 'InputAddressZero' },
  { type: 'error', inputs: [], name: 'InvalidNewPausedStatus' },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  { type: 'error', inputs: [], name: 'InvalidSignature' },
  { type: 'error', inputs: [], name: 'OnlyPauser' },
  { type: 'error', inputs: [], name: 'OnlyUnpauser' },
  { type: 'error', inputs: [], name: 'OperatorAlreadyRegisteredToAVS' },
  { type: 'error', inputs: [], name: 'OperatorNotRegisteredToAVS' },
  { type: 'error', inputs: [], name: 'OperatorNotRegisteredToEigenLayer' },
  { type: 'error', inputs: [], name: 'SaltSpent' },
  { type: 'error', inputs: [], name: 'SignatureExpired' },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Agent
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const agentAbi = [
  {
    type: 'constructor',
    inputs: [{ name: 'agentID', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  { type: 'receive', stateMutability: 'payable' },
  {
    type: 'function',
    inputs: [],
    name: 'AGENT_ID',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'GATEWAY',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'executor', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'invoke',
    outputs: [
      { name: '', internalType: 'bool', type: 'bool' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    stateMutability: 'nonpayable',
  },
  { type: 'error', inputs: [], name: 'Unauthorized' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AgentExecutor
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const agentExecutorAbi = [
  {
    type: 'function',
    inputs: [
      { name: 'target', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'callContract',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'recipient', internalType: 'address payable', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferEther',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'recipient', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint128', type: 'uint128' },
    ],
    name: 'transferToken',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  { type: 'error', inputs: [], name: 'NativeTransferFailed' },
  { type: 'error', inputs: [], name: 'TokenTransferFailed' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AllocationManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const allocationManagerAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_delegation',
        internalType: 'contract IDelegationManager',
        type: 'address',
      },
      {
        name: '_eigenStrategy',
        internalType: 'contract IStrategy',
        type: 'address',
      },
      {
        name: '_pauserRegistry',
        internalType: 'contract IPauserRegistry',
        type: 'address',
      },
      {
        name: '_permissionController',
        internalType: 'contract IPermissionController',
        type: 'address',
      },
      { name: '_DEALLOCATION_DELAY', internalType: 'uint32', type: 'uint32' },
      {
        name: '_ALLOCATION_CONFIGURATION_DELAY',
        internalType: 'uint32',
        type: 'uint32',
      },
      { name: '_version', internalType: 'string', type: 'string' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'ALLOCATION_CONFIGURATION_DELAY',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'DEALLOCATION_DELAY',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      { name: 'operatorSetId', internalType: 'uint32', type: 'uint32' },
      {
        name: 'strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
    ],
    name: 'addStrategiesToOperatorSet',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
      { name: 'numToClear', internalType: 'uint16[]', type: 'uint16[]' },
    ],
    name: 'clearDeallocationQueue',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      {
        name: 'params',
        internalType: 'struct IAllocationManagerTypes.CreateSetParams[]',
        type: 'tuple[]',
        components: [
          { name: 'operatorSetId', internalType: 'uint32', type: 'uint32' },
          {
            name: 'strategies',
            internalType: 'contract IStrategy[]',
            type: 'address[]',
          },
        ],
      },
    ],
    name: 'createOperatorSets',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      {
        name: 'params',
        internalType: 'struct IAllocationManagerTypes.CreateSetParams[]',
        type: 'tuple[]',
        components: [
          { name: 'operatorSetId', internalType: 'uint32', type: 'uint32' },
          {
            name: 'strategies',
            internalType: 'contract IStrategy[]',
            type: 'address[]',
          },
        ],
      },
      {
        name: 'redistributionRecipients',
        internalType: 'address[]',
        type: 'address[]',
      },
    ],
    name: 'createRedistributingOperatorSets',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'delegation',
    outputs: [
      {
        name: '',
        internalType: 'contract IDelegationManager',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'params',
        internalType: 'struct IAllocationManagerTypes.DeregisterParams',
        type: 'tuple',
        components: [
          { name: 'operator', internalType: 'address', type: 'address' },
          { name: 'avs', internalType: 'address', type: 'address' },
          {
            name: 'operatorSetIds',
            internalType: 'uint32[]',
            type: 'uint32[]',
          },
        ],
      },
    ],
    name: 'deregisterFromOperatorSets',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'eigenStrategy',
    outputs: [
      { name: '', internalType: 'contract IStrategy', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'avs', internalType: 'address', type: 'address' }],
    name: 'getAVSRegistrar',
    outputs: [
      { name: '', internalType: 'contract IAVSRegistrar', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'getAllocatableMagnitude',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'getAllocatedSets',
    outputs: [
      {
        name: '',
        internalType: 'struct OperatorSet[]',
        type: 'tuple[]',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: 'operators', internalType: 'address[]', type: 'address[]' },
      {
        name: 'strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
    ],
    name: 'getAllocatedStake',
    outputs: [{ name: '', internalType: 'uint256[][]', type: 'uint256[][]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'getAllocatedStrategies',
    outputs: [
      { name: '', internalType: 'contract IStrategy[]', type: 'address[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'getAllocation',
    outputs: [
      {
        name: '',
        internalType: 'struct IAllocationManagerTypes.Allocation',
        type: 'tuple',
        components: [
          { name: 'currentMagnitude', internalType: 'uint64', type: 'uint64' },
          { name: 'pendingDiff', internalType: 'int128', type: 'int128' },
          { name: 'effectBlock', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'getAllocationDelay',
    outputs: [
      { name: '', internalType: 'bool', type: 'bool' },
      { name: '', internalType: 'uint32', type: 'uint32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operators', internalType: 'address[]', type: 'address[]' },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'getAllocations',
    outputs: [
      {
        name: '',
        internalType: 'struct IAllocationManagerTypes.Allocation[]',
        type: 'tuple[]',
        components: [
          { name: 'currentMagnitude', internalType: 'uint64', type: 'uint64' },
          { name: 'pendingDiff', internalType: 'int128', type: 'int128' },
          { name: 'effectBlock', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'getEncumberedMagnitude',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'getMaxMagnitude',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operators', internalType: 'address[]', type: 'address[]' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'getMaxMagnitudes',
    outputs: [{ name: '', internalType: 'uint64[]', type: 'uint64[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
    ],
    name: 'getMaxMagnitudes',
    outputs: [{ name: '', internalType: 'uint64[]', type: 'uint64[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
      { name: 'blockNumber', internalType: 'uint32', type: 'uint32' },
    ],
    name: 'getMaxMagnitudesAtBlock',
    outputs: [{ name: '', internalType: 'uint64[]', type: 'uint64[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'getMemberCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'getMembers',
    outputs: [{ name: '', internalType: 'address[]', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: 'operators', internalType: 'address[]', type: 'address[]' },
      {
        name: 'strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
      { name: 'futureBlock', internalType: 'uint32', type: 'uint32' },
    ],
    name: 'getMinimumSlashableStake',
    outputs: [
      {
        name: 'slashableStake',
        internalType: 'uint256[][]',
        type: 'uint256[][]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'avs', internalType: 'address', type: 'address' }],
    name: 'getOperatorSetCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'getRedistributionRecipient',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'getRegisteredSets',
    outputs: [
      {
        name: '',
        internalType: 'struct OperatorSet[]',
        type: 'tuple[]',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'getSlashCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'getStrategiesInOperatorSet',
    outputs: [
      { name: '', internalType: 'contract IStrategy[]', type: 'address[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'getStrategyAllocations',
    outputs: [
      {
        name: '',
        internalType: 'struct OperatorSet[]',
        type: 'tuple[]',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      {
        name: '',
        internalType: 'struct IAllocationManagerTypes.Allocation[]',
        type: 'tuple[]',
        components: [
          { name: 'currentMagnitude', internalType: 'uint64', type: 'uint64' },
          { name: 'pendingDiff', internalType: 'int128', type: 'int128' },
          { name: 'effectBlock', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'initialPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'isMemberOfOperatorSet',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'isOperatorRedistributable',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'isOperatorSet',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'isOperatorSlashable',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'isRedistributingOperatorSet',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'params',
        internalType: 'struct IAllocationManagerTypes.AllocateParams[]',
        type: 'tuple[]',
        components: [
          {
            name: 'operatorSet',
            internalType: 'struct OperatorSet',
            type: 'tuple',
            components: [
              { name: 'avs', internalType: 'address', type: 'address' },
              { name: 'id', internalType: 'uint32', type: 'uint32' },
            ],
          },
          {
            name: 'strategies',
            internalType: 'contract IStrategy[]',
            type: 'address[]',
          },
          { name: 'newMagnitudes', internalType: 'uint64[]', type: 'uint64[]' },
        ],
      },
    ],
    name: 'modifyAllocations',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauseAll',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'index', internalType: 'uint8', type: 'uint8' }],
    name: 'paused',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauserRegistry',
    outputs: [
      { name: '', internalType: 'contract IPauserRegistry', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'permissionController',
    outputs: [
      {
        name: '',
        internalType: 'contract IPermissionController',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'params',
        internalType: 'struct IAllocationManagerTypes.RegisterParams',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          {
            name: 'operatorSetIds',
            internalType: 'uint32[]',
            type: 'uint32[]',
          },
          { name: 'data', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    name: 'registerForOperatorSets',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      { name: 'operatorSetId', internalType: 'uint32', type: 'uint32' },
      {
        name: 'strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
    ],
    name: 'removeStrategiesFromOperatorSet',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      {
        name: 'registrar',
        internalType: 'contract IAVSRegistrar',
        type: 'address',
      },
    ],
    name: 'setAVSRegistrar',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'delay', internalType: 'uint32', type: 'uint32' },
    ],
    name: 'setAllocationDelay',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      {
        name: 'params',
        internalType: 'struct IAllocationManagerTypes.SlashingParams',
        type: 'tuple',
        components: [
          { name: 'operator', internalType: 'address', type: 'address' },
          { name: 'operatorSetId', internalType: 'uint32', type: 'uint32' },
          {
            name: 'strategies',
            internalType: 'contract IStrategy[]',
            type: 'address[]',
          },
          { name: 'wadsToSlash', internalType: 'uint256[]', type: 'uint256[]' },
          { name: 'description', internalType: 'string', type: 'string' },
        ],
      },
    ],
    name: 'slashOperator',
    outputs: [
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      { name: 'metadataURI', internalType: 'string', type: 'string' },
    ],
    name: 'updateAVSMetadataURI',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'metadataURI',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
    ],
    name: 'AVSMetadataURIUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address', indexed: false },
      {
        name: 'registrar',
        internalType: 'contract IAVSRegistrar',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'AVSRegistrarSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      { name: 'delay', internalType: 'uint32', type: 'uint32', indexed: false },
      {
        name: 'effectBlock',
        internalType: 'uint32',
        type: 'uint32',
        indexed: false,
      },
    ],
    name: 'AllocationDelaySet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
      {
        name: 'magnitude',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
      {
        name: 'effectBlock',
        internalType: 'uint32',
        type: 'uint32',
        indexed: false,
      },
    ],
    name: 'AllocationUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
      {
        name: 'encumberedMagnitude',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'EncumberedMagnitudeUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'version', internalType: 'uint8', type: 'uint8', indexed: false },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
      {
        name: 'maxMagnitude',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'MaxMagnitudeUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
    ],
    name: 'OperatorAddedToOperatorSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
    ],
    name: 'OperatorRemovedFromOperatorSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
    ],
    name: 'OperatorSetCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
      {
        name: 'strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
        indexed: false,
      },
      {
        name: 'wadSlashed',
        internalType: 'uint256[]',
        type: 'uint256[]',
        indexed: false,
      },
      {
        name: 'description',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
    ],
    name: 'OperatorSlashed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Paused',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
      {
        name: 'redistributionRecipient',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'RedistributionAddressSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'StrategyAddedToOperatorSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'StrategyRemovedFromOperatorSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Unpaused',
  },
  { type: 'error', inputs: [], name: 'AlreadyMemberOfSet' },
  { type: 'error', inputs: [], name: 'CurrentlyPaused' },
  { type: 'error', inputs: [], name: 'Empty' },
  { type: 'error', inputs: [], name: 'InputAddressZero' },
  { type: 'error', inputs: [], name: 'InputArrayLengthMismatch' },
  { type: 'error', inputs: [], name: 'InsufficientMagnitude' },
  { type: 'error', inputs: [], name: 'InvalidAVSRegistrar' },
  { type: 'error', inputs: [], name: 'InvalidCaller' },
  { type: 'error', inputs: [], name: 'InvalidNewPausedStatus' },
  { type: 'error', inputs: [], name: 'InvalidOperator' },
  { type: 'error', inputs: [], name: 'InvalidOperatorSet' },
  { type: 'error', inputs: [], name: 'InvalidPermissions' },
  { type: 'error', inputs: [], name: 'InvalidRedistributionRecipient' },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  { type: 'error', inputs: [], name: 'InvalidSnapshotOrdering' },
  { type: 'error', inputs: [], name: 'InvalidStrategy' },
  { type: 'error', inputs: [], name: 'InvalidWadToSlash' },
  { type: 'error', inputs: [], name: 'ModificationAlreadyPending' },
  { type: 'error', inputs: [], name: 'NonexistentAVSMetadata' },
  { type: 'error', inputs: [], name: 'NotMemberOfSet' },
  { type: 'error', inputs: [], name: 'OnlyPauser' },
  { type: 'error', inputs: [], name: 'OnlyUnpauser' },
  { type: 'error', inputs: [], name: 'OperatorNotSlashable' },
  { type: 'error', inputs: [], name: 'OutOfBounds' },
  { type: 'error', inputs: [], name: 'SameMagnitude' },
  { type: 'error', inputs: [], name: 'StrategiesMustBeInAscendingOrder' },
  { type: 'error', inputs: [], name: 'StrategyAlreadyInOperatorSet' },
  { type: 'error', inputs: [], name: 'StrategyNotInOperatorSet' },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong',
  },
  { type: 'error', inputs: [], name: 'UninitializedAllocationDelay' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// BeefyClient
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const beefyClientAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_randaoCommitDelay', internalType: 'uint256', type: 'uint256' },
      {
        name: '_randaoCommitExpiration',
        internalType: 'uint256',
        type: 'uint256',
      },
      {
        name: '_minNumRequiredSignatures',
        internalType: 'uint256',
        type: 'uint256',
      },
      { name: '_initialBeefyBlock', internalType: 'uint64', type: 'uint64' },
      {
        name: '_initialValidatorSet',
        internalType: 'struct BeefyClient.ValidatorSet',
        type: 'tuple',
        components: [
          { name: 'id', internalType: 'uint128', type: 'uint128' },
          { name: 'length', internalType: 'uint128', type: 'uint128' },
          { name: 'root', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
      {
        name: '_nextValidatorSet',
        internalType: 'struct BeefyClient.ValidatorSet',
        type: 'tuple',
        components: [
          { name: 'id', internalType: 'uint128', type: 'uint128' },
          { name: 'length', internalType: 'uint128', type: 'uint128' },
          { name: 'root', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MMR_ROOT_ID',
    outputs: [{ name: '', internalType: 'bytes2', type: 'bytes2' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'commitmentHash', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'commitPrevRandao',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'commitmentHash', internalType: 'bytes32', type: 'bytes32' },
      { name: 'bitfield', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    name: 'createFinalBitfield',
    outputs: [{ name: '', internalType: 'uint256[]', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'bitsToSet', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'length', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'createInitialBitfield',
    outputs: [{ name: '', internalType: 'uint256[]', type: 'uint256[]' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'currentValidatorSet',
    outputs: [
      { name: 'id', internalType: 'uint128', type: 'uint128' },
      { name: 'length', internalType: 'uint128', type: 'uint128' },
      { name: 'root', internalType: 'bytes32', type: 'bytes32' },
      {
        name: 'usageCounters',
        internalType: 'struct Uint16Array',
        type: 'tuple',
        components: [
          { name: 'data', internalType: 'uint256[]', type: 'uint256[]' },
          { name: 'length', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'latestBeefyBlock',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'latestMMRRoot',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'minNumRequiredSignatures',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'nextValidatorSet',
    outputs: [
      { name: 'id', internalType: 'uint128', type: 'uint128' },
      { name: 'length', internalType: 'uint128', type: 'uint128' },
      { name: 'root', internalType: 'bytes32', type: 'bytes32' },
      {
        name: 'usageCounters',
        internalType: 'struct Uint16Array',
        type: 'tuple',
        components: [
          { name: 'data', internalType: 'uint256[]', type: 'uint256[]' },
          { name: 'length', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'randaoCommitDelay',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'randaoCommitExpiration',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'commitment',
        internalType: 'struct BeefyClient.Commitment',
        type: 'tuple',
        components: [
          { name: 'blockNumber', internalType: 'uint32', type: 'uint32' },
          { name: 'validatorSetID', internalType: 'uint64', type: 'uint64' },
          {
            name: 'payload',
            internalType: 'struct BeefyClient.PayloadItem[]',
            type: 'tuple[]',
            components: [
              { name: 'payloadID', internalType: 'bytes2', type: 'bytes2' },
              { name: 'data', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
      { name: 'bitfield', internalType: 'uint256[]', type: 'uint256[]' },
      {
        name: 'proofs',
        internalType: 'struct BeefyClient.ValidatorProof[]',
        type: 'tuple[]',
        components: [
          { name: 'v', internalType: 'uint8', type: 'uint8' },
          { name: 'r', internalType: 'bytes32', type: 'bytes32' },
          { name: 's', internalType: 'bytes32', type: 'bytes32' },
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'proof', internalType: 'bytes32[]', type: 'bytes32[]' },
        ],
      },
      {
        name: 'leaf',
        internalType: 'struct BeefyClient.MMRLeaf',
        type: 'tuple',
        components: [
          { name: 'version', internalType: 'uint8', type: 'uint8' },
          { name: 'parentNumber', internalType: 'uint32', type: 'uint32' },
          { name: 'parentHash', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'nextAuthoritySetID',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'nextAuthoritySetLen',
            internalType: 'uint32',
            type: 'uint32',
          },
          {
            name: 'nextAuthoritySetRoot',
            internalType: 'bytes32',
            type: 'bytes32',
          },
          { name: 'beefyExtraField', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
      { name: 'leafProof', internalType: 'bytes32[]', type: 'bytes32[]' },
      { name: 'leafProofOrder', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'submitFinal',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'commitment',
        internalType: 'struct BeefyClient.Commitment',
        type: 'tuple',
        components: [
          { name: 'blockNumber', internalType: 'uint32', type: 'uint32' },
          { name: 'validatorSetID', internalType: 'uint64', type: 'uint64' },
          {
            name: 'payload',
            internalType: 'struct BeefyClient.PayloadItem[]',
            type: 'tuple[]',
            components: [
              { name: 'payloadID', internalType: 'bytes2', type: 'bytes2' },
              { name: 'data', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
      { name: 'bitfield', internalType: 'uint256[]', type: 'uint256[]' },
      {
        name: 'proof',
        internalType: 'struct BeefyClient.ValidatorProof',
        type: 'tuple',
        components: [
          { name: 'v', internalType: 'uint8', type: 'uint8' },
          { name: 'r', internalType: 'bytes32', type: 'bytes32' },
          { name: 's', internalType: 'bytes32', type: 'bytes32' },
          { name: 'index', internalType: 'uint256', type: 'uint256' },
          { name: 'account', internalType: 'address', type: 'address' },
          { name: 'proof', internalType: 'bytes32[]', type: 'bytes32[]' },
        ],
      },
    ],
    name: 'submitInitial',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'ticketID', internalType: 'bytes32', type: 'bytes32' }],
    name: 'tickets',
    outputs: [
      { name: 'blockNumber', internalType: 'uint64', type: 'uint64' },
      { name: 'validatorSetLen', internalType: 'uint32', type: 'uint32' },
      { name: 'numRequiredSignatures', internalType: 'uint32', type: 'uint32' },
      { name: 'prevRandao', internalType: 'uint256', type: 'uint256' },
      { name: 'bitfieldHash', internalType: 'bytes32', type: 'bytes32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'leafHash', internalType: 'bytes32', type: 'bytes32' },
      { name: 'proof', internalType: 'bytes32[]', type: 'bytes32[]' },
      { name: 'proofOrder', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'verifyMMRLeafProof',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'mmrRoot',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
      {
        name: 'blockNumber',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'NewMMRRoot',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'relayer',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'blockNumber',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'NewTicket',
  },
  { type: 'error', inputs: [], name: 'CommitmentNotRelevant' },
  { type: 'error', inputs: [], name: 'IndexOutOfBounds' },
  { type: 'error', inputs: [], name: 'InvalidBitfield' },
  { type: 'error', inputs: [], name: 'InvalidBitfieldLength' },
  { type: 'error', inputs: [], name: 'InvalidCommitment' },
  { type: 'error', inputs: [], name: 'InvalidMMRLeaf' },
  { type: 'error', inputs: [], name: 'InvalidMMRLeafProof' },
  { type: 'error', inputs: [], name: 'InvalidMMRRootLength' },
  { type: 'error', inputs: [], name: 'InvalidSamplingParams' },
  { type: 'error', inputs: [], name: 'InvalidSignature' },
  { type: 'error', inputs: [], name: 'InvalidTicket' },
  { type: 'error', inputs: [], name: 'InvalidValidatorProof' },
  { type: 'error', inputs: [], name: 'InvalidValidatorProofLength' },
  { type: 'error', inputs: [], name: 'PrevRandaoAlreadyCaptured' },
  { type: 'error', inputs: [], name: 'PrevRandaoNotCaptured' },
  { type: 'error', inputs: [], name: 'ProofSizeExceeded' },
  { type: 'error', inputs: [], name: 'StaleCommitment' },
  { type: 'error', inputs: [], name: 'TicketExpired' },
  { type: 'error', inputs: [], name: 'UnsupportedCompactEncoding' },
  { type: 'error', inputs: [], name: 'WaitPeriodNotOver' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// DataHavenServiceManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const dataHavenServiceManagerAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '__rewardsCoordinator',
        internalType: 'contract IRewardsCoordinator',
        type: 'address',
      },
      {
        name: '__permissionController',
        internalType: 'contract IPermissionController',
        type: 'address',
      },
      {
        name: '__allocationManager',
        internalType: 'contract IAllocationManager',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'DATAHAVEN_AVS_METADATA',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'VALIDATORS_SET_ID',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'admin', internalType: 'address', type: 'address' }],
    name: 'addPendingAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '_strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
    ],
    name: 'addStrategiesToValidatorsSupportedStrategies',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'validator', internalType: 'address', type: 'address' }],
    name: 'addValidatorToAllowlist',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'buildNewValidatorSetMessage',
    outputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'avsAddress', internalType: 'address', type: 'address' },
      { name: 'operatorSetIds', internalType: 'uint32[]', type: 'uint32[]' },
    ],
    name: 'deregisterOperator',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'operatorSetIds', internalType: 'uint32[]', type: 'uint32[]' },
    ],
    name: 'deregisterOperatorFromOperatorSets',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'initialOwner', internalType: 'address', type: 'address' },
      { name: '_rewardsInitiator', internalType: 'address', type: 'address' },
      {
        name: 'validatorsStrategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
      {
        name: '_snowbridgeGatewayAddress',
        internalType: 'address',
        type: 'address',
      },
    ],
    name: 'initialise',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'avsAddress', internalType: 'address', type: 'address' },
      { name: 'operatorSetIds', internalType: 'uint32[]', type: 'uint32[]' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'registerOperator',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'admin', internalType: 'address', type: 'address' }],
    name: 'removeAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'appointee', internalType: 'address', type: 'address' },
      { name: 'target', internalType: 'address', type: 'address' },
      { name: 'selector', internalType: 'bytes4', type: 'bytes4' },
    ],
    name: 'removeAppointee',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'pendingAdmin', internalType: 'address', type: 'address' },
    ],
    name: 'removePendingAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '_strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
    ],
    name: 'removeStrategiesFromValidatorsSupportedStrategies',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'validator', internalType: 'address', type: 'address' }],
    name: 'removeValidatorFromAllowlist',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'rewardsInitiator',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'executionFee', internalType: 'uint128', type: 'uint128' },
      { name: 'relayerFee', internalType: 'uint128', type: 'uint128' },
    ],
    name: 'sendNewValidatorSet',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'appointee', internalType: 'address', type: 'address' },
      { name: 'target', internalType: 'address', type: 'address' },
      { name: 'selector', internalType: 'bytes4', type: 'bytes4' },
    ],
    name: 'setAppointee',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newRewardsInitiator', internalType: 'address', type: 'address' },
    ],
    name: 'setRewardsInitiator',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '_newSnowbridgeGateway',
        internalType: 'address',
        type: 'address',
      },
    ],
    name: 'setSnowbridgeGateway',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'snowbridgeGateway',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'submission',
        internalType:
          'struct IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission',
        type: 'tuple',
        components: [
          {
            name: 'strategiesAndMultipliers',
            internalType:
              'struct IRewardsCoordinatorTypes.StrategyAndMultiplier[]',
            type: 'tuple[]',
            components: [
              {
                name: 'strategy',
                internalType: 'contract IStrategy',
                type: 'address',
              },
              { name: 'multiplier', internalType: 'uint96', type: 'uint96' },
            ],
          },
          { name: 'token', internalType: 'contract IERC20', type: 'address' },
          {
            name: 'operatorRewards',
            internalType: 'struct IRewardsCoordinatorTypes.OperatorReward[]',
            type: 'tuple[]',
            components: [
              { name: 'operator', internalType: 'address', type: 'address' },
              { name: 'amount', internalType: 'uint256', type: 'uint256' },
            ],
          },
          { name: 'startTimestamp', internalType: 'uint32', type: 'uint32' },
          { name: 'duration', internalType: 'uint32', type: 'uint32' },
          { name: 'description', internalType: 'string', type: 'string' },
        ],
      },
    ],
    name: 'submitRewards',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'avsAddress', internalType: 'address', type: 'address' }],
    name: 'supportsAVS',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '_metadataURI', internalType: 'string', type: 'string' }],
    name: 'updateAVSMetadataURI',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'solochainAddress', internalType: 'address', type: 'address' },
    ],
    name: 'updateSolochainAddressForValidator',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'validatorEthAddressToSolochainAddress',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'validatorsAllowlist',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'validatorsSupportedStrategies',
    outputs: [
      { name: '', internalType: 'contract IStrategy[]', type: 'address[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'version', internalType: 'uint8', type: 'uint8', indexed: false },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operatorSetId',
        internalType: 'uint32',
        type: 'uint32',
        indexed: true,
      },
    ],
    name: 'OperatorDeregistered',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operatorSetId',
        internalType: 'uint32',
        type: 'uint32',
        indexed: true,
      },
    ],
    name: 'OperatorRegistered',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'oldInitiator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newInitiator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'RewardsInitiatorSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'totalAmount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'operatorCount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'RewardsSubmitted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'snowbridgeGateway',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'SnowbridgeGatewaySet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'validator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'ValidatorAddedToAllowlist',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'validator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'ValidatorRemovedFromAllowlist',
  },
  { type: 'error', inputs: [], name: 'CallerIsNotValidator' },
  { type: 'error', inputs: [], name: 'CantDeregisterFromMultipleOperatorSets' },
  { type: 'error', inputs: [], name: 'CantRegisterToMultipleOperatorSets' },
  { type: 'error', inputs: [], name: 'IncorrectAVSAddress' },
  { type: 'error', inputs: [], name: 'InvalidOperatorSetId' },
  { type: 'error', inputs: [], name: 'OnlyRewardsInitiator' },
  { type: 'error', inputs: [], name: 'OperatorNotInAllowlist' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// DelegationManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const delegationManagerAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_strategyManager',
        internalType: 'contract IStrategyManager',
        type: 'address',
      },
      {
        name: '_eigenPodManager',
        internalType: 'contract IEigenPodManager',
        type: 'address',
      },
      {
        name: '_allocationManager',
        internalType: 'contract IAllocationManager',
        type: 'address',
      },
      {
        name: '_pauserRegistry',
        internalType: 'contract IPauserRegistry',
        type: 'address',
      },
      {
        name: '_permissionController',
        internalType: 'contract IPermissionController',
        type: 'address',
      },
      { name: '_MIN_WITHDRAWAL_DELAY', internalType: 'uint32', type: 'uint32' },
      { name: '_version', internalType: 'string', type: 'string' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'DELEGATION_APPROVAL_TYPEHASH',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'allocationManager',
    outputs: [
      {
        name: '',
        internalType: 'contract IAllocationManager',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'beaconChainETHStrategy',
    outputs: [
      { name: '', internalType: 'contract IStrategy', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'approver', internalType: 'address', type: 'address' },
      { name: 'approverSalt', internalType: 'bytes32', type: 'bytes32' },
      { name: 'expiry', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'calculateDelegationApprovalDigestHash',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'withdrawal',
        internalType: 'struct IDelegationManagerTypes.Withdrawal',
        type: 'tuple',
        components: [
          { name: 'staker', internalType: 'address', type: 'address' },
          { name: 'delegatedTo', internalType: 'address', type: 'address' },
          { name: 'withdrawer', internalType: 'address', type: 'address' },
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'startBlock', internalType: 'uint32', type: 'uint32' },
          {
            name: 'strategies',
            internalType: 'contract IStrategy[]',
            type: 'address[]',
          },
          {
            name: 'scaledShares',
            internalType: 'uint256[]',
            type: 'uint256[]',
          },
        ],
      },
    ],
    name: 'calculateWithdrawalRoot',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'withdrawal',
        internalType: 'struct IDelegationManagerTypes.Withdrawal',
        type: 'tuple',
        components: [
          { name: 'staker', internalType: 'address', type: 'address' },
          { name: 'delegatedTo', internalType: 'address', type: 'address' },
          { name: 'withdrawer', internalType: 'address', type: 'address' },
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'startBlock', internalType: 'uint32', type: 'uint32' },
          {
            name: 'strategies',
            internalType: 'contract IStrategy[]',
            type: 'address[]',
          },
          {
            name: 'scaledShares',
            internalType: 'uint256[]',
            type: 'uint256[]',
          },
        ],
      },
      { name: 'tokens', internalType: 'contract IERC20[]', type: 'address[]' },
      { name: 'receiveAsTokens', internalType: 'bool', type: 'bool' },
    ],
    name: 'completeQueuedWithdrawal',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'withdrawals',
        internalType: 'struct IDelegationManagerTypes.Withdrawal[]',
        type: 'tuple[]',
        components: [
          { name: 'staker', internalType: 'address', type: 'address' },
          { name: 'delegatedTo', internalType: 'address', type: 'address' },
          { name: 'withdrawer', internalType: 'address', type: 'address' },
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'startBlock', internalType: 'uint32', type: 'uint32' },
          {
            name: 'strategies',
            internalType: 'contract IStrategy[]',
            type: 'address[]',
          },
          {
            name: 'scaledShares',
            internalType: 'uint256[]',
            type: 'uint256[]',
          },
        ],
      },
      {
        name: 'tokens',
        internalType: 'contract IERC20[][]',
        type: 'address[][]',
      },
      { name: 'receiveAsTokens', internalType: 'bool[]', type: 'bool[]' },
    ],
    name: 'completeQueuedWithdrawals',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      {
        name: 'strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
      {
        name: 'withdrawableShares',
        internalType: 'uint256[]',
        type: 'uint256[]',
      },
    ],
    name: 'convertToDepositShares',
    outputs: [{ name: '', internalType: 'uint256[]', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'staker', internalType: 'address', type: 'address' }],
    name: 'cumulativeWithdrawalsQueued',
    outputs: [
      { name: 'totalQueued', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'curDepositShares', internalType: 'uint256', type: 'uint256' },
      {
        name: 'beaconChainSlashingFactorDecrease',
        internalType: 'uint64',
        type: 'uint64',
      },
    ],
    name: 'decreaseDelegatedShares',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'approverSignatureAndExpiry',
        internalType: 'struct ISignatureUtilsMixinTypes.SignatureWithExpiry',
        type: 'tuple',
        components: [
          { name: 'signature', internalType: 'bytes', type: 'bytes' },
          { name: 'expiry', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'approverSalt', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'delegateTo',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'staker', internalType: 'address', type: 'address' }],
    name: 'delegatedTo',
    outputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'delegationApprover',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'delegationApprover', internalType: 'address', type: 'address' },
      { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'delegationApproverSaltIsSpent',
    outputs: [{ name: 'spent', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'depositScalingFactor',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'domainSeparator',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'eigenPodManager',
    outputs: [
      { name: '', internalType: 'contract IEigenPodManager', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'staker', internalType: 'address', type: 'address' }],
    name: 'getDepositedShares',
    outputs: [
      { name: '', internalType: 'contract IStrategy[]', type: 'address[]' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
    ],
    name: 'getOperatorShares',
    outputs: [{ name: '', internalType: 'uint256[]', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operators', internalType: 'address[]', type: 'address[]' },
      {
        name: 'strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
    ],
    name: 'getOperatorsShares',
    outputs: [{ name: '', internalType: 'uint256[][]', type: 'uint256[][]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'withdrawalRoot', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'getQueuedWithdrawal',
    outputs: [
      {
        name: 'withdrawal',
        internalType: 'struct IDelegationManagerTypes.Withdrawal',
        type: 'tuple',
        components: [
          { name: 'staker', internalType: 'address', type: 'address' },
          { name: 'delegatedTo', internalType: 'address', type: 'address' },
          { name: 'withdrawer', internalType: 'address', type: 'address' },
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'startBlock', internalType: 'uint32', type: 'uint32' },
          {
            name: 'strategies',
            internalType: 'contract IStrategy[]',
            type: 'address[]',
          },
          {
            name: 'scaledShares',
            internalType: 'uint256[]',
            type: 'uint256[]',
          },
        ],
      },
      { name: 'shares', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'staker', internalType: 'address', type: 'address' }],
    name: 'getQueuedWithdrawalRoots',
    outputs: [{ name: '', internalType: 'bytes32[]', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'staker', internalType: 'address', type: 'address' }],
    name: 'getQueuedWithdrawals',
    outputs: [
      {
        name: 'withdrawals',
        internalType: 'struct IDelegationManagerTypes.Withdrawal[]',
        type: 'tuple[]',
        components: [
          { name: 'staker', internalType: 'address', type: 'address' },
          { name: 'delegatedTo', internalType: 'address', type: 'address' },
          { name: 'withdrawer', internalType: 'address', type: 'address' },
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'startBlock', internalType: 'uint32', type: 'uint32' },
          {
            name: 'strategies',
            internalType: 'contract IStrategy[]',
            type: 'address[]',
          },
          {
            name: 'scaledShares',
            internalType: 'uint256[]',
            type: 'uint256[]',
          },
        ],
      },
      { name: 'shares', internalType: 'uint256[][]', type: 'uint256[][]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'getSlashableSharesInQueue',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      {
        name: 'strategies',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
    ],
    name: 'getWithdrawableShares',
    outputs: [
      {
        name: 'withdrawableShares',
        internalType: 'uint256[]',
        type: 'uint256[]',
      },
      { name: 'depositShares', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
      { name: 'prevDepositShares', internalType: 'uint256', type: 'uint256' },
      { name: 'addedShares', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'increaseDelegatedShares',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'initialPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'staker', internalType: 'address', type: 'address' }],
    name: 'isDelegated',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'isOperator',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'minWithdrawalDelayBlocks',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'newDelegationApprover',
        internalType: 'address',
        type: 'address',
      },
    ],
    name: 'modifyOperatorDetails',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'operatorShares',
    outputs: [{ name: 'shares', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauseAll',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'index', internalType: 'uint8', type: 'uint8' }],
    name: 'paused',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauserRegistry',
    outputs: [
      { name: '', internalType: 'contract IPauserRegistry', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'withdrawalRoot', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'pendingWithdrawals',
    outputs: [{ name: 'pending', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'permissionController',
    outputs: [
      {
        name: '',
        internalType: 'contract IPermissionController',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'params',
        internalType: 'struct IDelegationManagerTypes.QueuedWithdrawalParams[]',
        type: 'tuple[]',
        components: [
          {
            name: 'strategies',
            internalType: 'contract IStrategy[]',
            type: 'address[]',
          },
          {
            name: 'depositShares',
            internalType: 'uint256[]',
            type: 'uint256[]',
          },
          {
            name: '__deprecated_withdrawer',
            internalType: 'address',
            type: 'address',
          },
        ],
      },
    ],
    name: 'queueWithdrawals',
    outputs: [{ name: '', internalType: 'bytes32[]', type: 'bytes32[]' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'withdrawalRoot', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'queuedWithdrawals',
    outputs: [
      {
        name: 'withdrawal',
        internalType: 'struct IDelegationManagerTypes.Withdrawal',
        type: 'tuple',
        components: [
          { name: 'staker', internalType: 'address', type: 'address' },
          { name: 'delegatedTo', internalType: 'address', type: 'address' },
          { name: 'withdrawer', internalType: 'address', type: 'address' },
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'startBlock', internalType: 'uint32', type: 'uint32' },
          {
            name: 'strategies',
            internalType: 'contract IStrategy[]',
            type: 'address[]',
          },
          {
            name: 'scaledShares',
            internalType: 'uint256[]',
            type: 'uint256[]',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newOperator', internalType: 'address', type: 'address' },
      {
        name: 'newOperatorApproverSig',
        internalType: 'struct ISignatureUtilsMixinTypes.SignatureWithExpiry',
        type: 'tuple',
        components: [
          { name: 'signature', internalType: 'bytes', type: 'bytes' },
          { name: 'expiry', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'approverSalt', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'redelegate',
    outputs: [
      { name: 'withdrawalRoots', internalType: 'bytes32[]', type: 'bytes32[]' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'initDelegationApprover',
        internalType: 'address',
        type: 'address',
      },
      { name: 'allocationDelay', internalType: 'uint32', type: 'uint32' },
      { name: 'metadataURI', internalType: 'string', type: 'string' },
    ],
    name: 'registerAsOperator',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: 'slashId', internalType: 'uint256', type: 'uint256' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
      { name: 'prevMaxMagnitude', internalType: 'uint64', type: 'uint64' },
      { name: 'newMaxMagnitude', internalType: 'uint64', type: 'uint64' },
    ],
    name: 'slashOperatorShares',
    outputs: [
      {
        name: 'totalDepositSharesToSlash',
        internalType: 'uint256',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'strategyManager',
    outputs: [
      { name: '', internalType: 'contract IStrategyManager', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'staker', internalType: 'address', type: 'address' }],
    name: 'undelegate',
    outputs: [
      { name: 'withdrawalRoots', internalType: 'bytes32[]', type: 'bytes32[]' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'metadataURI', internalType: 'string', type: 'string' },
    ],
    name: 'updateOperatorMetadataURI',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newDelegationApprover',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'DelegationApproverUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'staker',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
      {
        name: 'newDepositScalingFactor',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'DepositScalingFactorUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'version', internalType: 'uint8', type: 'uint8', indexed: false },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'metadataURI',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
    ],
    name: 'OperatorMetadataURIUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'delegationApprover',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'OperatorRegistered',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'staker',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'OperatorSharesDecreased',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'staker',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'OperatorSharesIncreased',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
      {
        name: 'totalSlashedShares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'OperatorSharesSlashed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Paused',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'withdrawalRoot',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
    ],
    name: 'SlashingWithdrawalCompleted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'withdrawalRoot',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
      {
        name: 'withdrawal',
        internalType: 'struct IDelegationManagerTypes.Withdrawal',
        type: 'tuple',
        components: [
          { name: 'staker', internalType: 'address', type: 'address' },
          { name: 'delegatedTo', internalType: 'address', type: 'address' },
          { name: 'withdrawer', internalType: 'address', type: 'address' },
          { name: 'nonce', internalType: 'uint256', type: 'uint256' },
          { name: 'startBlock', internalType: 'uint32', type: 'uint32' },
          {
            name: 'strategies',
            internalType: 'contract IStrategy[]',
            type: 'address[]',
          },
          {
            name: 'scaledShares',
            internalType: 'uint256[]',
            type: 'uint256[]',
          },
        ],
        indexed: false,
      },
      {
        name: 'sharesToWithdraw',
        internalType: 'uint256[]',
        type: 'uint256[]',
        indexed: false,
      },
    ],
    name: 'SlashingWithdrawalQueued',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'staker',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'StakerDelegated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'staker',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'StakerForceUndelegated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'staker',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'StakerUndelegated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Unpaused',
  },
  { type: 'error', inputs: [], name: 'ActivelyDelegated' },
  { type: 'error', inputs: [], name: 'CallerCannotUndelegate' },
  { type: 'error', inputs: [], name: 'CurrentlyPaused' },
  { type: 'error', inputs: [], name: 'FullySlashed' },
  { type: 'error', inputs: [], name: 'InputAddressZero' },
  { type: 'error', inputs: [], name: 'InputArrayLengthMismatch' },
  { type: 'error', inputs: [], name: 'InputArrayLengthZero' },
  { type: 'error', inputs: [], name: 'InvalidDepositScalingFactor' },
  { type: 'error', inputs: [], name: 'InvalidNewPausedStatus' },
  { type: 'error', inputs: [], name: 'InvalidPermissions' },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  { type: 'error', inputs: [], name: 'InvalidSignature' },
  { type: 'error', inputs: [], name: 'InvalidSnapshotOrdering' },
  { type: 'error', inputs: [], name: 'NotActivelyDelegated' },
  { type: 'error', inputs: [], name: 'OnlyAllocationManager' },
  { type: 'error', inputs: [], name: 'OnlyEigenPodManager' },
  { type: 'error', inputs: [], name: 'OnlyPauser' },
  { type: 'error', inputs: [], name: 'OnlyStrategyManagerOrEigenPodManager' },
  { type: 'error', inputs: [], name: 'OnlyUnpauser' },
  { type: 'error', inputs: [], name: 'OperatorNotRegistered' },
  { type: 'error', inputs: [], name: 'OperatorsCannotUndelegate' },
  { type: 'error', inputs: [], name: 'SaltSpent' },
  { type: 'error', inputs: [], name: 'SignatureExpired' },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong',
  },
  { type: 'error', inputs: [], name: 'WithdrawalDelayNotElapsed' },
  { type: 'error', inputs: [], name: 'WithdrawalNotQueued' },
  { type: 'error', inputs: [], name: 'WithdrawerNotCaller' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// EigenPod
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const eigenPodAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_ethPOS',
        internalType: 'contract IETHPOSDeposit',
        type: 'address',
      },
      {
        name: '_eigenPodManager',
        internalType: 'contract IEigenPodManager',
        type: 'address',
      },
      { name: '_version', internalType: 'string', type: 'string' },
    ],
    stateMutability: 'nonpayable',
  },
  { type: 'receive', stateMutability: 'payable' },
  {
    type: 'function',
    inputs: [],
    name: 'activeValidatorCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    name: 'checkpointBalanceExitedGwei',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'currentCheckpoint',
    outputs: [
      {
        name: '',
        internalType: 'struct IEigenPodTypes.Checkpoint',
        type: 'tuple',
        components: [
          { name: 'beaconBlockRoot', internalType: 'bytes32', type: 'bytes32' },
          { name: 'proofsRemaining', internalType: 'uint24', type: 'uint24' },
          { name: 'podBalanceGwei', internalType: 'uint64', type: 'uint64' },
          { name: 'balanceDeltasGwei', internalType: 'int64', type: 'int64' },
          {
            name: 'prevBeaconBalanceGwei',
            internalType: 'uint64',
            type: 'uint64',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'currentCheckpointTimestamp',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'eigenPodManager',
    outputs: [
      { name: '', internalType: 'contract IEigenPodManager', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'ethPOS',
    outputs: [
      { name: '', internalType: 'contract IETHPOSDeposit', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getConsolidationRequestFee',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'timestamp', internalType: 'uint64', type: 'uint64' }],
    name: 'getParentBlockRoot',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getWithdrawalRequestFee',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '_podOwner', internalType: 'address', type: 'address' }],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'lastCheckpointTimestamp',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'podOwner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'proofSubmitter',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'tokenList',
        internalType: 'contract IERC20[]',
        type: 'address[]',
      },
      {
        name: 'amountsToWithdraw',
        internalType: 'uint256[]',
        type: 'uint256[]',
      },
      { name: 'recipient', internalType: 'address', type: 'address' },
    ],
    name: 'recoverTokens',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'requests',
        internalType: 'struct IEigenPodTypes.ConsolidationRequest[]',
        type: 'tuple[]',
        components: [
          { name: 'srcPubkey', internalType: 'bytes', type: 'bytes' },
          { name: 'targetPubkey', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    name: 'requestConsolidation',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'requests',
        internalType: 'struct IEigenPodTypes.WithdrawalRequest[]',
        type: 'tuple[]',
        components: [
          { name: 'pubkey', internalType: 'bytes', type: 'bytes' },
          { name: 'amountGwei', internalType: 'uint64', type: 'uint64' },
        ],
      },
    ],
    name: 'requestWithdrawal',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newProofSubmitter', internalType: 'address', type: 'address' },
    ],
    name: 'setProofSubmitter',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'pubkey', internalType: 'bytes', type: 'bytes' },
      { name: 'signature', internalType: 'bytes', type: 'bytes' },
      { name: 'depositDataRoot', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'stake',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [{ name: 'revertIfNoBalance', internalType: 'bool', type: 'bool' }],
    name: 'startCheckpoint',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'validatorPubkeyHash', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'validatorPubkeyHashToInfo',
    outputs: [
      {
        name: '',
        internalType: 'struct IEigenPodTypes.ValidatorInfo',
        type: 'tuple',
        components: [
          { name: 'validatorIndex', internalType: 'uint64', type: 'uint64' },
          {
            name: 'restakedBalanceGwei',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'lastCheckpointedAt',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'status',
            internalType: 'enum IEigenPodTypes.VALIDATOR_STATUS',
            type: 'uint8',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'validatorPubkey', internalType: 'bytes', type: 'bytes' }],
    name: 'validatorPubkeyToInfo',
    outputs: [
      {
        name: '',
        internalType: 'struct IEigenPodTypes.ValidatorInfo',
        type: 'tuple',
        components: [
          { name: 'validatorIndex', internalType: 'uint64', type: 'uint64' },
          {
            name: 'restakedBalanceGwei',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'lastCheckpointedAt',
            internalType: 'uint64',
            type: 'uint64',
          },
          {
            name: 'status',
            internalType: 'enum IEigenPodTypes.VALIDATOR_STATUS',
            type: 'uint8',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'validatorPubkey', internalType: 'bytes', type: 'bytes' }],
    name: 'validatorStatus',
    outputs: [
      {
        name: '',
        internalType: 'enum IEigenPodTypes.VALIDATOR_STATUS',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'pubkeyHash', internalType: 'bytes32', type: 'bytes32' }],
    name: 'validatorStatus',
    outputs: [
      {
        name: '',
        internalType: 'enum IEigenPodTypes.VALIDATOR_STATUS',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'balanceContainerProof',
        internalType: 'struct BeaconChainProofs.BalanceContainerProof',
        type: 'tuple',
        components: [
          {
            name: 'balanceContainerRoot',
            internalType: 'bytes32',
            type: 'bytes32',
          },
          { name: 'proof', internalType: 'bytes', type: 'bytes' },
        ],
      },
      {
        name: 'proofs',
        internalType: 'struct BeaconChainProofs.BalanceProof[]',
        type: 'tuple[]',
        components: [
          { name: 'pubkeyHash', internalType: 'bytes32', type: 'bytes32' },
          { name: 'balanceRoot', internalType: 'bytes32', type: 'bytes32' },
          { name: 'proof', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    name: 'verifyCheckpointProofs',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'beaconTimestamp', internalType: 'uint64', type: 'uint64' },
      {
        name: 'stateRootProof',
        internalType: 'struct BeaconChainProofs.StateRootProof',
        type: 'tuple',
        components: [
          { name: 'beaconStateRoot', internalType: 'bytes32', type: 'bytes32' },
          { name: 'proof', internalType: 'bytes', type: 'bytes' },
        ],
      },
      {
        name: 'proof',
        internalType: 'struct BeaconChainProofs.ValidatorProof',
        type: 'tuple',
        components: [
          {
            name: 'validatorFields',
            internalType: 'bytes32[]',
            type: 'bytes32[]',
          },
          { name: 'proof', internalType: 'bytes', type: 'bytes' },
        ],
      },
    ],
    name: 'verifyStaleBalance',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'beaconTimestamp', internalType: 'uint64', type: 'uint64' },
      {
        name: 'stateRootProof',
        internalType: 'struct BeaconChainProofs.StateRootProof',
        type: 'tuple',
        components: [
          { name: 'beaconStateRoot', internalType: 'bytes32', type: 'bytes32' },
          { name: 'proof', internalType: 'bytes', type: 'bytes' },
        ],
      },
      { name: 'validatorIndices', internalType: 'uint40[]', type: 'uint40[]' },
      {
        name: 'validatorFieldsProofs',
        internalType: 'bytes[]',
        type: 'bytes[]',
      },
      {
        name: 'validatorFields',
        internalType: 'bytes32[][]',
        type: 'bytes32[][]',
      },
    ],
    name: 'verifyWithdrawalCredentials',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'recipient', internalType: 'address', type: 'address' },
      { name: 'amountWei', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'withdrawRestakedBeaconChainETH',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'withdrawableRestakedExecutionLayerGwei',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'checkpointTimestamp',
        internalType: 'uint64',
        type: 'uint64',
        indexed: true,
      },
      {
        name: 'beaconBlockRoot',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'validatorCount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'CheckpointCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'checkpointTimestamp',
        internalType: 'uint64',
        type: 'uint64',
        indexed: true,
      },
      {
        name: 'totalShareDeltaWei',
        internalType: 'int256',
        type: 'int256',
        indexed: false,
      },
    ],
    name: 'CheckpointFinalized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'sourcePubkeyHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'targetPubkeyHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
    ],
    name: 'ConsolidationRequested',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'pubkeyHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
    ],
    name: 'EigenPodStaked',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'validatorPubkeyHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
    ],
    name: 'ExitRequested',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'version', internalType: 'uint8', type: 'uint8', indexed: false },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amountReceived',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'NonBeaconChainETHReceived',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'prevProofSubmitter',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'newProofSubmitter',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'ProofSubmitterUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'recipient',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'RestakedBeaconChainETHWithdrawn',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'validatorPubkeyHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
    ],
    name: 'SwitchToCompoundingRequested',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'pubkeyHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
      {
        name: 'balanceTimestamp',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
      {
        name: 'newValidatorBalanceGwei',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'ValidatorBalanceUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'checkpointTimestamp',
        internalType: 'uint64',
        type: 'uint64',
        indexed: true,
      },
      {
        name: 'pubkeyHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
    ],
    name: 'ValidatorCheckpointed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'pubkeyHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
    ],
    name: 'ValidatorRestaked',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'checkpointTimestamp',
        internalType: 'uint64',
        type: 'uint64',
        indexed: true,
      },
      {
        name: 'pubkeyHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
    ],
    name: 'ValidatorWithdrawn',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'validatorPubkeyHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'withdrawalAmountGwei',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'WithdrawalRequested',
  },
  { type: 'error', inputs: [], name: 'BeaconTimestampTooFarInPast' },
  { type: 'error', inputs: [], name: 'CannotCheckpointTwiceInSingleBlock' },
  { type: 'error', inputs: [], name: 'CheckpointAlreadyActive' },
  { type: 'error', inputs: [], name: 'CredentialsAlreadyVerified' },
  { type: 'error', inputs: [], name: 'CurrentlyPaused' },
  { type: 'error', inputs: [], name: 'EmptyRoot' },
  { type: 'error', inputs: [], name: 'FeeQueryFailed' },
  { type: 'error', inputs: [], name: 'ForkTimestampZero' },
  { type: 'error', inputs: [], name: 'InputAddressZero' },
  { type: 'error', inputs: [], name: 'InputArrayLengthMismatch' },
  { type: 'error', inputs: [], name: 'InsufficientFunds' },
  { type: 'error', inputs: [], name: 'InsufficientWithdrawableBalance' },
  { type: 'error', inputs: [], name: 'InvalidEIP4788Response' },
  { type: 'error', inputs: [], name: 'InvalidIndex' },
  { type: 'error', inputs: [], name: 'InvalidProof' },
  { type: 'error', inputs: [], name: 'InvalidProofLength' },
  { type: 'error', inputs: [], name: 'InvalidProofLength' },
  { type: 'error', inputs: [], name: 'InvalidPubKeyLength' },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  { type: 'error', inputs: [], name: 'InvalidValidatorFieldsLength' },
  { type: 'error', inputs: [], name: 'LeavesNotPowerOfTwo' },
  { type: 'error', inputs: [], name: 'MsgValueNot32ETH' },
  { type: 'error', inputs: [], name: 'NoActiveCheckpoint' },
  { type: 'error', inputs: [], name: 'NoBalanceToCheckpoint' },
  { type: 'error', inputs: [], name: 'NotEnoughLeaves' },
  { type: 'error', inputs: [], name: 'OnlyEigenPodManager' },
  { type: 'error', inputs: [], name: 'OnlyEigenPodOwner' },
  { type: 'error', inputs: [], name: 'OnlyEigenPodOwnerOrProofSubmitter' },
  { type: 'error', inputs: [], name: 'PredeployFailed' },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong',
  },
  { type: 'error', inputs: [], name: 'TimestampOutOfRange' },
  { type: 'error', inputs: [], name: 'ValidatorInactiveOnBeaconChain' },
  { type: 'error', inputs: [], name: 'ValidatorIsExitingBeaconChain' },
  { type: 'error', inputs: [], name: 'ValidatorNotActiveInPod' },
  { type: 'error', inputs: [], name: 'ValidatorNotSlashedOnBeaconChain' },
  { type: 'error', inputs: [], name: 'WithdrawalCredentialsNotForEigenPod' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// EigenPodManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const eigenPodManagerAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_ethPOS',
        internalType: 'contract IETHPOSDeposit',
        type: 'address',
      },
      {
        name: '_eigenPodBeacon',
        internalType: 'contract IBeacon',
        type: 'address',
      },
      {
        name: '_delegationManager',
        internalType: 'contract IDelegationManager',
        type: 'address',
      },
      {
        name: '_pauserRegistry',
        internalType: 'contract IPauserRegistry',
        type: 'address',
      },
      { name: '_version', internalType: 'string', type: 'string' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'addShares',
    outputs: [
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'beaconChainETHStrategy',
    outputs: [
      { name: '', internalType: 'contract IStrategy', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'podOwner', internalType: 'address', type: 'address' }],
    name: 'beaconChainSlashingFactor',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'burnableETHShares',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'createPod',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'delegationManager',
    outputs: [
      {
        name: '',
        internalType: 'contract IDelegationManager',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'eigenPodBeacon',
    outputs: [{ name: '', internalType: 'contract IBeacon', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'ethPOS',
    outputs: [
      { name: '', internalType: 'contract IETHPOSDeposit', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'podOwner', internalType: 'address', type: 'address' }],
    name: 'getPod',
    outputs: [
      { name: '', internalType: 'contract IEigenPod', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'podOwner', internalType: 'address', type: 'address' }],
    name: 'hasPod',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'contract IStrategy', type: 'address' },
      { name: 'addedSharesToBurn', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'increaseBurnOrRedistributableShares',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'initialOwner', internalType: 'address', type: 'address' },
      { name: '_initPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'numPods',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'podOwner', internalType: 'address', type: 'address' }],
    name: 'ownerToPod',
    outputs: [
      { name: '', internalType: 'contract IEigenPod', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauseAll',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'index', internalType: 'uint8', type: 'uint8' }],
    name: 'paused',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauserRegistry',
    outputs: [
      { name: '', internalType: 'contract IPauserRegistry', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pectraForkTimestamp',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'podOwner', internalType: 'address', type: 'address' }],
    name: 'podOwnerDepositShares',
    outputs: [{ name: 'shares', internalType: 'int256', type: 'int256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'proofTimestampSetter',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'podOwner', internalType: 'address', type: 'address' },
      {
        name: 'prevRestakedBalanceWei',
        internalType: 'uint256',
        type: 'uint256',
      },
      { name: 'balanceDeltaWei', internalType: 'int256', type: 'int256' },
    ],
    name: 'recordBeaconChainETHBalanceUpdate',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
      {
        name: 'depositSharesToRemove',
        internalType: 'uint256',
        type: 'uint256',
      },
    ],
    name: 'removeDepositShares',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'timestamp', internalType: 'uint64', type: 'uint64' }],
    name: 'setPectraForkTimestamp',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'newProofTimestampSetter',
        internalType: 'address',
        type: 'address',
      },
    ],
    name: 'setProofTimestampSetter',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'pubkey', internalType: 'bytes', type: 'bytes' },
      { name: 'signature', internalType: 'bytes', type: 'bytes' },
      { name: 'depositDataRoot', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'stake',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'user', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'stakerDepositShares',
    outputs: [
      { name: 'depositShares', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
      { name: '', internalType: 'contract IERC20', type: 'address' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'withdrawSharesAsTokens',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'podOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'BeaconChainETHDeposited',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'podOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      { name: 'nonce', internalType: 'uint96', type: 'uint96', indexed: false },
      {
        name: 'delegatedAddress',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'withdrawer',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'withdrawalRoot',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
    ],
    name: 'BeaconChainETHWithdrawalCompleted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'staker',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'prevBeaconChainSlashingFactor',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
      {
        name: 'newBeaconChainSlashingFactor',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'BeaconChainSlashingFactorDecreased',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'BurnableETHSharesIncreased',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'version', internalType: 'uint8', type: 'uint8', indexed: false },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'podOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newTotalShares',
        internalType: 'int256',
        type: 'int256',
        indexed: false,
      },
    ],
    name: 'NewTotalShares',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Paused',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newPectraForkTimestamp',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'PectraForkTimestampSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'eigenPod',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'podOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'PodDeployed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'podOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'sharesDelta',
        internalType: 'int256',
        type: 'int256',
        indexed: false,
      },
    ],
    name: 'PodSharesUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newProofTimestampSetter',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'ProofTimestampSetterSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Unpaused',
  },
  { type: 'error', inputs: [], name: 'CurrentlyPaused' },
  { type: 'error', inputs: [], name: 'EigenPodAlreadyExists' },
  { type: 'error', inputs: [], name: 'InputAddressZero' },
  { type: 'error', inputs: [], name: 'InvalidNewPausedStatus' },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  { type: 'error', inputs: [], name: 'InvalidStrategy' },
  { type: 'error', inputs: [], name: 'LegacyWithdrawalsNotCompleted' },
  { type: 'error', inputs: [], name: 'OnlyDelegationManager' },
  { type: 'error', inputs: [], name: 'OnlyEigenPod' },
  { type: 'error', inputs: [], name: 'OnlyPauser' },
  { type: 'error', inputs: [], name: 'OnlyProofTimestampSetter' },
  { type: 'error', inputs: [], name: 'OnlyUnpauser' },
  { type: 'error', inputs: [], name: 'SharesNegative' },
  { type: 'error', inputs: [], name: 'SharesNotMultipleOfGwei' },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Gateway
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const gatewayAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'beefyClient', internalType: 'address', type: 'address' },
      { name: 'agentExecutor', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'AGENT_EXECUTOR',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'BEEFY_CLIENT',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'agentID', internalType: 'bytes32', type: 'bytes32' }],
    name: 'agentOf',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'channelID', internalType: 'ChannelID', type: 'bytes32' }],
    name: 'channelNoncesOf',
    outputs: [
      { name: '', internalType: 'uint64', type: 'uint64' },
      { name: '', internalType: 'uint64', type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'channelID', internalType: 'ChannelID', type: 'bytes32' }],
    name: 'channelOperatingModeOf',
    outputs: [{ name: '', internalType: 'enum OperatingMode', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'depositEther',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'implementation',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'isTokenRegistered',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'operatingMode',
    outputs: [{ name: '', internalType: 'enum OperatingMode', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pricingParameters',
    outputs: [
      { name: '', internalType: 'UD60x18', type: 'uint256' },
      { name: '', internalType: 'uint128', type: 'uint128' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'queryForeignTokenID',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'quoteRegisterTokenFee',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'destinationChain', internalType: 'ParaID', type: 'uint32' },
      { name: 'destinationFee', internalType: 'uint128', type: 'uint128' },
    ],
    name: 'quoteSendTokenFee',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'registerToken',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'destinationChain', internalType: 'ParaID', type: 'uint32' },
      {
        name: 'destinationAddress',
        internalType: 'struct MultiAddress',
        type: 'tuple',
        components: [
          { name: 'kind', internalType: 'enum Kind', type: 'uint8' },
          { name: 'data', internalType: 'bytes', type: 'bytes' },
        ],
      },
      { name: 'destinationFee', internalType: 'uint128', type: 'uint128' },
      { name: 'amount', internalType: 'uint128', type: 'uint128' },
    ],
    name: 'sendToken',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'message',
        internalType: 'struct InboundMessage',
        type: 'tuple',
        components: [
          { name: 'channelID', internalType: 'ChannelID', type: 'bytes32' },
          { name: 'nonce', internalType: 'uint64', type: 'uint64' },
          { name: 'command', internalType: 'enum Command', type: 'uint8' },
          { name: 'params', internalType: 'bytes', type: 'bytes' },
          { name: 'maxDispatchGas', internalType: 'uint64', type: 'uint64' },
          { name: 'maxFeePerGas', internalType: 'uint256', type: 'uint256' },
          { name: 'reward', internalType: 'uint256', type: 'uint256' },
          { name: 'id', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
      { name: 'leafProof', internalType: 'bytes32[]', type: 'bytes32[]' },
      {
        name: 'headerProof',
        internalType: 'struct Verification.Proof',
        type: 'tuple',
        components: [
          {
            name: 'header',
            internalType: 'struct Verification.ParachainHeader',
            type: 'tuple',
            components: [
              { name: 'parentHash', internalType: 'bytes32', type: 'bytes32' },
              { name: 'number', internalType: 'uint256', type: 'uint256' },
              { name: 'stateRoot', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'extrinsicsRoot',
                internalType: 'bytes32',
                type: 'bytes32',
              },
              {
                name: 'digestItems',
                internalType: 'struct Verification.DigestItem[]',
                type: 'tuple[]',
                components: [
                  { name: 'kind', internalType: 'uint256', type: 'uint256' },
                  {
                    name: 'consensusEngineID',
                    internalType: 'bytes4',
                    type: 'bytes4',
                  },
                  { name: 'data', internalType: 'bytes', type: 'bytes' },
                ],
              },
            ],
          },
          {
            name: 'headProof',
            internalType: 'struct Verification.HeadProof',
            type: 'tuple',
            components: [
              { name: 'pos', internalType: 'uint256', type: 'uint256' },
              { name: 'width', internalType: 'uint256', type: 'uint256' },
              { name: 'proof', internalType: 'bytes32[]', type: 'bytes32[]' },
            ],
          },
          {
            name: 'leafPartial',
            internalType: 'struct Verification.MMRLeafPartial',
            type: 'tuple',
            components: [
              { name: 'version', internalType: 'uint8', type: 'uint8' },
              { name: 'parentNumber', internalType: 'uint32', type: 'uint32' },
              { name: 'parentHash', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'nextAuthoritySetID',
                internalType: 'uint64',
                type: 'uint64',
              },
              {
                name: 'nextAuthoritySetLen',
                internalType: 'uint32',
                type: 'uint32',
              },
              {
                name: 'nextAuthoritySetRoot',
                internalType: 'bytes32',
                type: 'bytes32',
              },
            ],
          },
          { name: 'leafProof', internalType: 'bytes32[]', type: 'bytes32[]' },
          { name: 'leafProofOrder', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    name: 'submitV1',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'tokenID', internalType: 'bytes32', type: 'bytes32' }],
    name: 'tokenAddressOf',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'v1_handleAgentExecute',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'channelID', internalType: 'ChannelID', type: 'bytes32' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'v1_handleMintForeignToken',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'v1_handleRegisterForeignToken',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'v1_handleSetOperatingMode',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'v1_handleSetPricingParameters',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'v1_handleSetTokenTransferFees',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'v1_handleUnlockNativeToken',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'v1_handleUpgrade',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'bytes32', type: 'bytes32' }],
    name: 'v2_createAgent',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'origin', internalType: 'bytes32', type: 'bytes32' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'v2_handleCallContract',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'v2_handleMintForeignToken',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'v2_handleRegisterForeignToken',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'v2_handleSetOperatingMode',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'v2_handleUnlockNativeToken',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes', type: 'bytes' }],
    name: 'v2_handleUpgrade',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'nonce', internalType: 'uint64', type: 'uint64' }],
    name: 'v2_isDispatched',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'v2_outboundNonce',
    outputs: [{ name: '', internalType: 'uint64', type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'network', internalType: 'uint8', type: 'uint8' },
      { name: 'executionFee', internalType: 'uint128', type: 'uint128' },
      { name: 'relayerFee', internalType: 'uint128', type: 'uint128' },
    ],
    name: 'v2_registerToken',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'message', internalType: 'bytes', type: 'bytes' },
      { name: 'assets', internalType: 'bytes[]', type: 'bytes[]' },
      { name: 'claimer', internalType: 'bytes', type: 'bytes' },
      { name: 'executionFee', internalType: 'uint128', type: 'uint128' },
      { name: 'relayerFee', internalType: 'uint128', type: 'uint128' },
    ],
    name: 'v2_sendMessage',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'message',
        internalType: 'struct InboundMessage',
        type: 'tuple',
        components: [
          { name: 'origin', internalType: 'bytes32', type: 'bytes32' },
          { name: 'nonce', internalType: 'uint64', type: 'uint64' },
          { name: 'topic', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'commands',
            internalType: 'struct Command[]',
            type: 'tuple[]',
            components: [
              { name: 'kind', internalType: 'uint8', type: 'uint8' },
              { name: 'gas', internalType: 'uint64', type: 'uint64' },
              { name: 'payload', internalType: 'bytes', type: 'bytes' },
            ],
          },
        ],
      },
      { name: 'messageProof', internalType: 'bytes32[]', type: 'bytes32[]' },
      {
        name: 'beefyProof',
        internalType: 'struct BeefyVerification.Proof',
        type: 'tuple',
        components: [
          {
            name: 'leafPartial',
            internalType: 'struct BeefyVerification.MMRLeafPartial',
            type: 'tuple',
            components: [
              { name: 'version', internalType: 'uint8', type: 'uint8' },
              { name: 'parentNumber', internalType: 'uint32', type: 'uint32' },
              { name: 'parentHash', internalType: 'bytes32', type: 'bytes32' },
              {
                name: 'nextAuthoritySetID',
                internalType: 'uint64',
                type: 'uint64',
              },
              {
                name: 'nextAuthoritySetLen',
                internalType: 'uint32',
                type: 'uint32',
              },
              {
                name: 'nextAuthoritySetRoot',
                internalType: 'bytes32',
                type: 'bytes32',
              },
            ],
          },
          { name: 'leafProof', internalType: 'bytes32[]', type: 'bytes32[]' },
          { name: 'leafProofOrder', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'rewardAddress', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'v2_submit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'agentID',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
      {
        name: 'agent',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'AgentCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'agentID',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'recipient',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'AgentFundsWithdrawn',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'nonce', internalType: 'uint64', type: 'uint64', indexed: true },
      {
        name: 'index',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'CommandFailed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Deposited',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'tokenID',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'token',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'ForeignTokenRegistered',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'channelID',
        internalType: 'ChannelID',
        type: 'bytes32',
        indexed: true,
      },
      { name: 'nonce', internalType: 'uint64', type: 'uint64', indexed: false },
      {
        name: 'messageID',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      { name: 'success', internalType: 'bool', type: 'bool', indexed: false },
    ],
    name: 'InboundMessageDispatched',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'nonce', internalType: 'uint64', type: 'uint64', indexed: true },
      {
        name: 'topic',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
      { name: 'success', internalType: 'bool', type: 'bool', indexed: false },
      {
        name: 'rewardAddress',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
    ],
    name: 'InboundMessageDispatched',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'mode',
        internalType: 'enum OperatingMode',
        type: 'uint8',
        indexed: false,
      },
    ],
    name: 'OperatingModeChanged',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'channelID',
        internalType: 'ChannelID',
        type: 'bytes32',
        indexed: true,
      },
      { name: 'nonce', internalType: 'uint64', type: 'uint64', indexed: false },
      {
        name: 'messageID',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      { name: 'payload', internalType: 'bytes', type: 'bytes', indexed: false },
    ],
    name: 'OutboundMessageAccepted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'nonce', internalType: 'uint64', type: 'uint64', indexed: false },
      {
        name: 'payload',
        internalType: 'struct Payload',
        type: 'tuple',
        components: [
          { name: 'origin', internalType: 'address', type: 'address' },
          {
            name: 'assets',
            internalType: 'struct Asset[]',
            type: 'tuple[]',
            components: [
              { name: 'kind', internalType: 'uint8', type: 'uint8' },
              { name: 'data', internalType: 'bytes', type: 'bytes' },
            ],
          },
          {
            name: 'message',
            internalType: 'struct Message',
            type: 'tuple',
            components: [
              { name: 'kind', internalType: 'uint8', type: 'uint8' },
              { name: 'data', internalType: 'bytes', type: 'bytes' },
            ],
          },
          { name: 'claimer', internalType: 'bytes', type: 'bytes' },
          { name: 'value', internalType: 'uint128', type: 'uint128' },
          { name: 'executionFee', internalType: 'uint128', type: 'uint128' },
          { name: 'relayerFee', internalType: 'uint128', type: 'uint128' },
        ],
        indexed: false,
      },
    ],
    name: 'OutboundMessageAccepted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [],
    name: 'PricingParametersChanged',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'token',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'TokenRegistrationSent',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'token',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'destinationChain',
        internalType: 'ParaID',
        type: 'uint32',
        indexed: true,
      },
      {
        name: 'destinationAddress',
        internalType: 'struct MultiAddress',
        type: 'tuple',
        components: [
          { name: 'kind', internalType: 'enum Kind', type: 'uint8' },
          { name: 'data', internalType: 'bytes', type: 'bytes' },
        ],
        indexed: false,
      },
      {
        name: 'amount',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
    ],
    name: 'TokenSent',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [],
    name: 'TokenTransferFeesChanged',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'implementation',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'Upgraded',
  },
  { type: 'error', inputs: [], name: 'AgentAlreadyExists' },
  { type: 'error', inputs: [], name: 'AgentDoesNotExist' },
  {
    type: 'error',
    inputs: [{ name: 'returndata', internalType: 'bytes', type: 'bytes' }],
    name: 'AgentExecutionFailed',
  },
  { type: 'error', inputs: [], name: 'AlreadyInitialized' },
  { type: 'error', inputs: [], name: 'ChannelDoesNotExist' },
  { type: 'error', inputs: [], name: 'Disabled' },
  { type: 'error', inputs: [], name: 'ExceededMaximumValue' },
  { type: 'error', inputs: [], name: 'InsufficientEther' },
  { type: 'error', inputs: [], name: 'InsufficientGasLimit' },
  { type: 'error', inputs: [], name: 'InsufficientValue' },
  { type: 'error', inputs: [], name: 'InvalidAgentExecutionPayload' },
  { type: 'error', inputs: [], name: 'InvalidAmount' },
  { type: 'error', inputs: [], name: 'InvalidAmount' },
  { type: 'error', inputs: [], name: 'InvalidAsset' },
  { type: 'error', inputs: [], name: 'InvalidChannelUpdate' },
  { type: 'error', inputs: [], name: 'InvalidCodeHash' },
  { type: 'error', inputs: [], name: 'InvalidConstructorParams' },
  { type: 'error', inputs: [], name: 'InvalidContract' },
  { type: 'error', inputs: [], name: 'InvalidDestination' },
  { type: 'error', inputs: [], name: 'InvalidDestinationFee' },
  { type: 'error', inputs: [], name: 'InvalidNetwork' },
  { type: 'error', inputs: [], name: 'InvalidNonce' },
  { type: 'error', inputs: [], name: 'InvalidProof' },
  { type: 'error', inputs: [], name: 'InvalidToken' },
  { type: 'error', inputs: [], name: 'InvalidToken' },
  { type: 'error', inputs: [], name: 'NativeTransferFailed' },
  { type: 'error', inputs: [], name: 'NotEnoughGas' },
  { type: 'error', inputs: [], name: 'ShouldNotReachHere' },
  { type: 'error', inputs: [], name: 'TokenAlreadyRegistered' },
  { type: 'error', inputs: [], name: 'TokenMintFailed' },
  { type: 'error', inputs: [], name: 'TokenNotRegistered' },
  { type: 'error', inputs: [], name: 'TokenTransferFailed' },
  { type: 'error', inputs: [], name: 'TokenTransferFailed' },
  { type: 'error', inputs: [], name: 'TooManyAssets' },
  { type: 'error', inputs: [], name: 'Unauthorized' },
  { type: 'error', inputs: [], name: 'Unsupported' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IETHPOSDeposit
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const iethposDepositAbi = [
  {
    type: 'function',
    inputs: [
      { name: 'pubkey', internalType: 'bytes', type: 'bytes' },
      { name: 'withdrawal_credentials', internalType: 'bytes', type: 'bytes' },
      { name: 'signature', internalType: 'bytes', type: 'bytes' },
      { name: 'deposit_data_root', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'get_deposit_count',
    outputs: [{ name: '', internalType: 'bytes', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'get_deposit_root',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'pubkey', internalType: 'bytes', type: 'bytes', indexed: false },
      {
        name: 'withdrawal_credentials',
        internalType: 'bytes',
        type: 'bytes',
        indexed: false,
      },
      { name: 'amount', internalType: 'bytes', type: 'bytes', indexed: false },
      {
        name: 'signature',
        internalType: 'bytes',
        type: 'bytes',
        indexed: false,
      },
      { name: 'index', internalType: 'bytes', type: 'bytes', indexed: false },
    ],
    name: 'DepositEvent',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ITransparentUpgradeableProxy
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const iTransparentUpgradeableProxyAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'admin',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'changeAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'implementation',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'upgradeTo',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'upgradeToAndCall',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousAdmin',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'newAdmin',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'AdminChanged',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'beacon',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'BeaconUpgraded',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'implementation',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'Upgraded',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// PermissionController
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const permissionControllerAbi = [
  {
    type: 'constructor',
    inputs: [{ name: '_version', internalType: 'string', type: 'string' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'acceptAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'admin', internalType: 'address', type: 'address' },
    ],
    name: 'addPendingAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'caller', internalType: 'address', type: 'address' },
      { name: 'target', internalType: 'address', type: 'address' },
      { name: 'selector', internalType: 'bytes4', type: 'bytes4' },
    ],
    name: 'canCall',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'getAdmins',
    outputs: [{ name: '', internalType: 'address[]', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'appointee', internalType: 'address', type: 'address' },
    ],
    name: 'getAppointeePermissions',
    outputs: [
      { name: '', internalType: 'address[]', type: 'address[]' },
      { name: '', internalType: 'bytes4[]', type: 'bytes4[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'target', internalType: 'address', type: 'address' },
      { name: 'selector', internalType: 'bytes4', type: 'bytes4' },
    ],
    name: 'getAppointees',
    outputs: [{ name: '', internalType: 'address[]', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'getPendingAdmins',
    outputs: [{ name: '', internalType: 'address[]', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'caller', internalType: 'address', type: 'address' },
    ],
    name: 'isAdmin',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'pendingAdmin', internalType: 'address', type: 'address' },
    ],
    name: 'isPendingAdmin',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'admin', internalType: 'address', type: 'address' },
    ],
    name: 'removeAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'appointee', internalType: 'address', type: 'address' },
      { name: 'target', internalType: 'address', type: 'address' },
      { name: 'selector', internalType: 'bytes4', type: 'bytes4' },
    ],
    name: 'removeAppointee',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'admin', internalType: 'address', type: 'address' },
    ],
    name: 'removePendingAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'appointee', internalType: 'address', type: 'address' },
      { name: 'target', internalType: 'address', type: 'address' },
      { name: 'selector', internalType: 'bytes4', type: 'bytes4' },
    ],
    name: 'setAppointee',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'admin',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'AdminRemoved',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'admin',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'AdminSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'appointee',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'target',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'selector',
        internalType: 'bytes4',
        type: 'bytes4',
        indexed: false,
      },
    ],
    name: 'AppointeeRemoved',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'appointee',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'target',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'selector',
        internalType: 'bytes4',
        type: 'bytes4',
        indexed: false,
      },
    ],
    name: 'AppointeeSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'version', internalType: 'uint8', type: 'uint8', indexed: false },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'admin',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'PendingAdminAdded',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'admin',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'PendingAdminRemoved',
  },
  { type: 'error', inputs: [], name: 'AdminAlreadyPending' },
  { type: 'error', inputs: [], name: 'AdminAlreadySet' },
  { type: 'error', inputs: [], name: 'AdminNotPending' },
  { type: 'error', inputs: [], name: 'AdminNotSet' },
  { type: 'error', inputs: [], name: 'AppointeeAlreadySet' },
  { type: 'error', inputs: [], name: 'AppointeeNotSet' },
  { type: 'error', inputs: [], name: 'CannotHaveZeroAdmins' },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  { type: 'error', inputs: [], name: 'NotAdmin' },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// RewardsCoordinator
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const rewardsCoordinatorAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'params',
        internalType:
          'struct IRewardsCoordinatorTypes.RewardsCoordinatorConstructorParams',
        type: 'tuple',
        components: [
          {
            name: 'delegationManager',
            internalType: 'contract IDelegationManager',
            type: 'address',
          },
          {
            name: 'strategyManager',
            internalType: 'contract IStrategyManager',
            type: 'address',
          },
          {
            name: 'allocationManager',
            internalType: 'contract IAllocationManager',
            type: 'address',
          },
          {
            name: 'pauserRegistry',
            internalType: 'contract IPauserRegistry',
            type: 'address',
          },
          {
            name: 'permissionController',
            internalType: 'contract IPermissionController',
            type: 'address',
          },
          {
            name: 'CALCULATION_INTERVAL_SECONDS',
            internalType: 'uint32',
            type: 'uint32',
          },
          {
            name: 'MAX_REWARDS_DURATION',
            internalType: 'uint32',
            type: 'uint32',
          },
          {
            name: 'MAX_RETROACTIVE_LENGTH',
            internalType: 'uint32',
            type: 'uint32',
          },
          { name: 'MAX_FUTURE_LENGTH', internalType: 'uint32', type: 'uint32' },
          {
            name: 'GENESIS_REWARDS_TIMESTAMP',
            internalType: 'uint32',
            type: 'uint32',
          },
          { name: 'version', internalType: 'string', type: 'string' },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'CALCULATION_INTERVAL_SECONDS',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'GENESIS_REWARDS_TIMESTAMP',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_FUTURE_LENGTH',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_RETROACTIVE_LENGTH',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'MAX_REWARDS_DURATION',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'activationDelay',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'allocationManager',
    outputs: [
      {
        name: '',
        internalType: 'contract IAllocationManager',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'beaconChainETHStrategy',
    outputs: [
      { name: '', internalType: 'contract IStrategy', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'leaf',
        internalType: 'struct IRewardsCoordinatorTypes.EarnerTreeMerkleLeaf',
        type: 'tuple',
        components: [
          { name: 'earner', internalType: 'address', type: 'address' },
          { name: 'earnerTokenRoot', internalType: 'bytes32', type: 'bytes32' },
        ],
      },
    ],
    name: 'calculateEarnerLeafHash',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'leaf',
        internalType: 'struct IRewardsCoordinatorTypes.TokenTreeMerkleLeaf',
        type: 'tuple',
        components: [
          { name: 'token', internalType: 'contract IERC20', type: 'address' },
          {
            name: 'cumulativeEarnings',
            internalType: 'uint256',
            type: 'uint256',
          },
        ],
      },
    ],
    name: 'calculateTokenLeafHash',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'claim',
        internalType: 'struct IRewardsCoordinatorTypes.RewardsMerkleClaim',
        type: 'tuple',
        components: [
          { name: 'rootIndex', internalType: 'uint32', type: 'uint32' },
          { name: 'earnerIndex', internalType: 'uint32', type: 'uint32' },
          { name: 'earnerTreeProof', internalType: 'bytes', type: 'bytes' },
          {
            name: 'earnerLeaf',
            internalType:
              'struct IRewardsCoordinatorTypes.EarnerTreeMerkleLeaf',
            type: 'tuple',
            components: [
              { name: 'earner', internalType: 'address', type: 'address' },
              {
                name: 'earnerTokenRoot',
                internalType: 'bytes32',
                type: 'bytes32',
              },
            ],
          },
          { name: 'tokenIndices', internalType: 'uint32[]', type: 'uint32[]' },
          { name: 'tokenTreeProofs', internalType: 'bytes[]', type: 'bytes[]' },
          {
            name: 'tokenLeaves',
            internalType:
              'struct IRewardsCoordinatorTypes.TokenTreeMerkleLeaf[]',
            type: 'tuple[]',
            components: [
              {
                name: 'token',
                internalType: 'contract IERC20',
                type: 'address',
              },
              {
                name: 'cumulativeEarnings',
                internalType: 'uint256',
                type: 'uint256',
              },
            ],
          },
        ],
      },
    ],
    name: 'checkClaim',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'earner', internalType: 'address', type: 'address' }],
    name: 'claimerFor',
    outputs: [{ name: 'claimer', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'rewardsSubmissions',
        internalType: 'struct IRewardsCoordinatorTypes.RewardsSubmission[]',
        type: 'tuple[]',
        components: [
          {
            name: 'strategiesAndMultipliers',
            internalType:
              'struct IRewardsCoordinatorTypes.StrategyAndMultiplier[]',
            type: 'tuple[]',
            components: [
              {
                name: 'strategy',
                internalType: 'contract IStrategy',
                type: 'address',
              },
              { name: 'multiplier', internalType: 'uint96', type: 'uint96' },
            ],
          },
          { name: 'token', internalType: 'contract IERC20', type: 'address' },
          { name: 'amount', internalType: 'uint256', type: 'uint256' },
          { name: 'startTimestamp', internalType: 'uint32', type: 'uint32' },
          { name: 'duration', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'createAVSRewardsSubmission',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      {
        name: 'operatorDirectedRewardsSubmissions',
        internalType:
          'struct IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[]',
        type: 'tuple[]',
        components: [
          {
            name: 'strategiesAndMultipliers',
            internalType:
              'struct IRewardsCoordinatorTypes.StrategyAndMultiplier[]',
            type: 'tuple[]',
            components: [
              {
                name: 'strategy',
                internalType: 'contract IStrategy',
                type: 'address',
              },
              { name: 'multiplier', internalType: 'uint96', type: 'uint96' },
            ],
          },
          { name: 'token', internalType: 'contract IERC20', type: 'address' },
          {
            name: 'operatorRewards',
            internalType: 'struct IRewardsCoordinatorTypes.OperatorReward[]',
            type: 'tuple[]',
            components: [
              { name: 'operator', internalType: 'address', type: 'address' },
              { name: 'amount', internalType: 'uint256', type: 'uint256' },
            ],
          },
          { name: 'startTimestamp', internalType: 'uint32', type: 'uint32' },
          { name: 'duration', internalType: 'uint32', type: 'uint32' },
          { name: 'description', internalType: 'string', type: 'string' },
        ],
      },
    ],
    name: 'createOperatorDirectedAVSRewardsSubmission',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      {
        name: 'operatorDirectedRewardsSubmissions',
        internalType:
          'struct IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission[]',
        type: 'tuple[]',
        components: [
          {
            name: 'strategiesAndMultipliers',
            internalType:
              'struct IRewardsCoordinatorTypes.StrategyAndMultiplier[]',
            type: 'tuple[]',
            components: [
              {
                name: 'strategy',
                internalType: 'contract IStrategy',
                type: 'address',
              },
              { name: 'multiplier', internalType: 'uint96', type: 'uint96' },
            ],
          },
          { name: 'token', internalType: 'contract IERC20', type: 'address' },
          {
            name: 'operatorRewards',
            internalType: 'struct IRewardsCoordinatorTypes.OperatorReward[]',
            type: 'tuple[]',
            components: [
              { name: 'operator', internalType: 'address', type: 'address' },
              { name: 'amount', internalType: 'uint256', type: 'uint256' },
            ],
          },
          { name: 'startTimestamp', internalType: 'uint32', type: 'uint32' },
          { name: 'duration', internalType: 'uint32', type: 'uint32' },
          { name: 'description', internalType: 'string', type: 'string' },
        ],
      },
    ],
    name: 'createOperatorDirectedOperatorSetRewardsSubmission',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'rewardsSubmissions',
        internalType: 'struct IRewardsCoordinatorTypes.RewardsSubmission[]',
        type: 'tuple[]',
        components: [
          {
            name: 'strategiesAndMultipliers',
            internalType:
              'struct IRewardsCoordinatorTypes.StrategyAndMultiplier[]',
            type: 'tuple[]',
            components: [
              {
                name: 'strategy',
                internalType: 'contract IStrategy',
                type: 'address',
              },
              { name: 'multiplier', internalType: 'uint96', type: 'uint96' },
            ],
          },
          { name: 'token', internalType: 'contract IERC20', type: 'address' },
          { name: 'amount', internalType: 'uint256', type: 'uint256' },
          { name: 'startTimestamp', internalType: 'uint32', type: 'uint32' },
          { name: 'duration', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'createRewardsForAllEarners',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'rewardsSubmissions',
        internalType: 'struct IRewardsCoordinatorTypes.RewardsSubmission[]',
        type: 'tuple[]',
        components: [
          {
            name: 'strategiesAndMultipliers',
            internalType:
              'struct IRewardsCoordinatorTypes.StrategyAndMultiplier[]',
            type: 'tuple[]',
            components: [
              {
                name: 'strategy',
                internalType: 'contract IStrategy',
                type: 'address',
              },
              { name: 'multiplier', internalType: 'uint96', type: 'uint96' },
            ],
          },
          { name: 'token', internalType: 'contract IERC20', type: 'address' },
          { name: 'amount', internalType: 'uint256', type: 'uint256' },
          { name: 'startTimestamp', internalType: 'uint32', type: 'uint32' },
          { name: 'duration', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'createRewardsForAllSubmission',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'earner', internalType: 'address', type: 'address' },
      { name: 'token', internalType: 'contract IERC20', type: 'address' },
    ],
    name: 'cumulativeClaimed',
    outputs: [
      { name: 'totalClaimed', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'currRewardsCalculationEndTimestamp',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'defaultOperatorSplitBips',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'delegationManager',
    outputs: [
      {
        name: '',
        internalType: 'contract IDelegationManager',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'rootIndex', internalType: 'uint32', type: 'uint32' }],
    name: 'disableRoot',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCurrentClaimableDistributionRoot',
    outputs: [
      {
        name: '',
        internalType: 'struct IRewardsCoordinatorTypes.DistributionRoot',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'rewardsCalculationEndTimestamp',
            internalType: 'uint32',
            type: 'uint32',
          },
          { name: 'activatedAt', internalType: 'uint32', type: 'uint32' },
          { name: 'disabled', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCurrentDistributionRoot',
    outputs: [
      {
        name: '',
        internalType: 'struct IRewardsCoordinatorTypes.DistributionRoot',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'rewardsCalculationEndTimestamp',
            internalType: 'uint32',
            type: 'uint32',
          },
          { name: 'activatedAt', internalType: 'uint32', type: 'uint32' },
          { name: 'disabled', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'index', internalType: 'uint256', type: 'uint256' }],
    name: 'getDistributionRootAtIndex',
    outputs: [
      {
        name: '',
        internalType: 'struct IRewardsCoordinatorTypes.DistributionRoot',
        type: 'tuple',
        components: [
          { name: 'root', internalType: 'bytes32', type: 'bytes32' },
          {
            name: 'rewardsCalculationEndTimestamp',
            internalType: 'uint32',
            type: 'uint32',
          },
          { name: 'activatedAt', internalType: 'uint32', type: 'uint32' },
          { name: 'disabled', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getDistributionRootsLength',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'avs', internalType: 'address', type: 'address' },
    ],
    name: 'getOperatorAVSSplit',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'getOperatorPISplit',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'getOperatorSetSplit',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'rootHash', internalType: 'bytes32', type: 'bytes32' }],
    name: 'getRootIndexFromHash',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'initialOwner', internalType: 'address', type: 'address' },
      { name: 'initialPausedStatus', internalType: 'uint256', type: 'uint256' },
      { name: '_rewardsUpdater', internalType: 'address', type: 'address' },
      { name: '_activationDelay', internalType: 'uint32', type: 'uint32' },
      { name: '_defaultSplitBips', internalType: 'uint16', type: 'uint16' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      { name: 'hash', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'isAVSRewardsSubmissionHash',
    outputs: [{ name: 'valid', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      { name: 'hash', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'isOperatorDirectedAVSRewardsSubmissionHash',
    outputs: [{ name: 'valid', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      { name: 'hash', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'isOperatorDirectedOperatorSetRewardsSubmissionHash',
    outputs: [{ name: 'valid', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'submitter', internalType: 'address', type: 'address' }],
    name: 'isRewardsForAllSubmitter',
    outputs: [{ name: 'valid', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      { name: 'hash', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'isRewardsSubmissionForAllEarnersHash',
    outputs: [{ name: 'valid', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address' },
      { name: 'hash', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'isRewardsSubmissionForAllHash',
    outputs: [{ name: 'valid', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauseAll',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'index', internalType: 'uint8', type: 'uint8' }],
    name: 'paused',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauserRegistry',
    outputs: [
      { name: '', internalType: 'contract IPauserRegistry', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'permissionController',
    outputs: [
      {
        name: '',
        internalType: 'contract IPermissionController',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'claim',
        internalType: 'struct IRewardsCoordinatorTypes.RewardsMerkleClaim',
        type: 'tuple',
        components: [
          { name: 'rootIndex', internalType: 'uint32', type: 'uint32' },
          { name: 'earnerIndex', internalType: 'uint32', type: 'uint32' },
          { name: 'earnerTreeProof', internalType: 'bytes', type: 'bytes' },
          {
            name: 'earnerLeaf',
            internalType:
              'struct IRewardsCoordinatorTypes.EarnerTreeMerkleLeaf',
            type: 'tuple',
            components: [
              { name: 'earner', internalType: 'address', type: 'address' },
              {
                name: 'earnerTokenRoot',
                internalType: 'bytes32',
                type: 'bytes32',
              },
            ],
          },
          { name: 'tokenIndices', internalType: 'uint32[]', type: 'uint32[]' },
          { name: 'tokenTreeProofs', internalType: 'bytes[]', type: 'bytes[]' },
          {
            name: 'tokenLeaves',
            internalType:
              'struct IRewardsCoordinatorTypes.TokenTreeMerkleLeaf[]',
            type: 'tuple[]',
            components: [
              {
                name: 'token',
                internalType: 'contract IERC20',
                type: 'address',
              },
              {
                name: 'cumulativeEarnings',
                internalType: 'uint256',
                type: 'uint256',
              },
            ],
          },
        ],
      },
      { name: 'recipient', internalType: 'address', type: 'address' },
    ],
    name: 'processClaim',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'claims',
        internalType: 'struct IRewardsCoordinatorTypes.RewardsMerkleClaim[]',
        type: 'tuple[]',
        components: [
          { name: 'rootIndex', internalType: 'uint32', type: 'uint32' },
          { name: 'earnerIndex', internalType: 'uint32', type: 'uint32' },
          { name: 'earnerTreeProof', internalType: 'bytes', type: 'bytes' },
          {
            name: 'earnerLeaf',
            internalType:
              'struct IRewardsCoordinatorTypes.EarnerTreeMerkleLeaf',
            type: 'tuple',
            components: [
              { name: 'earner', internalType: 'address', type: 'address' },
              {
                name: 'earnerTokenRoot',
                internalType: 'bytes32',
                type: 'bytes32',
              },
            ],
          },
          { name: 'tokenIndices', internalType: 'uint32[]', type: 'uint32[]' },
          { name: 'tokenTreeProofs', internalType: 'bytes[]', type: 'bytes[]' },
          {
            name: 'tokenLeaves',
            internalType:
              'struct IRewardsCoordinatorTypes.TokenTreeMerkleLeaf[]',
            type: 'tuple[]',
            components: [
              {
                name: 'token',
                internalType: 'contract IERC20',
                type: 'address',
              },
              {
                name: 'cumulativeEarnings',
                internalType: 'uint256',
                type: 'uint256',
              },
            ],
          },
        ],
      },
      { name: 'recipient', internalType: 'address', type: 'address' },
    ],
    name: 'processClaims',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'rewardsUpdater',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '_activationDelay', internalType: 'uint32', type: 'uint32' },
    ],
    name: 'setActivationDelay',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'claimer', internalType: 'address', type: 'address' }],
    name: 'setClaimerFor',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'earner', internalType: 'address', type: 'address' },
      { name: 'claimer', internalType: 'address', type: 'address' },
    ],
    name: 'setClaimerFor',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'split', internalType: 'uint16', type: 'uint16' }],
    name: 'setDefaultOperatorSplit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'avs', internalType: 'address', type: 'address' },
      { name: 'split', internalType: 'uint16', type: 'uint16' },
    ],
    name: 'setOperatorAVSSplit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'split', internalType: 'uint16', type: 'uint16' },
    ],
    name: 'setOperatorPISplit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: 'split', internalType: 'uint16', type: 'uint16' },
    ],
    name: 'setOperatorSetSplit',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '_submitter', internalType: 'address', type: 'address' },
      { name: '_newValue', internalType: 'bool', type: 'bool' },
    ],
    name: 'setRewardsForAllSubmitter',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '_rewardsUpdater', internalType: 'address', type: 'address' },
    ],
    name: 'setRewardsUpdater',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'strategyManager',
    outputs: [
      { name: '', internalType: 'contract IStrategyManager', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'avs', internalType: 'address', type: 'address' }],
    name: 'submissionNonce',
    outputs: [{ name: 'nonce', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'root', internalType: 'bytes32', type: 'bytes32' },
      {
        name: 'rewardsCalculationEndTimestamp',
        internalType: 'uint32',
        type: 'uint32',
      },
    ],
    name: 'submitRoot',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'avs', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'submissionNonce',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'rewardsSubmissionHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'rewardsSubmission',
        internalType: 'struct IRewardsCoordinatorTypes.RewardsSubmission',
        type: 'tuple',
        components: [
          {
            name: 'strategiesAndMultipliers',
            internalType:
              'struct IRewardsCoordinatorTypes.StrategyAndMultiplier[]',
            type: 'tuple[]',
            components: [
              {
                name: 'strategy',
                internalType: 'contract IStrategy',
                type: 'address',
              },
              { name: 'multiplier', internalType: 'uint96', type: 'uint96' },
            ],
          },
          { name: 'token', internalType: 'contract IERC20', type: 'address' },
          { name: 'amount', internalType: 'uint256', type: 'uint256' },
          { name: 'startTimestamp', internalType: 'uint32', type: 'uint32' },
          { name: 'duration', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
    ],
    name: 'AVSRewardsSubmissionCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'oldActivationDelay',
        internalType: 'uint32',
        type: 'uint32',
        indexed: false,
      },
      {
        name: 'newActivationDelay',
        internalType: 'uint32',
        type: 'uint32',
        indexed: false,
      },
    ],
    name: 'ActivationDelaySet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'earner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'oldClaimer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'claimer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'ClaimerForSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'oldDefaultOperatorSplitBips',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
      {
        name: 'newDefaultOperatorSplitBips',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
    ],
    name: 'DefaultOperatorSplitBipsSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'rootIndex',
        internalType: 'uint32',
        type: 'uint32',
        indexed: true,
      },
    ],
    name: 'DistributionRootDisabled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'rootIndex',
        internalType: 'uint32',
        type: 'uint32',
        indexed: true,
      },
      { name: 'root', internalType: 'bytes32', type: 'bytes32', indexed: true },
      {
        name: 'rewardsCalculationEndTimestamp',
        internalType: 'uint32',
        type: 'uint32',
        indexed: true,
      },
      {
        name: 'activatedAt',
        internalType: 'uint32',
        type: 'uint32',
        indexed: false,
      },
    ],
    name: 'DistributionRootSubmitted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'version', internalType: 'uint8', type: 'uint8', indexed: false },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'caller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'avs', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'activatedAt',
        internalType: 'uint32',
        type: 'uint32',
        indexed: false,
      },
      {
        name: 'oldOperatorAVSSplitBips',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
      {
        name: 'newOperatorAVSSplitBips',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
    ],
    name: 'OperatorAVSSplitBipsSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'caller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'avs', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'operatorDirectedRewardsSubmissionHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'submissionNonce',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'operatorDirectedRewardsSubmission',
        internalType:
          'struct IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission',
        type: 'tuple',
        components: [
          {
            name: 'strategiesAndMultipliers',
            internalType:
              'struct IRewardsCoordinatorTypes.StrategyAndMultiplier[]',
            type: 'tuple[]',
            components: [
              {
                name: 'strategy',
                internalType: 'contract IStrategy',
                type: 'address',
              },
              { name: 'multiplier', internalType: 'uint96', type: 'uint96' },
            ],
          },
          { name: 'token', internalType: 'contract IERC20', type: 'address' },
          {
            name: 'operatorRewards',
            internalType: 'struct IRewardsCoordinatorTypes.OperatorReward[]',
            type: 'tuple[]',
            components: [
              { name: 'operator', internalType: 'address', type: 'address' },
              { name: 'amount', internalType: 'uint256', type: 'uint256' },
            ],
          },
          { name: 'startTimestamp', internalType: 'uint32', type: 'uint32' },
          { name: 'duration', internalType: 'uint32', type: 'uint32' },
          { name: 'description', internalType: 'string', type: 'string' },
        ],
        indexed: false,
      },
    ],
    name: 'OperatorDirectedAVSRewardsSubmissionCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'caller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operatorDirectedRewardsSubmissionHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
      {
        name: 'submissionNonce',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'operatorDirectedRewardsSubmission',
        internalType:
          'struct IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission',
        type: 'tuple',
        components: [
          {
            name: 'strategiesAndMultipliers',
            internalType:
              'struct IRewardsCoordinatorTypes.StrategyAndMultiplier[]',
            type: 'tuple[]',
            components: [
              {
                name: 'strategy',
                internalType: 'contract IStrategy',
                type: 'address',
              },
              { name: 'multiplier', internalType: 'uint96', type: 'uint96' },
            ],
          },
          { name: 'token', internalType: 'contract IERC20', type: 'address' },
          {
            name: 'operatorRewards',
            internalType: 'struct IRewardsCoordinatorTypes.OperatorReward[]',
            type: 'tuple[]',
            components: [
              { name: 'operator', internalType: 'address', type: 'address' },
              { name: 'amount', internalType: 'uint256', type: 'uint256' },
            ],
          },
          { name: 'startTimestamp', internalType: 'uint32', type: 'uint32' },
          { name: 'duration', internalType: 'uint32', type: 'uint32' },
          { name: 'description', internalType: 'string', type: 'string' },
        ],
        indexed: false,
      },
    ],
    name: 'OperatorDirectedOperatorSetRewardsSubmissionCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'caller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'activatedAt',
        internalType: 'uint32',
        type: 'uint32',
        indexed: false,
      },
      {
        name: 'oldOperatorPISplitBips',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
      {
        name: 'newOperatorPISplitBips',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
    ],
    name: 'OperatorPISplitBipsSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'caller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
      {
        name: 'activatedAt',
        internalType: 'uint32',
        type: 'uint32',
        indexed: false,
      },
      {
        name: 'oldOperatorSetSplitBips',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
      {
        name: 'newOperatorSetSplitBips',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
    ],
    name: 'OperatorSetSplitBipsSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Paused',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'root',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: false,
      },
      {
        name: 'earner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'claimer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'recipient',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'token',
        internalType: 'contract IERC20',
        type: 'address',
        indexed: false,
      },
      {
        name: 'claimedAmount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'RewardsClaimed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'rewardsForAllSubmitter',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'oldValue', internalType: 'bool', type: 'bool', indexed: true },
      { name: 'newValue', internalType: 'bool', type: 'bool', indexed: true },
    ],
    name: 'RewardsForAllSubmitterSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'submitter',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'submissionNonce',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'rewardsSubmissionHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'rewardsSubmission',
        internalType: 'struct IRewardsCoordinatorTypes.RewardsSubmission',
        type: 'tuple',
        components: [
          {
            name: 'strategiesAndMultipliers',
            internalType:
              'struct IRewardsCoordinatorTypes.StrategyAndMultiplier[]',
            type: 'tuple[]',
            components: [
              {
                name: 'strategy',
                internalType: 'contract IStrategy',
                type: 'address',
              },
              { name: 'multiplier', internalType: 'uint96', type: 'uint96' },
            ],
          },
          { name: 'token', internalType: 'contract IERC20', type: 'address' },
          { name: 'amount', internalType: 'uint256', type: 'uint256' },
          { name: 'startTimestamp', internalType: 'uint32', type: 'uint32' },
          { name: 'duration', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
    ],
    name: 'RewardsSubmissionForAllCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'tokenHopper',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'submissionNonce',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'rewardsSubmissionHash',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'rewardsSubmission',
        internalType: 'struct IRewardsCoordinatorTypes.RewardsSubmission',
        type: 'tuple',
        components: [
          {
            name: 'strategiesAndMultipliers',
            internalType:
              'struct IRewardsCoordinatorTypes.StrategyAndMultiplier[]',
            type: 'tuple[]',
            components: [
              {
                name: 'strategy',
                internalType: 'contract IStrategy',
                type: 'address',
              },
              { name: 'multiplier', internalType: 'uint96', type: 'uint96' },
            ],
          },
          { name: 'token', internalType: 'contract IERC20', type: 'address' },
          { name: 'amount', internalType: 'uint256', type: 'uint256' },
          { name: 'startTimestamp', internalType: 'uint32', type: 'uint32' },
          { name: 'duration', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
    ],
    name: 'RewardsSubmissionForAllEarnersCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'oldRewardsUpdater',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newRewardsUpdater',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'RewardsUpdaterSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Unpaused',
  },
  { type: 'error', inputs: [], name: 'AmountExceedsMax' },
  { type: 'error', inputs: [], name: 'AmountIsZero' },
  { type: 'error', inputs: [], name: 'CurrentlyPaused' },
  { type: 'error', inputs: [], name: 'DurationExceedsMax' },
  { type: 'error', inputs: [], name: 'DurationIsZero' },
  { type: 'error', inputs: [], name: 'EarningsNotGreaterThanClaimed' },
  { type: 'error', inputs: [], name: 'EmptyRoot' },
  { type: 'error', inputs: [], name: 'InputAddressZero' },
  { type: 'error', inputs: [], name: 'InputArrayLengthMismatch' },
  { type: 'error', inputs: [], name: 'InputArrayLengthZero' },
  { type: 'error', inputs: [], name: 'InvalidAddressZero' },
  {
    type: 'error',
    inputs: [],
    name: 'InvalidCalculationIntervalSecondsRemainder',
  },
  { type: 'error', inputs: [], name: 'InvalidClaimProof' },
  { type: 'error', inputs: [], name: 'InvalidDurationRemainder' },
  { type: 'error', inputs: [], name: 'InvalidEarner' },
  { type: 'error', inputs: [], name: 'InvalidEarnerLeafIndex' },
  {
    type: 'error',
    inputs: [],
    name: 'InvalidGenesisRewardsTimestampRemainder',
  },
  { type: 'error', inputs: [], name: 'InvalidIndex' },
  { type: 'error', inputs: [], name: 'InvalidNewPausedStatus' },
  { type: 'error', inputs: [], name: 'InvalidOperatorSet' },
  { type: 'error', inputs: [], name: 'InvalidPermissions' },
  { type: 'error', inputs: [], name: 'InvalidProofLength' },
  { type: 'error', inputs: [], name: 'InvalidRoot' },
  { type: 'error', inputs: [], name: 'InvalidRootIndex' },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  { type: 'error', inputs: [], name: 'InvalidStartTimestampRemainder' },
  { type: 'error', inputs: [], name: 'InvalidTokenLeafIndex' },
  { type: 'error', inputs: [], name: 'NewRootMustBeForNewCalculatedPeriod' },
  { type: 'error', inputs: [], name: 'OnlyPauser' },
  { type: 'error', inputs: [], name: 'OnlyUnpauser' },
  { type: 'error', inputs: [], name: 'OperatorsNotInAscendingOrder' },
  { type: 'error', inputs: [], name: 'PreviousSplitPending' },
  { type: 'error', inputs: [], name: 'RewardsEndTimestampNotElapsed' },
  { type: 'error', inputs: [], name: 'RootAlreadyActivated' },
  { type: 'error', inputs: [], name: 'RootDisabled' },
  { type: 'error', inputs: [], name: 'RootNotActivated' },
  { type: 'error', inputs: [], name: 'SplitExceedsMax' },
  { type: 'error', inputs: [], name: 'StartTimestampTooFarInFuture' },
  { type: 'error', inputs: [], name: 'StartTimestampTooFarInPast' },
  { type: 'error', inputs: [], name: 'StrategiesNotInAscendingOrder' },
  { type: 'error', inputs: [], name: 'StrategyNotWhitelisted' },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong',
  },
  { type: 'error', inputs: [], name: 'SubmissionNotRetroactive' },
  { type: 'error', inputs: [], name: 'UnauthorizedCaller' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// StrategyBaseTVLLimits
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const strategyBaseTvlLimitsAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_strategyManager',
        internalType: 'contract IStrategyManager',
        type: 'address',
      },
      {
        name: '_pauserRegistry',
        internalType: 'contract IPauserRegistry',
        type: 'address',
      },
      { name: '_version', internalType: 'string', type: 'string' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'contract IERC20', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'deposit',
    outputs: [{ name: 'newShares', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'explanation',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getTVLLimits',
    outputs: [
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '_maxPerDeposit', internalType: 'uint256', type: 'uint256' },
      { name: '_maxTotalDeposits', internalType: 'uint256', type: 'uint256' },
      {
        name: '_underlyingToken',
        internalType: 'contract IERC20',
        type: 'address',
      },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '_underlyingToken',
        internalType: 'contract IERC20',
        type: 'address',
      },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'maxPerDeposit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'maxTotalDeposits',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauseAll',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'index', internalType: 'uint8', type: 'uint8' }],
    name: 'paused',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauserRegistry',
    outputs: [
      { name: '', internalType: 'contract IPauserRegistry', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newMaxPerDeposit', internalType: 'uint256', type: 'uint256' },
      { name: 'newMaxTotalDeposits', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'setTVLLimits',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    name: 'shares',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amountShares', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'sharesToUnderlying',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amountShares', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'sharesToUnderlyingView',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'strategyManager',
    outputs: [
      { name: '', internalType: 'contract IStrategyManager', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalShares',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amountUnderlying', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'underlyingToShares',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amountUnderlying', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'underlyingToSharesView',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'underlyingToken',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    name: 'userUnderlying',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    name: 'userUnderlyingView',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'recipient', internalType: 'address', type: 'address' },
      { name: 'token', internalType: 'contract IERC20', type: 'address' },
      { name: 'amountShares', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'withdraw',
    outputs: [{ name: 'amountOut', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'rate',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'ExchangeRateEmitted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'version', internalType: 'uint8', type: 'uint8', indexed: false },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'newValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'MaxPerDepositUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'newValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'MaxTotalDepositsUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Paused',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'token',
        internalType: 'contract IERC20',
        type: 'address',
        indexed: false,
      },
      {
        name: 'decimals',
        internalType: 'uint8',
        type: 'uint8',
        indexed: false,
      },
    ],
    name: 'StrategyTokenSet',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Unpaused',
  },
  { type: 'error', inputs: [], name: 'BalanceExceedsMaxTotalDeposits' },
  { type: 'error', inputs: [], name: 'CurrentlyPaused' },
  { type: 'error', inputs: [], name: 'InputAddressZero' },
  { type: 'error', inputs: [], name: 'InvalidNewPausedStatus' },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  { type: 'error', inputs: [], name: 'MaxPerDepositExceedsMax' },
  { type: 'error', inputs: [], name: 'NewSharesZero' },
  { type: 'error', inputs: [], name: 'OnlyPauser' },
  { type: 'error', inputs: [], name: 'OnlyStrategyManager' },
  { type: 'error', inputs: [], name: 'OnlyUnderlyingToken' },
  { type: 'error', inputs: [], name: 'OnlyUnpauser' },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong',
  },
  { type: 'error', inputs: [], name: 'TotalSharesExceedsMax' },
  { type: 'error', inputs: [], name: 'WithdrawalAmountExceedsTotalDeposits' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// StrategyManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const strategyManagerAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_allocationManager',
        internalType: 'contract IAllocationManager',
        type: 'address',
      },
      {
        name: '_delegation',
        internalType: 'contract IDelegationManager',
        type: 'address',
      },
      {
        name: '_pauserRegistry',
        internalType: 'contract IPauserRegistry',
        type: 'address',
      },
      { name: '_version', internalType: 'string', type: 'string' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'DEFAULT_BURN_ADDRESS',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'DEPOSIT_TYPEHASH',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'addShares',
    outputs: [
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'strategiesToWhitelist',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
    ],
    name: 'addStrategiesToDepositWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'allocationManager',
    outputs: [
      {
        name: '',
        internalType: 'contract IAllocationManager',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'burnShares',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
      { name: 'token', internalType: 'contract IERC20', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'nonce', internalType: 'uint256', type: 'uint256' },
      { name: 'expiry', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'calculateStrategyDepositDigestHash',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: 'slashId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'clearBurnOrRedistributableShares',
    outputs: [{ name: '', internalType: 'uint256[]', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: 'slashId', internalType: 'uint256', type: 'uint256' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'clearBurnOrRedistributableSharesByStrategy',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'delegation',
    outputs: [
      {
        name: '',
        internalType: 'contract IDelegationManager',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
      { name: 'token', internalType: 'contract IERC20', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'depositIntoStrategy',
    outputs: [
      { name: 'depositShares', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
      { name: 'token', internalType: 'contract IERC20', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'expiry', internalType: 'uint256', type: 'uint256' },
      { name: 'signature', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'depositIntoStrategyWithSignature',
    outputs: [
      { name: 'depositShares', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'domainSeparator',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: 'slashId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'getBurnOrRedistributableCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: 'slashId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'getBurnOrRedistributableShares',
    outputs: [
      { name: '', internalType: 'contract IStrategy[]', type: 'address[]' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: 'slashId', internalType: 'uint256', type: 'uint256' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'getBurnOrRedistributableShares',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'getBurnableShares',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'staker', internalType: 'address', type: 'address' }],
    name: 'getDeposits',
    outputs: [
      { name: '', internalType: 'contract IStrategy[]', type: 'address[]' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getPendingOperatorSets',
    outputs: [
      {
        name: '',
        internalType: 'struct OperatorSet[]',
        type: 'tuple[]',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
    ],
    name: 'getPendingSlashIds',
    outputs: [{ name: '', internalType: 'uint256[]', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'staker', internalType: 'address', type: 'address' }],
    name: 'getStakerStrategyList',
    outputs: [
      { name: '', internalType: 'contract IStrategy[]', type: 'address[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getStrategiesWithBurnableShares',
    outputs: [
      { name: '', internalType: 'address[]', type: 'address[]' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
      },
      { name: 'slashId', internalType: 'uint256', type: 'uint256' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
      { name: 'sharesToBurn', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'increaseBurnOrRedistributableShares',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'initialOwner', internalType: 'address', type: 'address' },
      {
        name: 'initialStrategyWhitelister',
        internalType: 'address',
        type: 'address',
      },
      { name: 'initialPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'signer', internalType: 'address', type: 'address' }],
    name: 'nonces',
    outputs: [{ name: 'nonce', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauseAll',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'index', internalType: 'uint8', type: 'uint8' }],
    name: 'paused',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pauserRegistry',
    outputs: [
      { name: '', internalType: 'contract IPauserRegistry', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
      {
        name: 'depositSharesToRemove',
        internalType: 'uint256',
        type: 'uint256',
      },
    ],
    name: 'removeDepositShares',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'strategiesToRemoveFromWhitelist',
        internalType: 'contract IStrategy[]',
        type: 'address[]',
      },
    ],
    name: 'removeStrategiesFromDepositWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'newStrategyWhitelister',
        internalType: 'address',
        type: 'address',
      },
    ],
    name: 'setStrategyWhitelister',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'stakerDepositShares',
    outputs: [{ name: 'shares', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'stakerStrategyList',
    outputs: [
      {
        name: 'strategies',
        internalType: 'contract IStrategy',
        type: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'staker', internalType: 'address', type: 'address' }],
    name: 'stakerStrategyListLength',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
    ],
    name: 'strategyIsWhitelistedForDeposit',
    outputs: [{ name: 'whitelisted', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'strategyWhitelister',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPausedStatus', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'staker', internalType: 'address', type: 'address' },
      { name: 'strategy', internalType: 'contract IStrategy', type: 'address' },
      { name: 'token', internalType: 'contract IERC20', type: 'address' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'withdrawSharesAsTokens',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
      {
        name: 'slashId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'BurnOrRedistributableSharesDecreased',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operatorSet',
        internalType: 'struct OperatorSet',
        type: 'tuple',
        components: [
          { name: 'avs', internalType: 'address', type: 'address' },
          { name: 'id', internalType: 'uint32', type: 'uint32' },
        ],
        indexed: false,
      },
      {
        name: 'slashId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'BurnOrRedistributableSharesIncreased',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'BurnableSharesDecreased',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'staker',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Deposit',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'version', internalType: 'uint8', type: 'uint8', indexed: false },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Paused',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'StrategyAddedToDepositWhitelist',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'strategy',
        internalType: 'contract IStrategy',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'StrategyRemovedFromDepositWhitelist',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousAddress',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'newAddress',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'StrategyWhitelisterChanged',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newPausedStatus',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Unpaused',
  },
  { type: 'error', inputs: [], name: 'CurrentlyPaused' },
  { type: 'error', inputs: [], name: 'InputAddressZero' },
  { type: 'error', inputs: [], name: 'InvalidNewPausedStatus' },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  { type: 'error', inputs: [], name: 'InvalidSignature' },
  { type: 'error', inputs: [], name: 'MaxStrategiesExceeded' },
  { type: 'error', inputs: [], name: 'OnlyDelegationManager' },
  { type: 'error', inputs: [], name: 'OnlyPauser' },
  { type: 'error', inputs: [], name: 'OnlyStrategyWhitelister' },
  { type: 'error', inputs: [], name: 'OnlyUnpauser' },
  { type: 'error', inputs: [], name: 'SharesAmountTooHigh' },
  { type: 'error', inputs: [], name: 'SharesAmountZero' },
  { type: 'error', inputs: [], name: 'SignatureExpired' },
  { type: 'error', inputs: [], name: 'StakerAddressZero' },
  { type: 'error', inputs: [], name: 'StrategyAlreadyInSlash' },
  { type: 'error', inputs: [], name: 'StrategyNotFound' },
  { type: 'error', inputs: [], name: 'StrategyNotWhitelisted' },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// TransparentUpgradeableProxy
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const transparentUpgradeableProxyAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_logic', internalType: 'address', type: 'address' },
      { name: 'admin_', internalType: 'address', type: 'address' },
      { name: '_data', internalType: 'bytes', type: 'bytes' },
    ],
    stateMutability: 'payable',
  },
  { type: 'fallback', stateMutability: 'payable' },
  { type: 'receive', stateMutability: 'payable' },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousAdmin',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'newAdmin',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'AdminChanged',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'beacon',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'BeaconUpgraded',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'implementation',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'Upgraded',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// UpgradeableBeacon
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const upgradeableBeaconAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'implementation_', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'implementation',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newImplementation', internalType: 'address', type: 'address' },
    ],
    name: 'upgradeTo',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'implementation',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'Upgraded',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Action
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__
 */
export const readAvsDirectory = /*#__PURE__*/ createReadContract({
  abi: avsDirectoryAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"OPERATOR_AVS_REGISTRATION_TYPEHASH"`
 */
export const readAvsDirectoryOperatorAvsRegistrationTypehash =
  /*#__PURE__*/ createReadContract({
    abi: avsDirectoryAbi,
    functionName: 'OPERATOR_AVS_REGISTRATION_TYPEHASH',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"OPERATOR_SET_FORCE_DEREGISTRATION_TYPEHASH"`
 */
export const readAvsDirectoryOperatorSetForceDeregistrationTypehash =
  /*#__PURE__*/ createReadContract({
    abi: avsDirectoryAbi,
    functionName: 'OPERATOR_SET_FORCE_DEREGISTRATION_TYPEHASH',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"OPERATOR_SET_REGISTRATION_TYPEHASH"`
 */
export const readAvsDirectoryOperatorSetRegistrationTypehash =
  /*#__PURE__*/ createReadContract({
    abi: avsDirectoryAbi,
    functionName: 'OPERATOR_SET_REGISTRATION_TYPEHASH',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"avsOperatorStatus"`
 */
export const readAvsDirectoryAvsOperatorStatus =
  /*#__PURE__*/ createReadContract({
    abi: avsDirectoryAbi,
    functionName: 'avsOperatorStatus',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"calculateOperatorAVSRegistrationDigestHash"`
 */
export const readAvsDirectoryCalculateOperatorAvsRegistrationDigestHash =
  /*#__PURE__*/ createReadContract({
    abi: avsDirectoryAbi,
    functionName: 'calculateOperatorAVSRegistrationDigestHash',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"delegation"`
 */
export const readAvsDirectoryDelegation = /*#__PURE__*/ createReadContract({
  abi: avsDirectoryAbi,
  functionName: 'delegation',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"domainSeparator"`
 */
export const readAvsDirectoryDomainSeparator = /*#__PURE__*/ createReadContract(
  { abi: avsDirectoryAbi, functionName: 'domainSeparator' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"operatorSaltIsSpent"`
 */
export const readAvsDirectoryOperatorSaltIsSpent =
  /*#__PURE__*/ createReadContract({
    abi: avsDirectoryAbi,
    functionName: 'operatorSaltIsSpent',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"owner"`
 */
export const readAvsDirectoryOwner = /*#__PURE__*/ createReadContract({
  abi: avsDirectoryAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"paused"`
 */
export const readAvsDirectoryPaused = /*#__PURE__*/ createReadContract({
  abi: avsDirectoryAbi,
  functionName: 'paused',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"pauserRegistry"`
 */
export const readAvsDirectoryPauserRegistry = /*#__PURE__*/ createReadContract({
  abi: avsDirectoryAbi,
  functionName: 'pauserRegistry',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"version"`
 */
export const readAvsDirectoryVersion = /*#__PURE__*/ createReadContract({
  abi: avsDirectoryAbi,
  functionName: 'version',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link avsDirectoryAbi}__
 */
export const writeAvsDirectory = /*#__PURE__*/ createWriteContract({
  abi: avsDirectoryAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"cancelSalt"`
 */
export const writeAvsDirectoryCancelSalt = /*#__PURE__*/ createWriteContract({
  abi: avsDirectoryAbi,
  functionName: 'cancelSalt',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"deregisterOperatorFromAVS"`
 */
export const writeAvsDirectoryDeregisterOperatorFromAvs =
  /*#__PURE__*/ createWriteContract({
    abi: avsDirectoryAbi,
    functionName: 'deregisterOperatorFromAVS',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"initialize"`
 */
export const writeAvsDirectoryInitialize = /*#__PURE__*/ createWriteContract({
  abi: avsDirectoryAbi,
  functionName: 'initialize',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"pause"`
 */
export const writeAvsDirectoryPause = /*#__PURE__*/ createWriteContract({
  abi: avsDirectoryAbi,
  functionName: 'pause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"pauseAll"`
 */
export const writeAvsDirectoryPauseAll = /*#__PURE__*/ createWriteContract({
  abi: avsDirectoryAbi,
  functionName: 'pauseAll',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"registerOperatorToAVS"`
 */
export const writeAvsDirectoryRegisterOperatorToAvs =
  /*#__PURE__*/ createWriteContract({
    abi: avsDirectoryAbi,
    functionName: 'registerOperatorToAVS',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const writeAvsDirectoryRenounceOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: avsDirectoryAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const writeAvsDirectoryTransferOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: avsDirectoryAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"unpause"`
 */
export const writeAvsDirectoryUnpause = /*#__PURE__*/ createWriteContract({
  abi: avsDirectoryAbi,
  functionName: 'unpause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"updateAVSMetadataURI"`
 */
export const writeAvsDirectoryUpdateAvsMetadataUri =
  /*#__PURE__*/ createWriteContract({
    abi: avsDirectoryAbi,
    functionName: 'updateAVSMetadataURI',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link avsDirectoryAbi}__
 */
export const simulateAvsDirectory = /*#__PURE__*/ createSimulateContract({
  abi: avsDirectoryAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"cancelSalt"`
 */
export const simulateAvsDirectoryCancelSalt =
  /*#__PURE__*/ createSimulateContract({
    abi: avsDirectoryAbi,
    functionName: 'cancelSalt',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"deregisterOperatorFromAVS"`
 */
export const simulateAvsDirectoryDeregisterOperatorFromAvs =
  /*#__PURE__*/ createSimulateContract({
    abi: avsDirectoryAbi,
    functionName: 'deregisterOperatorFromAVS',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"initialize"`
 */
export const simulateAvsDirectoryInitialize =
  /*#__PURE__*/ createSimulateContract({
    abi: avsDirectoryAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"pause"`
 */
export const simulateAvsDirectoryPause = /*#__PURE__*/ createSimulateContract({
  abi: avsDirectoryAbi,
  functionName: 'pause',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"pauseAll"`
 */
export const simulateAvsDirectoryPauseAll =
  /*#__PURE__*/ createSimulateContract({
    abi: avsDirectoryAbi,
    functionName: 'pauseAll',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"registerOperatorToAVS"`
 */
export const simulateAvsDirectoryRegisterOperatorToAvs =
  /*#__PURE__*/ createSimulateContract({
    abi: avsDirectoryAbi,
    functionName: 'registerOperatorToAVS',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const simulateAvsDirectoryRenounceOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: avsDirectoryAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const simulateAvsDirectoryTransferOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: avsDirectoryAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"unpause"`
 */
export const simulateAvsDirectoryUnpause = /*#__PURE__*/ createSimulateContract(
  { abi: avsDirectoryAbi, functionName: 'unpause' },
)

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link avsDirectoryAbi}__ and `functionName` set to `"updateAVSMetadataURI"`
 */
export const simulateAvsDirectoryUpdateAvsMetadataUri =
  /*#__PURE__*/ createSimulateContract({
    abi: avsDirectoryAbi,
    functionName: 'updateAVSMetadataURI',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link avsDirectoryAbi}__
 */
export const watchAvsDirectoryEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: avsDirectoryAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link avsDirectoryAbi}__ and `eventName` set to `"AVSMetadataURIUpdated"`
 */
export const watchAvsDirectoryAvsMetadataUriUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: avsDirectoryAbi,
    eventName: 'AVSMetadataURIUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link avsDirectoryAbi}__ and `eventName` set to `"Initialized"`
 */
export const watchAvsDirectoryInitializedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: avsDirectoryAbi,
    eventName: 'Initialized',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link avsDirectoryAbi}__ and `eventName` set to `"OperatorAVSRegistrationStatusUpdated"`
 */
export const watchAvsDirectoryOperatorAvsRegistrationStatusUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: avsDirectoryAbi,
    eventName: 'OperatorAVSRegistrationStatusUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link avsDirectoryAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const watchAvsDirectoryOwnershipTransferredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: avsDirectoryAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link avsDirectoryAbi}__ and `eventName` set to `"Paused"`
 */
export const watchAvsDirectoryPausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: avsDirectoryAbi,
    eventName: 'Paused',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link avsDirectoryAbi}__ and `eventName` set to `"Unpaused"`
 */
export const watchAvsDirectoryUnpausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: avsDirectoryAbi,
    eventName: 'Unpaused',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link agentAbi}__
 */
export const readAgent = /*#__PURE__*/ createReadContract({ abi: agentAbi })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link agentAbi}__ and `functionName` set to `"AGENT_ID"`
 */
export const readAgentAgentId = /*#__PURE__*/ createReadContract({
  abi: agentAbi,
  functionName: 'AGENT_ID',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link agentAbi}__ and `functionName` set to `"GATEWAY"`
 */
export const readAgentGateway = /*#__PURE__*/ createReadContract({
  abi: agentAbi,
  functionName: 'GATEWAY',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link agentAbi}__
 */
export const writeAgent = /*#__PURE__*/ createWriteContract({ abi: agentAbi })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link agentAbi}__ and `functionName` set to `"invoke"`
 */
export const writeAgentInvoke = /*#__PURE__*/ createWriteContract({
  abi: agentAbi,
  functionName: 'invoke',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link agentAbi}__
 */
export const simulateAgent = /*#__PURE__*/ createSimulateContract({
  abi: agentAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link agentAbi}__ and `functionName` set to `"invoke"`
 */
export const simulateAgentInvoke = /*#__PURE__*/ createSimulateContract({
  abi: agentAbi,
  functionName: 'invoke',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link agentExecutorAbi}__
 */
export const writeAgentExecutor = /*#__PURE__*/ createWriteContract({
  abi: agentExecutorAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link agentExecutorAbi}__ and `functionName` set to `"callContract"`
 */
export const writeAgentExecutorCallContract = /*#__PURE__*/ createWriteContract(
  { abi: agentExecutorAbi, functionName: 'callContract' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link agentExecutorAbi}__ and `functionName` set to `"deposit"`
 */
export const writeAgentExecutorDeposit = /*#__PURE__*/ createWriteContract({
  abi: agentExecutorAbi,
  functionName: 'deposit',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link agentExecutorAbi}__ and `functionName` set to `"transferEther"`
 */
export const writeAgentExecutorTransferEther =
  /*#__PURE__*/ createWriteContract({
    abi: agentExecutorAbi,
    functionName: 'transferEther',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link agentExecutorAbi}__ and `functionName` set to `"transferToken"`
 */
export const writeAgentExecutorTransferToken =
  /*#__PURE__*/ createWriteContract({
    abi: agentExecutorAbi,
    functionName: 'transferToken',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link agentExecutorAbi}__
 */
export const simulateAgentExecutor = /*#__PURE__*/ createSimulateContract({
  abi: agentExecutorAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link agentExecutorAbi}__ and `functionName` set to `"callContract"`
 */
export const simulateAgentExecutorCallContract =
  /*#__PURE__*/ createSimulateContract({
    abi: agentExecutorAbi,
    functionName: 'callContract',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link agentExecutorAbi}__ and `functionName` set to `"deposit"`
 */
export const simulateAgentExecutorDeposit =
  /*#__PURE__*/ createSimulateContract({
    abi: agentExecutorAbi,
    functionName: 'deposit',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link agentExecutorAbi}__ and `functionName` set to `"transferEther"`
 */
export const simulateAgentExecutorTransferEther =
  /*#__PURE__*/ createSimulateContract({
    abi: agentExecutorAbi,
    functionName: 'transferEther',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link agentExecutorAbi}__ and `functionName` set to `"transferToken"`
 */
export const simulateAgentExecutorTransferToken =
  /*#__PURE__*/ createSimulateContract({
    abi: agentExecutorAbi,
    functionName: 'transferToken',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__
 */
export const readAllocationManager = /*#__PURE__*/ createReadContract({
  abi: allocationManagerAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"ALLOCATION_CONFIGURATION_DELAY"`
 */
export const readAllocationManagerAllocationConfigurationDelay =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'ALLOCATION_CONFIGURATION_DELAY',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"DEALLOCATION_DELAY"`
 */
export const readAllocationManagerDeallocationDelay =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'DEALLOCATION_DELAY',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"delegation"`
 */
export const readAllocationManagerDelegation = /*#__PURE__*/ createReadContract(
  { abi: allocationManagerAbi, functionName: 'delegation' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"eigenStrategy"`
 */
export const readAllocationManagerEigenStrategy =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'eigenStrategy',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getAVSRegistrar"`
 */
export const readAllocationManagerGetAvsRegistrar =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getAVSRegistrar',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getAllocatableMagnitude"`
 */
export const readAllocationManagerGetAllocatableMagnitude =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getAllocatableMagnitude',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getAllocatedSets"`
 */
export const readAllocationManagerGetAllocatedSets =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getAllocatedSets',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getAllocatedStake"`
 */
export const readAllocationManagerGetAllocatedStake =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getAllocatedStake',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getAllocatedStrategies"`
 */
export const readAllocationManagerGetAllocatedStrategies =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getAllocatedStrategies',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getAllocation"`
 */
export const readAllocationManagerGetAllocation =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getAllocation',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getAllocationDelay"`
 */
export const readAllocationManagerGetAllocationDelay =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getAllocationDelay',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getAllocations"`
 */
export const readAllocationManagerGetAllocations =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getAllocations',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getEncumberedMagnitude"`
 */
export const readAllocationManagerGetEncumberedMagnitude =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getEncumberedMagnitude',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getMaxMagnitude"`
 */
export const readAllocationManagerGetMaxMagnitude =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getMaxMagnitude',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getMaxMagnitudes"`
 */
export const readAllocationManagerGetMaxMagnitudes =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getMaxMagnitudes',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getMaxMagnitudesAtBlock"`
 */
export const readAllocationManagerGetMaxMagnitudesAtBlock =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getMaxMagnitudesAtBlock',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getMemberCount"`
 */
export const readAllocationManagerGetMemberCount =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getMemberCount',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getMembers"`
 */
export const readAllocationManagerGetMembers = /*#__PURE__*/ createReadContract(
  { abi: allocationManagerAbi, functionName: 'getMembers' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getMinimumSlashableStake"`
 */
export const readAllocationManagerGetMinimumSlashableStake =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getMinimumSlashableStake',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getOperatorSetCount"`
 */
export const readAllocationManagerGetOperatorSetCount =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getOperatorSetCount',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getRedistributionRecipient"`
 */
export const readAllocationManagerGetRedistributionRecipient =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getRedistributionRecipient',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getRegisteredSets"`
 */
export const readAllocationManagerGetRegisteredSets =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getRegisteredSets',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getSlashCount"`
 */
export const readAllocationManagerGetSlashCount =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getSlashCount',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getStrategiesInOperatorSet"`
 */
export const readAllocationManagerGetStrategiesInOperatorSet =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getStrategiesInOperatorSet',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"getStrategyAllocations"`
 */
export const readAllocationManagerGetStrategyAllocations =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'getStrategyAllocations',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"isMemberOfOperatorSet"`
 */
export const readAllocationManagerIsMemberOfOperatorSet =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'isMemberOfOperatorSet',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"isOperatorRedistributable"`
 */
export const readAllocationManagerIsOperatorRedistributable =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'isOperatorRedistributable',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"isOperatorSet"`
 */
export const readAllocationManagerIsOperatorSet =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'isOperatorSet',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"isOperatorSlashable"`
 */
export const readAllocationManagerIsOperatorSlashable =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'isOperatorSlashable',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"isRedistributingOperatorSet"`
 */
export const readAllocationManagerIsRedistributingOperatorSet =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'isRedistributingOperatorSet',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"paused"`
 */
export const readAllocationManagerPaused = /*#__PURE__*/ createReadContract({
  abi: allocationManagerAbi,
  functionName: 'paused',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"pauserRegistry"`
 */
export const readAllocationManagerPauserRegistry =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'pauserRegistry',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"permissionController"`
 */
export const readAllocationManagerPermissionController =
  /*#__PURE__*/ createReadContract({
    abi: allocationManagerAbi,
    functionName: 'permissionController',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"version"`
 */
export const readAllocationManagerVersion = /*#__PURE__*/ createReadContract({
  abi: allocationManagerAbi,
  functionName: 'version',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__
 */
export const writeAllocationManager = /*#__PURE__*/ createWriteContract({
  abi: allocationManagerAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"addStrategiesToOperatorSet"`
 */
export const writeAllocationManagerAddStrategiesToOperatorSet =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'addStrategiesToOperatorSet',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"clearDeallocationQueue"`
 */
export const writeAllocationManagerClearDeallocationQueue =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'clearDeallocationQueue',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"createOperatorSets"`
 */
export const writeAllocationManagerCreateOperatorSets =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'createOperatorSets',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"createRedistributingOperatorSets"`
 */
export const writeAllocationManagerCreateRedistributingOperatorSets =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'createRedistributingOperatorSets',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"deregisterFromOperatorSets"`
 */
export const writeAllocationManagerDeregisterFromOperatorSets =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'deregisterFromOperatorSets',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"initialize"`
 */
export const writeAllocationManagerInitialize =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"modifyAllocations"`
 */
export const writeAllocationManagerModifyAllocations =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'modifyAllocations',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"pause"`
 */
export const writeAllocationManagerPause = /*#__PURE__*/ createWriteContract({
  abi: allocationManagerAbi,
  functionName: 'pause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"pauseAll"`
 */
export const writeAllocationManagerPauseAll = /*#__PURE__*/ createWriteContract(
  { abi: allocationManagerAbi, functionName: 'pauseAll' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"registerForOperatorSets"`
 */
export const writeAllocationManagerRegisterForOperatorSets =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'registerForOperatorSets',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"removeStrategiesFromOperatorSet"`
 */
export const writeAllocationManagerRemoveStrategiesFromOperatorSet =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'removeStrategiesFromOperatorSet',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"setAVSRegistrar"`
 */
export const writeAllocationManagerSetAvsRegistrar =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'setAVSRegistrar',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"setAllocationDelay"`
 */
export const writeAllocationManagerSetAllocationDelay =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'setAllocationDelay',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"slashOperator"`
 */
export const writeAllocationManagerSlashOperator =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'slashOperator',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"unpause"`
 */
export const writeAllocationManagerUnpause = /*#__PURE__*/ createWriteContract({
  abi: allocationManagerAbi,
  functionName: 'unpause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"updateAVSMetadataURI"`
 */
export const writeAllocationManagerUpdateAvsMetadataUri =
  /*#__PURE__*/ createWriteContract({
    abi: allocationManagerAbi,
    functionName: 'updateAVSMetadataURI',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__
 */
export const simulateAllocationManager = /*#__PURE__*/ createSimulateContract({
  abi: allocationManagerAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"addStrategiesToOperatorSet"`
 */
export const simulateAllocationManagerAddStrategiesToOperatorSet =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'addStrategiesToOperatorSet',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"clearDeallocationQueue"`
 */
export const simulateAllocationManagerClearDeallocationQueue =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'clearDeallocationQueue',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"createOperatorSets"`
 */
export const simulateAllocationManagerCreateOperatorSets =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'createOperatorSets',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"createRedistributingOperatorSets"`
 */
export const simulateAllocationManagerCreateRedistributingOperatorSets =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'createRedistributingOperatorSets',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"deregisterFromOperatorSets"`
 */
export const simulateAllocationManagerDeregisterFromOperatorSets =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'deregisterFromOperatorSets',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"initialize"`
 */
export const simulateAllocationManagerInitialize =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"modifyAllocations"`
 */
export const simulateAllocationManagerModifyAllocations =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'modifyAllocations',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"pause"`
 */
export const simulateAllocationManagerPause =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'pause',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"pauseAll"`
 */
export const simulateAllocationManagerPauseAll =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'pauseAll',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"registerForOperatorSets"`
 */
export const simulateAllocationManagerRegisterForOperatorSets =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'registerForOperatorSets',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"removeStrategiesFromOperatorSet"`
 */
export const simulateAllocationManagerRemoveStrategiesFromOperatorSet =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'removeStrategiesFromOperatorSet',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"setAVSRegistrar"`
 */
export const simulateAllocationManagerSetAvsRegistrar =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'setAVSRegistrar',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"setAllocationDelay"`
 */
export const simulateAllocationManagerSetAllocationDelay =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'setAllocationDelay',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"slashOperator"`
 */
export const simulateAllocationManagerSlashOperator =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'slashOperator',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"unpause"`
 */
export const simulateAllocationManagerUnpause =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'unpause',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link allocationManagerAbi}__ and `functionName` set to `"updateAVSMetadataURI"`
 */
export const simulateAllocationManagerUpdateAvsMetadataUri =
  /*#__PURE__*/ createSimulateContract({
    abi: allocationManagerAbi,
    functionName: 'updateAVSMetadataURI',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__
 */
export const watchAllocationManagerEvent =
  /*#__PURE__*/ createWatchContractEvent({ abi: allocationManagerAbi })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"AVSMetadataURIUpdated"`
 */
export const watchAllocationManagerAvsMetadataUriUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'AVSMetadataURIUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"AVSRegistrarSet"`
 */
export const watchAllocationManagerAvsRegistrarSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'AVSRegistrarSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"AllocationDelaySet"`
 */
export const watchAllocationManagerAllocationDelaySetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'AllocationDelaySet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"AllocationUpdated"`
 */
export const watchAllocationManagerAllocationUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'AllocationUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"EncumberedMagnitudeUpdated"`
 */
export const watchAllocationManagerEncumberedMagnitudeUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'EncumberedMagnitudeUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"Initialized"`
 */
export const watchAllocationManagerInitializedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'Initialized',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"MaxMagnitudeUpdated"`
 */
export const watchAllocationManagerMaxMagnitudeUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'MaxMagnitudeUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"OperatorAddedToOperatorSet"`
 */
export const watchAllocationManagerOperatorAddedToOperatorSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'OperatorAddedToOperatorSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"OperatorRemovedFromOperatorSet"`
 */
export const watchAllocationManagerOperatorRemovedFromOperatorSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'OperatorRemovedFromOperatorSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"OperatorSetCreated"`
 */
export const watchAllocationManagerOperatorSetCreatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'OperatorSetCreated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"OperatorSlashed"`
 */
export const watchAllocationManagerOperatorSlashedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'OperatorSlashed',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"Paused"`
 */
export const watchAllocationManagerPausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'Paused',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"RedistributionAddressSet"`
 */
export const watchAllocationManagerRedistributionAddressSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'RedistributionAddressSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"StrategyAddedToOperatorSet"`
 */
export const watchAllocationManagerStrategyAddedToOperatorSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'StrategyAddedToOperatorSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"StrategyRemovedFromOperatorSet"`
 */
export const watchAllocationManagerStrategyRemovedFromOperatorSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'StrategyRemovedFromOperatorSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link allocationManagerAbi}__ and `eventName` set to `"Unpaused"`
 */
export const watchAllocationManagerUnpausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: allocationManagerAbi,
    eventName: 'Unpaused',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__
 */
export const readBeefyClient = /*#__PURE__*/ createReadContract({
  abi: beefyClientAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"MMR_ROOT_ID"`
 */
export const readBeefyClientMmrRootId = /*#__PURE__*/ createReadContract({
  abi: beefyClientAbi,
  functionName: 'MMR_ROOT_ID',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"createFinalBitfield"`
 */
export const readBeefyClientCreateFinalBitfield =
  /*#__PURE__*/ createReadContract({
    abi: beefyClientAbi,
    functionName: 'createFinalBitfield',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"createInitialBitfield"`
 */
export const readBeefyClientCreateInitialBitfield =
  /*#__PURE__*/ createReadContract({
    abi: beefyClientAbi,
    functionName: 'createInitialBitfield',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"currentValidatorSet"`
 */
export const readBeefyClientCurrentValidatorSet =
  /*#__PURE__*/ createReadContract({
    abi: beefyClientAbi,
    functionName: 'currentValidatorSet',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"latestBeefyBlock"`
 */
export const readBeefyClientLatestBeefyBlock = /*#__PURE__*/ createReadContract(
  { abi: beefyClientAbi, functionName: 'latestBeefyBlock' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"latestMMRRoot"`
 */
export const readBeefyClientLatestMmrRoot = /*#__PURE__*/ createReadContract({
  abi: beefyClientAbi,
  functionName: 'latestMMRRoot',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"minNumRequiredSignatures"`
 */
export const readBeefyClientMinNumRequiredSignatures =
  /*#__PURE__*/ createReadContract({
    abi: beefyClientAbi,
    functionName: 'minNumRequiredSignatures',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"nextValidatorSet"`
 */
export const readBeefyClientNextValidatorSet = /*#__PURE__*/ createReadContract(
  { abi: beefyClientAbi, functionName: 'nextValidatorSet' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"randaoCommitDelay"`
 */
export const readBeefyClientRandaoCommitDelay =
  /*#__PURE__*/ createReadContract({
    abi: beefyClientAbi,
    functionName: 'randaoCommitDelay',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"randaoCommitExpiration"`
 */
export const readBeefyClientRandaoCommitExpiration =
  /*#__PURE__*/ createReadContract({
    abi: beefyClientAbi,
    functionName: 'randaoCommitExpiration',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"tickets"`
 */
export const readBeefyClientTickets = /*#__PURE__*/ createReadContract({
  abi: beefyClientAbi,
  functionName: 'tickets',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"verifyMMRLeafProof"`
 */
export const readBeefyClientVerifyMmrLeafProof =
  /*#__PURE__*/ createReadContract({
    abi: beefyClientAbi,
    functionName: 'verifyMMRLeafProof',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link beefyClientAbi}__
 */
export const writeBeefyClient = /*#__PURE__*/ createWriteContract({
  abi: beefyClientAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"commitPrevRandao"`
 */
export const writeBeefyClientCommitPrevRandao =
  /*#__PURE__*/ createWriteContract({
    abi: beefyClientAbi,
    functionName: 'commitPrevRandao',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"submitFinal"`
 */
export const writeBeefyClientSubmitFinal = /*#__PURE__*/ createWriteContract({
  abi: beefyClientAbi,
  functionName: 'submitFinal',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"submitInitial"`
 */
export const writeBeefyClientSubmitInitial = /*#__PURE__*/ createWriteContract({
  abi: beefyClientAbi,
  functionName: 'submitInitial',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link beefyClientAbi}__
 */
export const simulateBeefyClient = /*#__PURE__*/ createSimulateContract({
  abi: beefyClientAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"commitPrevRandao"`
 */
export const simulateBeefyClientCommitPrevRandao =
  /*#__PURE__*/ createSimulateContract({
    abi: beefyClientAbi,
    functionName: 'commitPrevRandao',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"submitFinal"`
 */
export const simulateBeefyClientSubmitFinal =
  /*#__PURE__*/ createSimulateContract({
    abi: beefyClientAbi,
    functionName: 'submitFinal',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link beefyClientAbi}__ and `functionName` set to `"submitInitial"`
 */
export const simulateBeefyClientSubmitInitial =
  /*#__PURE__*/ createSimulateContract({
    abi: beefyClientAbi,
    functionName: 'submitInitial',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link beefyClientAbi}__
 */
export const watchBeefyClientEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: beefyClientAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link beefyClientAbi}__ and `eventName` set to `"NewMMRRoot"`
 */
export const watchBeefyClientNewMmrRootEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: beefyClientAbi,
    eventName: 'NewMMRRoot',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link beefyClientAbi}__ and `eventName` set to `"NewTicket"`
 */
export const watchBeefyClientNewTicketEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: beefyClientAbi,
    eventName: 'NewTicket',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__
 */
export const readDataHavenServiceManager = /*#__PURE__*/ createReadContract({
  abi: dataHavenServiceManagerAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"DATAHAVEN_AVS_METADATA"`
 */
export const readDataHavenServiceManagerDatahavenAvsMetadata =
  /*#__PURE__*/ createReadContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'DATAHAVEN_AVS_METADATA',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"VALIDATORS_SET_ID"`
 */
export const readDataHavenServiceManagerValidatorsSetId =
  /*#__PURE__*/ createReadContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'VALIDATORS_SET_ID',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"buildNewValidatorSetMessage"`
 */
export const readDataHavenServiceManagerBuildNewValidatorSetMessage =
  /*#__PURE__*/ createReadContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'buildNewValidatorSetMessage',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"owner"`
 */
export const readDataHavenServiceManagerOwner =
  /*#__PURE__*/ createReadContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'owner',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"rewardsInitiator"`
 */
export const readDataHavenServiceManagerRewardsInitiator =
  /*#__PURE__*/ createReadContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'rewardsInitiator',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"snowbridgeGateway"`
 */
export const readDataHavenServiceManagerSnowbridgeGateway =
  /*#__PURE__*/ createReadContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'snowbridgeGateway',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"supportsAVS"`
 */
export const readDataHavenServiceManagerSupportsAvs =
  /*#__PURE__*/ createReadContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'supportsAVS',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"validatorEthAddressToSolochainAddress"`
 */
export const readDataHavenServiceManagerValidatorEthAddressToSolochainAddress =
  /*#__PURE__*/ createReadContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'validatorEthAddressToSolochainAddress',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"validatorsAllowlist"`
 */
export const readDataHavenServiceManagerValidatorsAllowlist =
  /*#__PURE__*/ createReadContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'validatorsAllowlist',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"validatorsSupportedStrategies"`
 */
export const readDataHavenServiceManagerValidatorsSupportedStrategies =
  /*#__PURE__*/ createReadContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'validatorsSupportedStrategies',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__
 */
export const writeDataHavenServiceManager = /*#__PURE__*/ createWriteContract({
  abi: dataHavenServiceManagerAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"addPendingAdmin"`
 */
export const writeDataHavenServiceManagerAddPendingAdmin =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'addPendingAdmin',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"addStrategiesToValidatorsSupportedStrategies"`
 */
export const writeDataHavenServiceManagerAddStrategiesToValidatorsSupportedStrategies =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'addStrategiesToValidatorsSupportedStrategies',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"addValidatorToAllowlist"`
 */
export const writeDataHavenServiceManagerAddValidatorToAllowlist =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'addValidatorToAllowlist',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"deregisterOperator"`
 */
export const writeDataHavenServiceManagerDeregisterOperator =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'deregisterOperator',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"deregisterOperatorFromOperatorSets"`
 */
export const writeDataHavenServiceManagerDeregisterOperatorFromOperatorSets =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'deregisterOperatorFromOperatorSets',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"initialise"`
 */
export const writeDataHavenServiceManagerInitialise =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'initialise',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"registerOperator"`
 */
export const writeDataHavenServiceManagerRegisterOperator =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'registerOperator',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"removeAdmin"`
 */
export const writeDataHavenServiceManagerRemoveAdmin =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'removeAdmin',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"removeAppointee"`
 */
export const writeDataHavenServiceManagerRemoveAppointee =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'removeAppointee',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"removePendingAdmin"`
 */
export const writeDataHavenServiceManagerRemovePendingAdmin =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'removePendingAdmin',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"removeStrategiesFromValidatorsSupportedStrategies"`
 */
export const writeDataHavenServiceManagerRemoveStrategiesFromValidatorsSupportedStrategies =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'removeStrategiesFromValidatorsSupportedStrategies',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"removeValidatorFromAllowlist"`
 */
export const writeDataHavenServiceManagerRemoveValidatorFromAllowlist =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'removeValidatorFromAllowlist',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const writeDataHavenServiceManagerRenounceOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"sendNewValidatorSet"`
 */
export const writeDataHavenServiceManagerSendNewValidatorSet =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'sendNewValidatorSet',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"setAppointee"`
 */
export const writeDataHavenServiceManagerSetAppointee =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'setAppointee',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"setRewardsInitiator"`
 */
export const writeDataHavenServiceManagerSetRewardsInitiator =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'setRewardsInitiator',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"setSnowbridgeGateway"`
 */
export const writeDataHavenServiceManagerSetSnowbridgeGateway =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'setSnowbridgeGateway',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"submitRewards"`
 */
export const writeDataHavenServiceManagerSubmitRewards =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'submitRewards',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const writeDataHavenServiceManagerTransferOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"updateAVSMetadataURI"`
 */
export const writeDataHavenServiceManagerUpdateAvsMetadataUri =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'updateAVSMetadataURI',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"updateSolochainAddressForValidator"`
 */
export const writeDataHavenServiceManagerUpdateSolochainAddressForValidator =
  /*#__PURE__*/ createWriteContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'updateSolochainAddressForValidator',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__
 */
export const simulateDataHavenServiceManager =
  /*#__PURE__*/ createSimulateContract({ abi: dataHavenServiceManagerAbi })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"addPendingAdmin"`
 */
export const simulateDataHavenServiceManagerAddPendingAdmin =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'addPendingAdmin',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"addStrategiesToValidatorsSupportedStrategies"`
 */
export const simulateDataHavenServiceManagerAddStrategiesToValidatorsSupportedStrategies =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'addStrategiesToValidatorsSupportedStrategies',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"addValidatorToAllowlist"`
 */
export const simulateDataHavenServiceManagerAddValidatorToAllowlist =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'addValidatorToAllowlist',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"deregisterOperator"`
 */
export const simulateDataHavenServiceManagerDeregisterOperator =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'deregisterOperator',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"deregisterOperatorFromOperatorSets"`
 */
export const simulateDataHavenServiceManagerDeregisterOperatorFromOperatorSets =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'deregisterOperatorFromOperatorSets',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"initialise"`
 */
export const simulateDataHavenServiceManagerInitialise =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'initialise',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"registerOperator"`
 */
export const simulateDataHavenServiceManagerRegisterOperator =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'registerOperator',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"removeAdmin"`
 */
export const simulateDataHavenServiceManagerRemoveAdmin =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'removeAdmin',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"removeAppointee"`
 */
export const simulateDataHavenServiceManagerRemoveAppointee =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'removeAppointee',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"removePendingAdmin"`
 */
export const simulateDataHavenServiceManagerRemovePendingAdmin =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'removePendingAdmin',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"removeStrategiesFromValidatorsSupportedStrategies"`
 */
export const simulateDataHavenServiceManagerRemoveStrategiesFromValidatorsSupportedStrategies =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'removeStrategiesFromValidatorsSupportedStrategies',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"removeValidatorFromAllowlist"`
 */
export const simulateDataHavenServiceManagerRemoveValidatorFromAllowlist =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'removeValidatorFromAllowlist',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const simulateDataHavenServiceManagerRenounceOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"sendNewValidatorSet"`
 */
export const simulateDataHavenServiceManagerSendNewValidatorSet =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'sendNewValidatorSet',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"setAppointee"`
 */
export const simulateDataHavenServiceManagerSetAppointee =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'setAppointee',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"setRewardsInitiator"`
 */
export const simulateDataHavenServiceManagerSetRewardsInitiator =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'setRewardsInitiator',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"setSnowbridgeGateway"`
 */
export const simulateDataHavenServiceManagerSetSnowbridgeGateway =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'setSnowbridgeGateway',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"submitRewards"`
 */
export const simulateDataHavenServiceManagerSubmitRewards =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'submitRewards',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const simulateDataHavenServiceManagerTransferOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"updateAVSMetadataURI"`
 */
export const simulateDataHavenServiceManagerUpdateAvsMetadataUri =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'updateAVSMetadataURI',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `functionName` set to `"updateSolochainAddressForValidator"`
 */
export const simulateDataHavenServiceManagerUpdateSolochainAddressForValidator =
  /*#__PURE__*/ createSimulateContract({
    abi: dataHavenServiceManagerAbi,
    functionName: 'updateSolochainAddressForValidator',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__
 */
export const watchDataHavenServiceManagerEvent =
  /*#__PURE__*/ createWatchContractEvent({ abi: dataHavenServiceManagerAbi })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `eventName` set to `"Initialized"`
 */
export const watchDataHavenServiceManagerInitializedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: dataHavenServiceManagerAbi,
    eventName: 'Initialized',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `eventName` set to `"OperatorDeregistered"`
 */
export const watchDataHavenServiceManagerOperatorDeregisteredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: dataHavenServiceManagerAbi,
    eventName: 'OperatorDeregistered',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `eventName` set to `"OperatorRegistered"`
 */
export const watchDataHavenServiceManagerOperatorRegisteredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: dataHavenServiceManagerAbi,
    eventName: 'OperatorRegistered',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const watchDataHavenServiceManagerOwnershipTransferredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: dataHavenServiceManagerAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `eventName` set to `"RewardsInitiatorSet"`
 */
export const watchDataHavenServiceManagerRewardsInitiatorSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: dataHavenServiceManagerAbi,
    eventName: 'RewardsInitiatorSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `eventName` set to `"RewardsSubmitted"`
 */
export const watchDataHavenServiceManagerRewardsSubmittedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: dataHavenServiceManagerAbi,
    eventName: 'RewardsSubmitted',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `eventName` set to `"SnowbridgeGatewaySet"`
 */
export const watchDataHavenServiceManagerSnowbridgeGatewaySetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: dataHavenServiceManagerAbi,
    eventName: 'SnowbridgeGatewaySet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `eventName` set to `"ValidatorAddedToAllowlist"`
 */
export const watchDataHavenServiceManagerValidatorAddedToAllowlistEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: dataHavenServiceManagerAbi,
    eventName: 'ValidatorAddedToAllowlist',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link dataHavenServiceManagerAbi}__ and `eventName` set to `"ValidatorRemovedFromAllowlist"`
 */
export const watchDataHavenServiceManagerValidatorRemovedFromAllowlistEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: dataHavenServiceManagerAbi,
    eventName: 'ValidatorRemovedFromAllowlist',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__
 */
export const readDelegationManager = /*#__PURE__*/ createReadContract({
  abi: delegationManagerAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"DELEGATION_APPROVAL_TYPEHASH"`
 */
export const readDelegationManagerDelegationApprovalTypehash =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'DELEGATION_APPROVAL_TYPEHASH',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"allocationManager"`
 */
export const readDelegationManagerAllocationManager =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'allocationManager',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"beaconChainETHStrategy"`
 */
export const readDelegationManagerBeaconChainEthStrategy =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'beaconChainETHStrategy',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"calculateDelegationApprovalDigestHash"`
 */
export const readDelegationManagerCalculateDelegationApprovalDigestHash =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'calculateDelegationApprovalDigestHash',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"calculateWithdrawalRoot"`
 */
export const readDelegationManagerCalculateWithdrawalRoot =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'calculateWithdrawalRoot',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"convertToDepositShares"`
 */
export const readDelegationManagerConvertToDepositShares =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'convertToDepositShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"cumulativeWithdrawalsQueued"`
 */
export const readDelegationManagerCumulativeWithdrawalsQueued =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'cumulativeWithdrawalsQueued',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"delegatedTo"`
 */
export const readDelegationManagerDelegatedTo =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'delegatedTo',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"delegationApprover"`
 */
export const readDelegationManagerDelegationApprover =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'delegationApprover',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"delegationApproverSaltIsSpent"`
 */
export const readDelegationManagerDelegationApproverSaltIsSpent =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'delegationApproverSaltIsSpent',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"depositScalingFactor"`
 */
export const readDelegationManagerDepositScalingFactor =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'depositScalingFactor',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"domainSeparator"`
 */
export const readDelegationManagerDomainSeparator =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'domainSeparator',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"eigenPodManager"`
 */
export const readDelegationManagerEigenPodManager =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'eigenPodManager',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"getDepositedShares"`
 */
export const readDelegationManagerGetDepositedShares =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'getDepositedShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"getOperatorShares"`
 */
export const readDelegationManagerGetOperatorShares =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'getOperatorShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"getOperatorsShares"`
 */
export const readDelegationManagerGetOperatorsShares =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'getOperatorsShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"getQueuedWithdrawal"`
 */
export const readDelegationManagerGetQueuedWithdrawal =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'getQueuedWithdrawal',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"getQueuedWithdrawalRoots"`
 */
export const readDelegationManagerGetQueuedWithdrawalRoots =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'getQueuedWithdrawalRoots',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"getQueuedWithdrawals"`
 */
export const readDelegationManagerGetQueuedWithdrawals =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'getQueuedWithdrawals',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"getSlashableSharesInQueue"`
 */
export const readDelegationManagerGetSlashableSharesInQueue =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'getSlashableSharesInQueue',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"getWithdrawableShares"`
 */
export const readDelegationManagerGetWithdrawableShares =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'getWithdrawableShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"isDelegated"`
 */
export const readDelegationManagerIsDelegated =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'isDelegated',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"isOperator"`
 */
export const readDelegationManagerIsOperator = /*#__PURE__*/ createReadContract(
  { abi: delegationManagerAbi, functionName: 'isOperator' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"minWithdrawalDelayBlocks"`
 */
export const readDelegationManagerMinWithdrawalDelayBlocks =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'minWithdrawalDelayBlocks',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"operatorShares"`
 */
export const readDelegationManagerOperatorShares =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'operatorShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"paused"`
 */
export const readDelegationManagerPaused = /*#__PURE__*/ createReadContract({
  abi: delegationManagerAbi,
  functionName: 'paused',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"pauserRegistry"`
 */
export const readDelegationManagerPauserRegistry =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'pauserRegistry',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"pendingWithdrawals"`
 */
export const readDelegationManagerPendingWithdrawals =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'pendingWithdrawals',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"permissionController"`
 */
export const readDelegationManagerPermissionController =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'permissionController',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"queuedWithdrawals"`
 */
export const readDelegationManagerQueuedWithdrawals =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'queuedWithdrawals',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"strategyManager"`
 */
export const readDelegationManagerStrategyManager =
  /*#__PURE__*/ createReadContract({
    abi: delegationManagerAbi,
    functionName: 'strategyManager',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"version"`
 */
export const readDelegationManagerVersion = /*#__PURE__*/ createReadContract({
  abi: delegationManagerAbi,
  functionName: 'version',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__
 */
export const writeDelegationManager = /*#__PURE__*/ createWriteContract({
  abi: delegationManagerAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"completeQueuedWithdrawal"`
 */
export const writeDelegationManagerCompleteQueuedWithdrawal =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'completeQueuedWithdrawal',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"completeQueuedWithdrawals"`
 */
export const writeDelegationManagerCompleteQueuedWithdrawals =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'completeQueuedWithdrawals',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"decreaseDelegatedShares"`
 */
export const writeDelegationManagerDecreaseDelegatedShares =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'decreaseDelegatedShares',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"delegateTo"`
 */
export const writeDelegationManagerDelegateTo =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'delegateTo',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"increaseDelegatedShares"`
 */
export const writeDelegationManagerIncreaseDelegatedShares =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'increaseDelegatedShares',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"initialize"`
 */
export const writeDelegationManagerInitialize =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"modifyOperatorDetails"`
 */
export const writeDelegationManagerModifyOperatorDetails =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'modifyOperatorDetails',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"pause"`
 */
export const writeDelegationManagerPause = /*#__PURE__*/ createWriteContract({
  abi: delegationManagerAbi,
  functionName: 'pause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"pauseAll"`
 */
export const writeDelegationManagerPauseAll = /*#__PURE__*/ createWriteContract(
  { abi: delegationManagerAbi, functionName: 'pauseAll' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"queueWithdrawals"`
 */
export const writeDelegationManagerQueueWithdrawals =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'queueWithdrawals',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"redelegate"`
 */
export const writeDelegationManagerRedelegate =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'redelegate',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"registerAsOperator"`
 */
export const writeDelegationManagerRegisterAsOperator =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'registerAsOperator',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"slashOperatorShares"`
 */
export const writeDelegationManagerSlashOperatorShares =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'slashOperatorShares',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"undelegate"`
 */
export const writeDelegationManagerUndelegate =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'undelegate',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"unpause"`
 */
export const writeDelegationManagerUnpause = /*#__PURE__*/ createWriteContract({
  abi: delegationManagerAbi,
  functionName: 'unpause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"updateOperatorMetadataURI"`
 */
export const writeDelegationManagerUpdateOperatorMetadataUri =
  /*#__PURE__*/ createWriteContract({
    abi: delegationManagerAbi,
    functionName: 'updateOperatorMetadataURI',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__
 */
export const simulateDelegationManager = /*#__PURE__*/ createSimulateContract({
  abi: delegationManagerAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"completeQueuedWithdrawal"`
 */
export const simulateDelegationManagerCompleteQueuedWithdrawal =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'completeQueuedWithdrawal',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"completeQueuedWithdrawals"`
 */
export const simulateDelegationManagerCompleteQueuedWithdrawals =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'completeQueuedWithdrawals',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"decreaseDelegatedShares"`
 */
export const simulateDelegationManagerDecreaseDelegatedShares =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'decreaseDelegatedShares',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"delegateTo"`
 */
export const simulateDelegationManagerDelegateTo =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'delegateTo',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"increaseDelegatedShares"`
 */
export const simulateDelegationManagerIncreaseDelegatedShares =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'increaseDelegatedShares',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"initialize"`
 */
export const simulateDelegationManagerInitialize =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"modifyOperatorDetails"`
 */
export const simulateDelegationManagerModifyOperatorDetails =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'modifyOperatorDetails',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"pause"`
 */
export const simulateDelegationManagerPause =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'pause',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"pauseAll"`
 */
export const simulateDelegationManagerPauseAll =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'pauseAll',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"queueWithdrawals"`
 */
export const simulateDelegationManagerQueueWithdrawals =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'queueWithdrawals',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"redelegate"`
 */
export const simulateDelegationManagerRedelegate =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'redelegate',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"registerAsOperator"`
 */
export const simulateDelegationManagerRegisterAsOperator =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'registerAsOperator',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"slashOperatorShares"`
 */
export const simulateDelegationManagerSlashOperatorShares =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'slashOperatorShares',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"undelegate"`
 */
export const simulateDelegationManagerUndelegate =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'undelegate',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"unpause"`
 */
export const simulateDelegationManagerUnpause =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'unpause',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link delegationManagerAbi}__ and `functionName` set to `"updateOperatorMetadataURI"`
 */
export const simulateDelegationManagerUpdateOperatorMetadataUri =
  /*#__PURE__*/ createSimulateContract({
    abi: delegationManagerAbi,
    functionName: 'updateOperatorMetadataURI',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__
 */
export const watchDelegationManagerEvent =
  /*#__PURE__*/ createWatchContractEvent({ abi: delegationManagerAbi })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"DelegationApproverUpdated"`
 */
export const watchDelegationManagerDelegationApproverUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'DelegationApproverUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"DepositScalingFactorUpdated"`
 */
export const watchDelegationManagerDepositScalingFactorUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'DepositScalingFactorUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"Initialized"`
 */
export const watchDelegationManagerInitializedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'Initialized',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"OperatorMetadataURIUpdated"`
 */
export const watchDelegationManagerOperatorMetadataUriUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'OperatorMetadataURIUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"OperatorRegistered"`
 */
export const watchDelegationManagerOperatorRegisteredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'OperatorRegistered',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"OperatorSharesDecreased"`
 */
export const watchDelegationManagerOperatorSharesDecreasedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'OperatorSharesDecreased',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"OperatorSharesIncreased"`
 */
export const watchDelegationManagerOperatorSharesIncreasedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'OperatorSharesIncreased',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"OperatorSharesSlashed"`
 */
export const watchDelegationManagerOperatorSharesSlashedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'OperatorSharesSlashed',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"Paused"`
 */
export const watchDelegationManagerPausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'Paused',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"SlashingWithdrawalCompleted"`
 */
export const watchDelegationManagerSlashingWithdrawalCompletedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'SlashingWithdrawalCompleted',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"SlashingWithdrawalQueued"`
 */
export const watchDelegationManagerSlashingWithdrawalQueuedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'SlashingWithdrawalQueued',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"StakerDelegated"`
 */
export const watchDelegationManagerStakerDelegatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'StakerDelegated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"StakerForceUndelegated"`
 */
export const watchDelegationManagerStakerForceUndelegatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'StakerForceUndelegated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"StakerUndelegated"`
 */
export const watchDelegationManagerStakerUndelegatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'StakerUndelegated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link delegationManagerAbi}__ and `eventName` set to `"Unpaused"`
 */
export const watchDelegationManagerUnpausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: delegationManagerAbi,
    eventName: 'Unpaused',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__
 */
export const readEigenPod = /*#__PURE__*/ createReadContract({
  abi: eigenPodAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"activeValidatorCount"`
 */
export const readEigenPodActiveValidatorCount =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodAbi,
    functionName: 'activeValidatorCount',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"checkpointBalanceExitedGwei"`
 */
export const readEigenPodCheckpointBalanceExitedGwei =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodAbi,
    functionName: 'checkpointBalanceExitedGwei',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"currentCheckpoint"`
 */
export const readEigenPodCurrentCheckpoint = /*#__PURE__*/ createReadContract({
  abi: eigenPodAbi,
  functionName: 'currentCheckpoint',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"currentCheckpointTimestamp"`
 */
export const readEigenPodCurrentCheckpointTimestamp =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodAbi,
    functionName: 'currentCheckpointTimestamp',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"eigenPodManager"`
 */
export const readEigenPodEigenPodManager = /*#__PURE__*/ createReadContract({
  abi: eigenPodAbi,
  functionName: 'eigenPodManager',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"ethPOS"`
 */
export const readEigenPodEthPos = /*#__PURE__*/ createReadContract({
  abi: eigenPodAbi,
  functionName: 'ethPOS',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"getConsolidationRequestFee"`
 */
export const readEigenPodGetConsolidationRequestFee =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodAbi,
    functionName: 'getConsolidationRequestFee',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"getParentBlockRoot"`
 */
export const readEigenPodGetParentBlockRoot = /*#__PURE__*/ createReadContract({
  abi: eigenPodAbi,
  functionName: 'getParentBlockRoot',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"getWithdrawalRequestFee"`
 */
export const readEigenPodGetWithdrawalRequestFee =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodAbi,
    functionName: 'getWithdrawalRequestFee',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"lastCheckpointTimestamp"`
 */
export const readEigenPodLastCheckpointTimestamp =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodAbi,
    functionName: 'lastCheckpointTimestamp',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"podOwner"`
 */
export const readEigenPodPodOwner = /*#__PURE__*/ createReadContract({
  abi: eigenPodAbi,
  functionName: 'podOwner',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"proofSubmitter"`
 */
export const readEigenPodProofSubmitter = /*#__PURE__*/ createReadContract({
  abi: eigenPodAbi,
  functionName: 'proofSubmitter',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"validatorPubkeyHashToInfo"`
 */
export const readEigenPodValidatorPubkeyHashToInfo =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodAbi,
    functionName: 'validatorPubkeyHashToInfo',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"validatorPubkeyToInfo"`
 */
export const readEigenPodValidatorPubkeyToInfo =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodAbi,
    functionName: 'validatorPubkeyToInfo',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"validatorStatus"`
 */
export const readEigenPodValidatorStatus = /*#__PURE__*/ createReadContract({
  abi: eigenPodAbi,
  functionName: 'validatorStatus',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"version"`
 */
export const readEigenPodVersion = /*#__PURE__*/ createReadContract({
  abi: eigenPodAbi,
  functionName: 'version',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"withdrawableRestakedExecutionLayerGwei"`
 */
export const readEigenPodWithdrawableRestakedExecutionLayerGwei =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodAbi,
    functionName: 'withdrawableRestakedExecutionLayerGwei',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodAbi}__
 */
export const writeEigenPod = /*#__PURE__*/ createWriteContract({
  abi: eigenPodAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"initialize"`
 */
export const writeEigenPodInitialize = /*#__PURE__*/ createWriteContract({
  abi: eigenPodAbi,
  functionName: 'initialize',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"recoverTokens"`
 */
export const writeEigenPodRecoverTokens = /*#__PURE__*/ createWriteContract({
  abi: eigenPodAbi,
  functionName: 'recoverTokens',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"requestConsolidation"`
 */
export const writeEigenPodRequestConsolidation =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodAbi,
    functionName: 'requestConsolidation',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"requestWithdrawal"`
 */
export const writeEigenPodRequestWithdrawal = /*#__PURE__*/ createWriteContract(
  { abi: eigenPodAbi, functionName: 'requestWithdrawal' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"setProofSubmitter"`
 */
export const writeEigenPodSetProofSubmitter = /*#__PURE__*/ createWriteContract(
  { abi: eigenPodAbi, functionName: 'setProofSubmitter' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"stake"`
 */
export const writeEigenPodStake = /*#__PURE__*/ createWriteContract({
  abi: eigenPodAbi,
  functionName: 'stake',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"startCheckpoint"`
 */
export const writeEigenPodStartCheckpoint = /*#__PURE__*/ createWriteContract({
  abi: eigenPodAbi,
  functionName: 'startCheckpoint',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"verifyCheckpointProofs"`
 */
export const writeEigenPodVerifyCheckpointProofs =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodAbi,
    functionName: 'verifyCheckpointProofs',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"verifyStaleBalance"`
 */
export const writeEigenPodVerifyStaleBalance =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodAbi,
    functionName: 'verifyStaleBalance',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"verifyWithdrawalCredentials"`
 */
export const writeEigenPodVerifyWithdrawalCredentials =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodAbi,
    functionName: 'verifyWithdrawalCredentials',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"withdrawRestakedBeaconChainETH"`
 */
export const writeEigenPodWithdrawRestakedBeaconChainEth =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodAbi,
    functionName: 'withdrawRestakedBeaconChainETH',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodAbi}__
 */
export const simulateEigenPod = /*#__PURE__*/ createSimulateContract({
  abi: eigenPodAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"initialize"`
 */
export const simulateEigenPodInitialize = /*#__PURE__*/ createSimulateContract({
  abi: eigenPodAbi,
  functionName: 'initialize',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"recoverTokens"`
 */
export const simulateEigenPodRecoverTokens =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodAbi,
    functionName: 'recoverTokens',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"requestConsolidation"`
 */
export const simulateEigenPodRequestConsolidation =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodAbi,
    functionName: 'requestConsolidation',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"requestWithdrawal"`
 */
export const simulateEigenPodRequestWithdrawal =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodAbi,
    functionName: 'requestWithdrawal',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"setProofSubmitter"`
 */
export const simulateEigenPodSetProofSubmitter =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodAbi,
    functionName: 'setProofSubmitter',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"stake"`
 */
export const simulateEigenPodStake = /*#__PURE__*/ createSimulateContract({
  abi: eigenPodAbi,
  functionName: 'stake',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"startCheckpoint"`
 */
export const simulateEigenPodStartCheckpoint =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodAbi,
    functionName: 'startCheckpoint',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"verifyCheckpointProofs"`
 */
export const simulateEigenPodVerifyCheckpointProofs =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodAbi,
    functionName: 'verifyCheckpointProofs',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"verifyStaleBalance"`
 */
export const simulateEigenPodVerifyStaleBalance =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodAbi,
    functionName: 'verifyStaleBalance',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"verifyWithdrawalCredentials"`
 */
export const simulateEigenPodVerifyWithdrawalCredentials =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodAbi,
    functionName: 'verifyWithdrawalCredentials',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodAbi}__ and `functionName` set to `"withdrawRestakedBeaconChainETH"`
 */
export const simulateEigenPodWithdrawRestakedBeaconChainEth =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodAbi,
    functionName: 'withdrawRestakedBeaconChainETH',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__
 */
export const watchEigenPodEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: eigenPodAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"CheckpointCreated"`
 */
export const watchEigenPodCheckpointCreatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'CheckpointCreated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"CheckpointFinalized"`
 */
export const watchEigenPodCheckpointFinalizedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'CheckpointFinalized',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"ConsolidationRequested"`
 */
export const watchEigenPodConsolidationRequestedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'ConsolidationRequested',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"EigenPodStaked"`
 */
export const watchEigenPodEigenPodStakedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'EigenPodStaked',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"ExitRequested"`
 */
export const watchEigenPodExitRequestedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'ExitRequested',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"Initialized"`
 */
export const watchEigenPodInitializedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'Initialized',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"NonBeaconChainETHReceived"`
 */
export const watchEigenPodNonBeaconChainEthReceivedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'NonBeaconChainETHReceived',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"ProofSubmitterUpdated"`
 */
export const watchEigenPodProofSubmitterUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'ProofSubmitterUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"RestakedBeaconChainETHWithdrawn"`
 */
export const watchEigenPodRestakedBeaconChainEthWithdrawnEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'RestakedBeaconChainETHWithdrawn',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"SwitchToCompoundingRequested"`
 */
export const watchEigenPodSwitchToCompoundingRequestedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'SwitchToCompoundingRequested',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"ValidatorBalanceUpdated"`
 */
export const watchEigenPodValidatorBalanceUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'ValidatorBalanceUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"ValidatorCheckpointed"`
 */
export const watchEigenPodValidatorCheckpointedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'ValidatorCheckpointed',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"ValidatorRestaked"`
 */
export const watchEigenPodValidatorRestakedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'ValidatorRestaked',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"ValidatorWithdrawn"`
 */
export const watchEigenPodValidatorWithdrawnEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'ValidatorWithdrawn',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodAbi}__ and `eventName` set to `"WithdrawalRequested"`
 */
export const watchEigenPodWithdrawalRequestedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodAbi,
    eventName: 'WithdrawalRequested',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__
 */
export const readEigenPodManager = /*#__PURE__*/ createReadContract({
  abi: eigenPodManagerAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"beaconChainETHStrategy"`
 */
export const readEigenPodManagerBeaconChainEthStrategy =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodManagerAbi,
    functionName: 'beaconChainETHStrategy',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"beaconChainSlashingFactor"`
 */
export const readEigenPodManagerBeaconChainSlashingFactor =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodManagerAbi,
    functionName: 'beaconChainSlashingFactor',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"burnableETHShares"`
 */
export const readEigenPodManagerBurnableEthShares =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodManagerAbi,
    functionName: 'burnableETHShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"delegationManager"`
 */
export const readEigenPodManagerDelegationManager =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodManagerAbi,
    functionName: 'delegationManager',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"eigenPodBeacon"`
 */
export const readEigenPodManagerEigenPodBeacon =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodManagerAbi,
    functionName: 'eigenPodBeacon',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"ethPOS"`
 */
export const readEigenPodManagerEthPos = /*#__PURE__*/ createReadContract({
  abi: eigenPodManagerAbi,
  functionName: 'ethPOS',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"getPod"`
 */
export const readEigenPodManagerGetPod = /*#__PURE__*/ createReadContract({
  abi: eigenPodManagerAbi,
  functionName: 'getPod',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"hasPod"`
 */
export const readEigenPodManagerHasPod = /*#__PURE__*/ createReadContract({
  abi: eigenPodManagerAbi,
  functionName: 'hasPod',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"numPods"`
 */
export const readEigenPodManagerNumPods = /*#__PURE__*/ createReadContract({
  abi: eigenPodManagerAbi,
  functionName: 'numPods',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"owner"`
 */
export const readEigenPodManagerOwner = /*#__PURE__*/ createReadContract({
  abi: eigenPodManagerAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"ownerToPod"`
 */
export const readEigenPodManagerOwnerToPod = /*#__PURE__*/ createReadContract({
  abi: eigenPodManagerAbi,
  functionName: 'ownerToPod',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"paused"`
 */
export const readEigenPodManagerPaused = /*#__PURE__*/ createReadContract({
  abi: eigenPodManagerAbi,
  functionName: 'paused',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"pauserRegistry"`
 */
export const readEigenPodManagerPauserRegistry =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodManagerAbi,
    functionName: 'pauserRegistry',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"pectraForkTimestamp"`
 */
export const readEigenPodManagerPectraForkTimestamp =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodManagerAbi,
    functionName: 'pectraForkTimestamp',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"podOwnerDepositShares"`
 */
export const readEigenPodManagerPodOwnerDepositShares =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodManagerAbi,
    functionName: 'podOwnerDepositShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"proofTimestampSetter"`
 */
export const readEigenPodManagerProofTimestampSetter =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodManagerAbi,
    functionName: 'proofTimestampSetter',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"stakerDepositShares"`
 */
export const readEigenPodManagerStakerDepositShares =
  /*#__PURE__*/ createReadContract({
    abi: eigenPodManagerAbi,
    functionName: 'stakerDepositShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"version"`
 */
export const readEigenPodManagerVersion = /*#__PURE__*/ createReadContract({
  abi: eigenPodManagerAbi,
  functionName: 'version',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__
 */
export const writeEigenPodManager = /*#__PURE__*/ createWriteContract({
  abi: eigenPodManagerAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"addShares"`
 */
export const writeEigenPodManagerAddShares = /*#__PURE__*/ createWriteContract({
  abi: eigenPodManagerAbi,
  functionName: 'addShares',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"createPod"`
 */
export const writeEigenPodManagerCreatePod = /*#__PURE__*/ createWriteContract({
  abi: eigenPodManagerAbi,
  functionName: 'createPod',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"increaseBurnOrRedistributableShares"`
 */
export const writeEigenPodManagerIncreaseBurnOrRedistributableShares =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodManagerAbi,
    functionName: 'increaseBurnOrRedistributableShares',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"initialize"`
 */
export const writeEigenPodManagerInitialize = /*#__PURE__*/ createWriteContract(
  { abi: eigenPodManagerAbi, functionName: 'initialize' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"pause"`
 */
export const writeEigenPodManagerPause = /*#__PURE__*/ createWriteContract({
  abi: eigenPodManagerAbi,
  functionName: 'pause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"pauseAll"`
 */
export const writeEigenPodManagerPauseAll = /*#__PURE__*/ createWriteContract({
  abi: eigenPodManagerAbi,
  functionName: 'pauseAll',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"recordBeaconChainETHBalanceUpdate"`
 */
export const writeEigenPodManagerRecordBeaconChainEthBalanceUpdate =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodManagerAbi,
    functionName: 'recordBeaconChainETHBalanceUpdate',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"removeDepositShares"`
 */
export const writeEigenPodManagerRemoveDepositShares =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodManagerAbi,
    functionName: 'removeDepositShares',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const writeEigenPodManagerRenounceOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodManagerAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"setPectraForkTimestamp"`
 */
export const writeEigenPodManagerSetPectraForkTimestamp =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodManagerAbi,
    functionName: 'setPectraForkTimestamp',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"setProofTimestampSetter"`
 */
export const writeEigenPodManagerSetProofTimestampSetter =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodManagerAbi,
    functionName: 'setProofTimestampSetter',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"stake"`
 */
export const writeEigenPodManagerStake = /*#__PURE__*/ createWriteContract({
  abi: eigenPodManagerAbi,
  functionName: 'stake',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const writeEigenPodManagerTransferOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodManagerAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"unpause"`
 */
export const writeEigenPodManagerUnpause = /*#__PURE__*/ createWriteContract({
  abi: eigenPodManagerAbi,
  functionName: 'unpause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"withdrawSharesAsTokens"`
 */
export const writeEigenPodManagerWithdrawSharesAsTokens =
  /*#__PURE__*/ createWriteContract({
    abi: eigenPodManagerAbi,
    functionName: 'withdrawSharesAsTokens',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__
 */
export const simulateEigenPodManager = /*#__PURE__*/ createSimulateContract({
  abi: eigenPodManagerAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"addShares"`
 */
export const simulateEigenPodManagerAddShares =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'addShares',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"createPod"`
 */
export const simulateEigenPodManagerCreatePod =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'createPod',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"increaseBurnOrRedistributableShares"`
 */
export const simulateEigenPodManagerIncreaseBurnOrRedistributableShares =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'increaseBurnOrRedistributableShares',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"initialize"`
 */
export const simulateEigenPodManagerInitialize =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"pause"`
 */
export const simulateEigenPodManagerPause =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'pause',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"pauseAll"`
 */
export const simulateEigenPodManagerPauseAll =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'pauseAll',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"recordBeaconChainETHBalanceUpdate"`
 */
export const simulateEigenPodManagerRecordBeaconChainEthBalanceUpdate =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'recordBeaconChainETHBalanceUpdate',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"removeDepositShares"`
 */
export const simulateEigenPodManagerRemoveDepositShares =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'removeDepositShares',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const simulateEigenPodManagerRenounceOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"setPectraForkTimestamp"`
 */
export const simulateEigenPodManagerSetPectraForkTimestamp =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'setPectraForkTimestamp',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"setProofTimestampSetter"`
 */
export const simulateEigenPodManagerSetProofTimestampSetter =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'setProofTimestampSetter',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"stake"`
 */
export const simulateEigenPodManagerStake =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'stake',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const simulateEigenPodManagerTransferOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"unpause"`
 */
export const simulateEigenPodManagerUnpause =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'unpause',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `functionName` set to `"withdrawSharesAsTokens"`
 */
export const simulateEigenPodManagerWithdrawSharesAsTokens =
  /*#__PURE__*/ createSimulateContract({
    abi: eigenPodManagerAbi,
    functionName: 'withdrawSharesAsTokens',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__
 */
export const watchEigenPodManagerEvent = /*#__PURE__*/ createWatchContractEvent(
  { abi: eigenPodManagerAbi },
)

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"BeaconChainETHDeposited"`
 */
export const watchEigenPodManagerBeaconChainEthDepositedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'BeaconChainETHDeposited',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"BeaconChainETHWithdrawalCompleted"`
 */
export const watchEigenPodManagerBeaconChainEthWithdrawalCompletedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'BeaconChainETHWithdrawalCompleted',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"BeaconChainSlashingFactorDecreased"`
 */
export const watchEigenPodManagerBeaconChainSlashingFactorDecreasedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'BeaconChainSlashingFactorDecreased',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"BurnableETHSharesIncreased"`
 */
export const watchEigenPodManagerBurnableEthSharesIncreasedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'BurnableETHSharesIncreased',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"Initialized"`
 */
export const watchEigenPodManagerInitializedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'Initialized',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"NewTotalShares"`
 */
export const watchEigenPodManagerNewTotalSharesEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'NewTotalShares',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const watchEigenPodManagerOwnershipTransferredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"Paused"`
 */
export const watchEigenPodManagerPausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'Paused',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"PectraForkTimestampSet"`
 */
export const watchEigenPodManagerPectraForkTimestampSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'PectraForkTimestampSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"PodDeployed"`
 */
export const watchEigenPodManagerPodDeployedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'PodDeployed',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"PodSharesUpdated"`
 */
export const watchEigenPodManagerPodSharesUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'PodSharesUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"ProofTimestampSetterSet"`
 */
export const watchEigenPodManagerProofTimestampSetterSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'ProofTimestampSetterSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link eigenPodManagerAbi}__ and `eventName` set to `"Unpaused"`
 */
export const watchEigenPodManagerUnpausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: eigenPodManagerAbi,
    eventName: 'Unpaused',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__
 */
export const readGateway = /*#__PURE__*/ createReadContract({ abi: gatewayAbi })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"AGENT_EXECUTOR"`
 */
export const readGatewayAgentExecutor = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'AGENT_EXECUTOR',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"BEEFY_CLIENT"`
 */
export const readGatewayBeefyClient = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'BEEFY_CLIENT',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"agentOf"`
 */
export const readGatewayAgentOf = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'agentOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"channelNoncesOf"`
 */
export const readGatewayChannelNoncesOf = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'channelNoncesOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"channelOperatingModeOf"`
 */
export const readGatewayChannelOperatingModeOf =
  /*#__PURE__*/ createReadContract({
    abi: gatewayAbi,
    functionName: 'channelOperatingModeOf',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"implementation"`
 */
export const readGatewayImplementation = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'implementation',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"isTokenRegistered"`
 */
export const readGatewayIsTokenRegistered = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'isTokenRegistered',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"operatingMode"`
 */
export const readGatewayOperatingMode = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'operatingMode',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"pricingParameters"`
 */
export const readGatewayPricingParameters = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'pricingParameters',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"queryForeignTokenID"`
 */
export const readGatewayQueryForeignTokenId = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'queryForeignTokenID',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"quoteRegisterTokenFee"`
 */
export const readGatewayQuoteRegisterTokenFee =
  /*#__PURE__*/ createReadContract({
    abi: gatewayAbi,
    functionName: 'quoteRegisterTokenFee',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"quoteSendTokenFee"`
 */
export const readGatewayQuoteSendTokenFee = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'quoteSendTokenFee',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"tokenAddressOf"`
 */
export const readGatewayTokenAddressOf = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'tokenAddressOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_isDispatched"`
 */
export const readGatewayV2IsDispatched = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'v2_isDispatched',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_outboundNonce"`
 */
export const readGatewayV2OutboundNonce = /*#__PURE__*/ createReadContract({
  abi: gatewayAbi,
  functionName: 'v2_outboundNonce',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__
 */
export const writeGateway = /*#__PURE__*/ createWriteContract({
  abi: gatewayAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"depositEther"`
 */
export const writeGatewayDepositEther = /*#__PURE__*/ createWriteContract({
  abi: gatewayAbi,
  functionName: 'depositEther',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"initialize"`
 */
export const writeGatewayInitialize = /*#__PURE__*/ createWriteContract({
  abi: gatewayAbi,
  functionName: 'initialize',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"registerToken"`
 */
export const writeGatewayRegisterToken = /*#__PURE__*/ createWriteContract({
  abi: gatewayAbi,
  functionName: 'registerToken',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"sendToken"`
 */
export const writeGatewaySendToken = /*#__PURE__*/ createWriteContract({
  abi: gatewayAbi,
  functionName: 'sendToken',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"submitV1"`
 */
export const writeGatewaySubmitV1 = /*#__PURE__*/ createWriteContract({
  abi: gatewayAbi,
  functionName: 'submitV1',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleAgentExecute"`
 */
export const writeGatewayV1HandleAgentExecute =
  /*#__PURE__*/ createWriteContract({
    abi: gatewayAbi,
    functionName: 'v1_handleAgentExecute',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleMintForeignToken"`
 */
export const writeGatewayV1HandleMintForeignToken =
  /*#__PURE__*/ createWriteContract({
    abi: gatewayAbi,
    functionName: 'v1_handleMintForeignToken',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleRegisterForeignToken"`
 */
export const writeGatewayV1HandleRegisterForeignToken =
  /*#__PURE__*/ createWriteContract({
    abi: gatewayAbi,
    functionName: 'v1_handleRegisterForeignToken',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleSetOperatingMode"`
 */
export const writeGatewayV1HandleSetOperatingMode =
  /*#__PURE__*/ createWriteContract({
    abi: gatewayAbi,
    functionName: 'v1_handleSetOperatingMode',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleSetPricingParameters"`
 */
export const writeGatewayV1HandleSetPricingParameters =
  /*#__PURE__*/ createWriteContract({
    abi: gatewayAbi,
    functionName: 'v1_handleSetPricingParameters',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleSetTokenTransferFees"`
 */
export const writeGatewayV1HandleSetTokenTransferFees =
  /*#__PURE__*/ createWriteContract({
    abi: gatewayAbi,
    functionName: 'v1_handleSetTokenTransferFees',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleUnlockNativeToken"`
 */
export const writeGatewayV1HandleUnlockNativeToken =
  /*#__PURE__*/ createWriteContract({
    abi: gatewayAbi,
    functionName: 'v1_handleUnlockNativeToken',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleUpgrade"`
 */
export const writeGatewayV1HandleUpgrade = /*#__PURE__*/ createWriteContract({
  abi: gatewayAbi,
  functionName: 'v1_handleUpgrade',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_createAgent"`
 */
export const writeGatewayV2CreateAgent = /*#__PURE__*/ createWriteContract({
  abi: gatewayAbi,
  functionName: 'v2_createAgent',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_handleCallContract"`
 */
export const writeGatewayV2HandleCallContract =
  /*#__PURE__*/ createWriteContract({
    abi: gatewayAbi,
    functionName: 'v2_handleCallContract',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_handleMintForeignToken"`
 */
export const writeGatewayV2HandleMintForeignToken =
  /*#__PURE__*/ createWriteContract({
    abi: gatewayAbi,
    functionName: 'v2_handleMintForeignToken',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_handleRegisterForeignToken"`
 */
export const writeGatewayV2HandleRegisterForeignToken =
  /*#__PURE__*/ createWriteContract({
    abi: gatewayAbi,
    functionName: 'v2_handleRegisterForeignToken',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_handleSetOperatingMode"`
 */
export const writeGatewayV2HandleSetOperatingMode =
  /*#__PURE__*/ createWriteContract({
    abi: gatewayAbi,
    functionName: 'v2_handleSetOperatingMode',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_handleUnlockNativeToken"`
 */
export const writeGatewayV2HandleUnlockNativeToken =
  /*#__PURE__*/ createWriteContract({
    abi: gatewayAbi,
    functionName: 'v2_handleUnlockNativeToken',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_handleUpgrade"`
 */
export const writeGatewayV2HandleUpgrade = /*#__PURE__*/ createWriteContract({
  abi: gatewayAbi,
  functionName: 'v2_handleUpgrade',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_registerToken"`
 */
export const writeGatewayV2RegisterToken = /*#__PURE__*/ createWriteContract({
  abi: gatewayAbi,
  functionName: 'v2_registerToken',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_sendMessage"`
 */
export const writeGatewayV2SendMessage = /*#__PURE__*/ createWriteContract({
  abi: gatewayAbi,
  functionName: 'v2_sendMessage',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_submit"`
 */
export const writeGatewayV2Submit = /*#__PURE__*/ createWriteContract({
  abi: gatewayAbi,
  functionName: 'v2_submit',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__
 */
export const simulateGateway = /*#__PURE__*/ createSimulateContract({
  abi: gatewayAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"depositEther"`
 */
export const simulateGatewayDepositEther = /*#__PURE__*/ createSimulateContract(
  { abi: gatewayAbi, functionName: 'depositEther' },
)

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"initialize"`
 */
export const simulateGatewayInitialize = /*#__PURE__*/ createSimulateContract({
  abi: gatewayAbi,
  functionName: 'initialize',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"registerToken"`
 */
export const simulateGatewayRegisterToken =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'registerToken',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"sendToken"`
 */
export const simulateGatewaySendToken = /*#__PURE__*/ createSimulateContract({
  abi: gatewayAbi,
  functionName: 'sendToken',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"submitV1"`
 */
export const simulateGatewaySubmitV1 = /*#__PURE__*/ createSimulateContract({
  abi: gatewayAbi,
  functionName: 'submitV1',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleAgentExecute"`
 */
export const simulateGatewayV1HandleAgentExecute =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v1_handleAgentExecute',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleMintForeignToken"`
 */
export const simulateGatewayV1HandleMintForeignToken =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v1_handleMintForeignToken',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleRegisterForeignToken"`
 */
export const simulateGatewayV1HandleRegisterForeignToken =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v1_handleRegisterForeignToken',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleSetOperatingMode"`
 */
export const simulateGatewayV1HandleSetOperatingMode =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v1_handleSetOperatingMode',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleSetPricingParameters"`
 */
export const simulateGatewayV1HandleSetPricingParameters =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v1_handleSetPricingParameters',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleSetTokenTransferFees"`
 */
export const simulateGatewayV1HandleSetTokenTransferFees =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v1_handleSetTokenTransferFees',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleUnlockNativeToken"`
 */
export const simulateGatewayV1HandleUnlockNativeToken =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v1_handleUnlockNativeToken',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v1_handleUpgrade"`
 */
export const simulateGatewayV1HandleUpgrade =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v1_handleUpgrade',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_createAgent"`
 */
export const simulateGatewayV2CreateAgent =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v2_createAgent',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_handleCallContract"`
 */
export const simulateGatewayV2HandleCallContract =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v2_handleCallContract',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_handleMintForeignToken"`
 */
export const simulateGatewayV2HandleMintForeignToken =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v2_handleMintForeignToken',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_handleRegisterForeignToken"`
 */
export const simulateGatewayV2HandleRegisterForeignToken =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v2_handleRegisterForeignToken',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_handleSetOperatingMode"`
 */
export const simulateGatewayV2HandleSetOperatingMode =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v2_handleSetOperatingMode',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_handleUnlockNativeToken"`
 */
export const simulateGatewayV2HandleUnlockNativeToken =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v2_handleUnlockNativeToken',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_handleUpgrade"`
 */
export const simulateGatewayV2HandleUpgrade =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v2_handleUpgrade',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_registerToken"`
 */
export const simulateGatewayV2RegisterToken =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v2_registerToken',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_sendMessage"`
 */
export const simulateGatewayV2SendMessage =
  /*#__PURE__*/ createSimulateContract({
    abi: gatewayAbi,
    functionName: 'v2_sendMessage',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link gatewayAbi}__ and `functionName` set to `"v2_submit"`
 */
export const simulateGatewayV2Submit = /*#__PURE__*/ createSimulateContract({
  abi: gatewayAbi,
  functionName: 'v2_submit',
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__
 */
export const watchGatewayEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: gatewayAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"AgentCreated"`
 */
export const watchGatewayAgentCreatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: gatewayAbi,
    eventName: 'AgentCreated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"AgentFundsWithdrawn"`
 */
export const watchGatewayAgentFundsWithdrawnEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: gatewayAbi,
    eventName: 'AgentFundsWithdrawn',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"CommandFailed"`
 */
export const watchGatewayCommandFailedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: gatewayAbi,
    eventName: 'CommandFailed',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"Deposited"`
 */
export const watchGatewayDepositedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: gatewayAbi,
    eventName: 'Deposited',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"ForeignTokenRegistered"`
 */
export const watchGatewayForeignTokenRegisteredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: gatewayAbi,
    eventName: 'ForeignTokenRegistered',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"InboundMessageDispatched"`
 */
export const watchGatewayInboundMessageDispatchedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: gatewayAbi,
    eventName: 'InboundMessageDispatched',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"OperatingModeChanged"`
 */
export const watchGatewayOperatingModeChangedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: gatewayAbi,
    eventName: 'OperatingModeChanged',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"OutboundMessageAccepted"`
 */
export const watchGatewayOutboundMessageAcceptedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: gatewayAbi,
    eventName: 'OutboundMessageAccepted',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"PricingParametersChanged"`
 */
export const watchGatewayPricingParametersChangedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: gatewayAbi,
    eventName: 'PricingParametersChanged',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"TokenRegistrationSent"`
 */
export const watchGatewayTokenRegistrationSentEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: gatewayAbi,
    eventName: 'TokenRegistrationSent',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"TokenSent"`
 */
export const watchGatewayTokenSentEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: gatewayAbi,
    eventName: 'TokenSent',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"TokenTransferFeesChanged"`
 */
export const watchGatewayTokenTransferFeesChangedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: gatewayAbi,
    eventName: 'TokenTransferFeesChanged',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link gatewayAbi}__ and `eventName` set to `"Upgraded"`
 */
export const watchGatewayUpgradedEvent = /*#__PURE__*/ createWatchContractEvent(
  { abi: gatewayAbi, eventName: 'Upgraded' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link iethposDepositAbi}__
 */
export const readIethposDeposit = /*#__PURE__*/ createReadContract({
  abi: iethposDepositAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link iethposDepositAbi}__ and `functionName` set to `"get_deposit_count"`
 */
export const readIethposDepositGetDepositCount =
  /*#__PURE__*/ createReadContract({
    abi: iethposDepositAbi,
    functionName: 'get_deposit_count',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link iethposDepositAbi}__ and `functionName` set to `"get_deposit_root"`
 */
export const readIethposDepositGetDepositRoot =
  /*#__PURE__*/ createReadContract({
    abi: iethposDepositAbi,
    functionName: 'get_deposit_root',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link iethposDepositAbi}__
 */
export const writeIethposDeposit = /*#__PURE__*/ createWriteContract({
  abi: iethposDepositAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link iethposDepositAbi}__ and `functionName` set to `"deposit"`
 */
export const writeIethposDepositDeposit = /*#__PURE__*/ createWriteContract({
  abi: iethposDepositAbi,
  functionName: 'deposit',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link iethposDepositAbi}__
 */
export const simulateIethposDeposit = /*#__PURE__*/ createSimulateContract({
  abi: iethposDepositAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link iethposDepositAbi}__ and `functionName` set to `"deposit"`
 */
export const simulateIethposDepositDeposit =
  /*#__PURE__*/ createSimulateContract({
    abi: iethposDepositAbi,
    functionName: 'deposit',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link iethposDepositAbi}__
 */
export const watchIethposDepositEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: iethposDepositAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link iethposDepositAbi}__ and `eventName` set to `"DepositEvent"`
 */
export const watchIethposDepositDepositEventEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: iethposDepositAbi,
    eventName: 'DepositEvent',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__
 */
export const readITransparentUpgradeableProxy =
  /*#__PURE__*/ createReadContract({ abi: iTransparentUpgradeableProxyAbi })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__ and `functionName` set to `"admin"`
 */
export const readITransparentUpgradeableProxyAdmin =
  /*#__PURE__*/ createReadContract({
    abi: iTransparentUpgradeableProxyAbi,
    functionName: 'admin',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__ and `functionName` set to `"implementation"`
 */
export const readITransparentUpgradeableProxyImplementation =
  /*#__PURE__*/ createReadContract({
    abi: iTransparentUpgradeableProxyAbi,
    functionName: 'implementation',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__
 */
export const writeITransparentUpgradeableProxy =
  /*#__PURE__*/ createWriteContract({ abi: iTransparentUpgradeableProxyAbi })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__ and `functionName` set to `"changeAdmin"`
 */
export const writeITransparentUpgradeableProxyChangeAdmin =
  /*#__PURE__*/ createWriteContract({
    abi: iTransparentUpgradeableProxyAbi,
    functionName: 'changeAdmin',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__ and `functionName` set to `"upgradeTo"`
 */
export const writeITransparentUpgradeableProxyUpgradeTo =
  /*#__PURE__*/ createWriteContract({
    abi: iTransparentUpgradeableProxyAbi,
    functionName: 'upgradeTo',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__ and `functionName` set to `"upgradeToAndCall"`
 */
export const writeITransparentUpgradeableProxyUpgradeToAndCall =
  /*#__PURE__*/ createWriteContract({
    abi: iTransparentUpgradeableProxyAbi,
    functionName: 'upgradeToAndCall',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__
 */
export const simulateITransparentUpgradeableProxy =
  /*#__PURE__*/ createSimulateContract({ abi: iTransparentUpgradeableProxyAbi })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__ and `functionName` set to `"changeAdmin"`
 */
export const simulateITransparentUpgradeableProxyChangeAdmin =
  /*#__PURE__*/ createSimulateContract({
    abi: iTransparentUpgradeableProxyAbi,
    functionName: 'changeAdmin',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__ and `functionName` set to `"upgradeTo"`
 */
export const simulateITransparentUpgradeableProxyUpgradeTo =
  /*#__PURE__*/ createSimulateContract({
    abi: iTransparentUpgradeableProxyAbi,
    functionName: 'upgradeTo',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__ and `functionName` set to `"upgradeToAndCall"`
 */
export const simulateITransparentUpgradeableProxyUpgradeToAndCall =
  /*#__PURE__*/ createSimulateContract({
    abi: iTransparentUpgradeableProxyAbi,
    functionName: 'upgradeToAndCall',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__
 */
export const watchITransparentUpgradeableProxyEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: iTransparentUpgradeableProxyAbi,
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__ and `eventName` set to `"AdminChanged"`
 */
export const watchITransparentUpgradeableProxyAdminChangedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: iTransparentUpgradeableProxyAbi,
    eventName: 'AdminChanged',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__ and `eventName` set to `"BeaconUpgraded"`
 */
export const watchITransparentUpgradeableProxyBeaconUpgradedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: iTransparentUpgradeableProxyAbi,
    eventName: 'BeaconUpgraded',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link iTransparentUpgradeableProxyAbi}__ and `eventName` set to `"Upgraded"`
 */
export const watchITransparentUpgradeableProxyUpgradedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: iTransparentUpgradeableProxyAbi,
    eventName: 'Upgraded',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link permissionControllerAbi}__
 */
export const readPermissionController = /*#__PURE__*/ createReadContract({
  abi: permissionControllerAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"canCall"`
 */
export const readPermissionControllerCanCall = /*#__PURE__*/ createReadContract(
  { abi: permissionControllerAbi, functionName: 'canCall' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"getAdmins"`
 */
export const readPermissionControllerGetAdmins =
  /*#__PURE__*/ createReadContract({
    abi: permissionControllerAbi,
    functionName: 'getAdmins',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"getAppointeePermissions"`
 */
export const readPermissionControllerGetAppointeePermissions =
  /*#__PURE__*/ createReadContract({
    abi: permissionControllerAbi,
    functionName: 'getAppointeePermissions',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"getAppointees"`
 */
export const readPermissionControllerGetAppointees =
  /*#__PURE__*/ createReadContract({
    abi: permissionControllerAbi,
    functionName: 'getAppointees',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"getPendingAdmins"`
 */
export const readPermissionControllerGetPendingAdmins =
  /*#__PURE__*/ createReadContract({
    abi: permissionControllerAbi,
    functionName: 'getPendingAdmins',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"isAdmin"`
 */
export const readPermissionControllerIsAdmin = /*#__PURE__*/ createReadContract(
  { abi: permissionControllerAbi, functionName: 'isAdmin' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"isPendingAdmin"`
 */
export const readPermissionControllerIsPendingAdmin =
  /*#__PURE__*/ createReadContract({
    abi: permissionControllerAbi,
    functionName: 'isPendingAdmin',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"version"`
 */
export const readPermissionControllerVersion = /*#__PURE__*/ createReadContract(
  { abi: permissionControllerAbi, functionName: 'version' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link permissionControllerAbi}__
 */
export const writePermissionController = /*#__PURE__*/ createWriteContract({
  abi: permissionControllerAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"acceptAdmin"`
 */
export const writePermissionControllerAcceptAdmin =
  /*#__PURE__*/ createWriteContract({
    abi: permissionControllerAbi,
    functionName: 'acceptAdmin',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"addPendingAdmin"`
 */
export const writePermissionControllerAddPendingAdmin =
  /*#__PURE__*/ createWriteContract({
    abi: permissionControllerAbi,
    functionName: 'addPendingAdmin',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"removeAdmin"`
 */
export const writePermissionControllerRemoveAdmin =
  /*#__PURE__*/ createWriteContract({
    abi: permissionControllerAbi,
    functionName: 'removeAdmin',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"removeAppointee"`
 */
export const writePermissionControllerRemoveAppointee =
  /*#__PURE__*/ createWriteContract({
    abi: permissionControllerAbi,
    functionName: 'removeAppointee',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"removePendingAdmin"`
 */
export const writePermissionControllerRemovePendingAdmin =
  /*#__PURE__*/ createWriteContract({
    abi: permissionControllerAbi,
    functionName: 'removePendingAdmin',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"setAppointee"`
 */
export const writePermissionControllerSetAppointee =
  /*#__PURE__*/ createWriteContract({
    abi: permissionControllerAbi,
    functionName: 'setAppointee',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link permissionControllerAbi}__
 */
export const simulatePermissionController =
  /*#__PURE__*/ createSimulateContract({ abi: permissionControllerAbi })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"acceptAdmin"`
 */
export const simulatePermissionControllerAcceptAdmin =
  /*#__PURE__*/ createSimulateContract({
    abi: permissionControllerAbi,
    functionName: 'acceptAdmin',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"addPendingAdmin"`
 */
export const simulatePermissionControllerAddPendingAdmin =
  /*#__PURE__*/ createSimulateContract({
    abi: permissionControllerAbi,
    functionName: 'addPendingAdmin',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"removeAdmin"`
 */
export const simulatePermissionControllerRemoveAdmin =
  /*#__PURE__*/ createSimulateContract({
    abi: permissionControllerAbi,
    functionName: 'removeAdmin',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"removeAppointee"`
 */
export const simulatePermissionControllerRemoveAppointee =
  /*#__PURE__*/ createSimulateContract({
    abi: permissionControllerAbi,
    functionName: 'removeAppointee',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"removePendingAdmin"`
 */
export const simulatePermissionControllerRemovePendingAdmin =
  /*#__PURE__*/ createSimulateContract({
    abi: permissionControllerAbi,
    functionName: 'removePendingAdmin',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link permissionControllerAbi}__ and `functionName` set to `"setAppointee"`
 */
export const simulatePermissionControllerSetAppointee =
  /*#__PURE__*/ createSimulateContract({
    abi: permissionControllerAbi,
    functionName: 'setAppointee',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link permissionControllerAbi}__
 */
export const watchPermissionControllerEvent =
  /*#__PURE__*/ createWatchContractEvent({ abi: permissionControllerAbi })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link permissionControllerAbi}__ and `eventName` set to `"AdminRemoved"`
 */
export const watchPermissionControllerAdminRemovedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: permissionControllerAbi,
    eventName: 'AdminRemoved',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link permissionControllerAbi}__ and `eventName` set to `"AdminSet"`
 */
export const watchPermissionControllerAdminSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: permissionControllerAbi,
    eventName: 'AdminSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link permissionControllerAbi}__ and `eventName` set to `"AppointeeRemoved"`
 */
export const watchPermissionControllerAppointeeRemovedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: permissionControllerAbi,
    eventName: 'AppointeeRemoved',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link permissionControllerAbi}__ and `eventName` set to `"AppointeeSet"`
 */
export const watchPermissionControllerAppointeeSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: permissionControllerAbi,
    eventName: 'AppointeeSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link permissionControllerAbi}__ and `eventName` set to `"Initialized"`
 */
export const watchPermissionControllerInitializedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: permissionControllerAbi,
    eventName: 'Initialized',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link permissionControllerAbi}__ and `eventName` set to `"PendingAdminAdded"`
 */
export const watchPermissionControllerPendingAdminAddedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: permissionControllerAbi,
    eventName: 'PendingAdminAdded',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link permissionControllerAbi}__ and `eventName` set to `"PendingAdminRemoved"`
 */
export const watchPermissionControllerPendingAdminRemovedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: permissionControllerAbi,
    eventName: 'PendingAdminRemoved',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__
 */
export const readRewardsCoordinator = /*#__PURE__*/ createReadContract({
  abi: rewardsCoordinatorAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"CALCULATION_INTERVAL_SECONDS"`
 */
export const readRewardsCoordinatorCalculationIntervalSeconds =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'CALCULATION_INTERVAL_SECONDS',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"GENESIS_REWARDS_TIMESTAMP"`
 */
export const readRewardsCoordinatorGenesisRewardsTimestamp =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'GENESIS_REWARDS_TIMESTAMP',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"MAX_FUTURE_LENGTH"`
 */
export const readRewardsCoordinatorMaxFutureLength =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'MAX_FUTURE_LENGTH',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"MAX_RETROACTIVE_LENGTH"`
 */
export const readRewardsCoordinatorMaxRetroactiveLength =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'MAX_RETROACTIVE_LENGTH',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"MAX_REWARDS_DURATION"`
 */
export const readRewardsCoordinatorMaxRewardsDuration =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'MAX_REWARDS_DURATION',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"activationDelay"`
 */
export const readRewardsCoordinatorActivationDelay =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'activationDelay',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"allocationManager"`
 */
export const readRewardsCoordinatorAllocationManager =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'allocationManager',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"beaconChainETHStrategy"`
 */
export const readRewardsCoordinatorBeaconChainEthStrategy =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'beaconChainETHStrategy',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"calculateEarnerLeafHash"`
 */
export const readRewardsCoordinatorCalculateEarnerLeafHash =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'calculateEarnerLeafHash',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"calculateTokenLeafHash"`
 */
export const readRewardsCoordinatorCalculateTokenLeafHash =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'calculateTokenLeafHash',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"checkClaim"`
 */
export const readRewardsCoordinatorCheckClaim =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'checkClaim',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"claimerFor"`
 */
export const readRewardsCoordinatorClaimerFor =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'claimerFor',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"cumulativeClaimed"`
 */
export const readRewardsCoordinatorCumulativeClaimed =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'cumulativeClaimed',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"currRewardsCalculationEndTimestamp"`
 */
export const readRewardsCoordinatorCurrRewardsCalculationEndTimestamp =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'currRewardsCalculationEndTimestamp',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"defaultOperatorSplitBips"`
 */
export const readRewardsCoordinatorDefaultOperatorSplitBips =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'defaultOperatorSplitBips',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"delegationManager"`
 */
export const readRewardsCoordinatorDelegationManager =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'delegationManager',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"getCurrentClaimableDistributionRoot"`
 */
export const readRewardsCoordinatorGetCurrentClaimableDistributionRoot =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'getCurrentClaimableDistributionRoot',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"getCurrentDistributionRoot"`
 */
export const readRewardsCoordinatorGetCurrentDistributionRoot =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'getCurrentDistributionRoot',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"getDistributionRootAtIndex"`
 */
export const readRewardsCoordinatorGetDistributionRootAtIndex =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'getDistributionRootAtIndex',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"getDistributionRootsLength"`
 */
export const readRewardsCoordinatorGetDistributionRootsLength =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'getDistributionRootsLength',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"getOperatorAVSSplit"`
 */
export const readRewardsCoordinatorGetOperatorAvsSplit =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'getOperatorAVSSplit',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"getOperatorPISplit"`
 */
export const readRewardsCoordinatorGetOperatorPiSplit =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'getOperatorPISplit',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"getOperatorSetSplit"`
 */
export const readRewardsCoordinatorGetOperatorSetSplit =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'getOperatorSetSplit',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"getRootIndexFromHash"`
 */
export const readRewardsCoordinatorGetRootIndexFromHash =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'getRootIndexFromHash',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"isAVSRewardsSubmissionHash"`
 */
export const readRewardsCoordinatorIsAvsRewardsSubmissionHash =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'isAVSRewardsSubmissionHash',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"isOperatorDirectedAVSRewardsSubmissionHash"`
 */
export const readRewardsCoordinatorIsOperatorDirectedAvsRewardsSubmissionHash =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'isOperatorDirectedAVSRewardsSubmissionHash',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"isOperatorDirectedOperatorSetRewardsSubmissionHash"`
 */
export const readRewardsCoordinatorIsOperatorDirectedOperatorSetRewardsSubmissionHash =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'isOperatorDirectedOperatorSetRewardsSubmissionHash',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"isRewardsForAllSubmitter"`
 */
export const readRewardsCoordinatorIsRewardsForAllSubmitter =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'isRewardsForAllSubmitter',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"isRewardsSubmissionForAllEarnersHash"`
 */
export const readRewardsCoordinatorIsRewardsSubmissionForAllEarnersHash =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'isRewardsSubmissionForAllEarnersHash',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"isRewardsSubmissionForAllHash"`
 */
export const readRewardsCoordinatorIsRewardsSubmissionForAllHash =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'isRewardsSubmissionForAllHash',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"owner"`
 */
export const readRewardsCoordinatorOwner = /*#__PURE__*/ createReadContract({
  abi: rewardsCoordinatorAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"paused"`
 */
export const readRewardsCoordinatorPaused = /*#__PURE__*/ createReadContract({
  abi: rewardsCoordinatorAbi,
  functionName: 'paused',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"pauserRegistry"`
 */
export const readRewardsCoordinatorPauserRegistry =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'pauserRegistry',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"permissionController"`
 */
export const readRewardsCoordinatorPermissionController =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'permissionController',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"rewardsUpdater"`
 */
export const readRewardsCoordinatorRewardsUpdater =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'rewardsUpdater',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"strategyManager"`
 */
export const readRewardsCoordinatorStrategyManager =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'strategyManager',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"submissionNonce"`
 */
export const readRewardsCoordinatorSubmissionNonce =
  /*#__PURE__*/ createReadContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'submissionNonce',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"version"`
 */
export const readRewardsCoordinatorVersion = /*#__PURE__*/ createReadContract({
  abi: rewardsCoordinatorAbi,
  functionName: 'version',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__
 */
export const writeRewardsCoordinator = /*#__PURE__*/ createWriteContract({
  abi: rewardsCoordinatorAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"createAVSRewardsSubmission"`
 */
export const writeRewardsCoordinatorCreateAvsRewardsSubmission =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'createAVSRewardsSubmission',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"createOperatorDirectedAVSRewardsSubmission"`
 */
export const writeRewardsCoordinatorCreateOperatorDirectedAvsRewardsSubmission =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'createOperatorDirectedAVSRewardsSubmission',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"createOperatorDirectedOperatorSetRewardsSubmission"`
 */
export const writeRewardsCoordinatorCreateOperatorDirectedOperatorSetRewardsSubmission =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'createOperatorDirectedOperatorSetRewardsSubmission',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"createRewardsForAllEarners"`
 */
export const writeRewardsCoordinatorCreateRewardsForAllEarners =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'createRewardsForAllEarners',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"createRewardsForAllSubmission"`
 */
export const writeRewardsCoordinatorCreateRewardsForAllSubmission =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'createRewardsForAllSubmission',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"disableRoot"`
 */
export const writeRewardsCoordinatorDisableRoot =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'disableRoot',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"initialize"`
 */
export const writeRewardsCoordinatorInitialize =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"pause"`
 */
export const writeRewardsCoordinatorPause = /*#__PURE__*/ createWriteContract({
  abi: rewardsCoordinatorAbi,
  functionName: 'pause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"pauseAll"`
 */
export const writeRewardsCoordinatorPauseAll =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'pauseAll',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"processClaim"`
 */
export const writeRewardsCoordinatorProcessClaim =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'processClaim',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"processClaims"`
 */
export const writeRewardsCoordinatorProcessClaims =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'processClaims',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const writeRewardsCoordinatorRenounceOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setActivationDelay"`
 */
export const writeRewardsCoordinatorSetActivationDelay =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setActivationDelay',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setClaimerFor"`
 */
export const writeRewardsCoordinatorSetClaimerFor =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setClaimerFor',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setDefaultOperatorSplit"`
 */
export const writeRewardsCoordinatorSetDefaultOperatorSplit =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setDefaultOperatorSplit',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setOperatorAVSSplit"`
 */
export const writeRewardsCoordinatorSetOperatorAvsSplit =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setOperatorAVSSplit',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setOperatorPISplit"`
 */
export const writeRewardsCoordinatorSetOperatorPiSplit =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setOperatorPISplit',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setOperatorSetSplit"`
 */
export const writeRewardsCoordinatorSetOperatorSetSplit =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setOperatorSetSplit',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setRewardsForAllSubmitter"`
 */
export const writeRewardsCoordinatorSetRewardsForAllSubmitter =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setRewardsForAllSubmitter',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setRewardsUpdater"`
 */
export const writeRewardsCoordinatorSetRewardsUpdater =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setRewardsUpdater',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"submitRoot"`
 */
export const writeRewardsCoordinatorSubmitRoot =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'submitRoot',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const writeRewardsCoordinatorTransferOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"unpause"`
 */
export const writeRewardsCoordinatorUnpause = /*#__PURE__*/ createWriteContract(
  { abi: rewardsCoordinatorAbi, functionName: 'unpause' },
)

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__
 */
export const simulateRewardsCoordinator = /*#__PURE__*/ createSimulateContract({
  abi: rewardsCoordinatorAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"createAVSRewardsSubmission"`
 */
export const simulateRewardsCoordinatorCreateAvsRewardsSubmission =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'createAVSRewardsSubmission',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"createOperatorDirectedAVSRewardsSubmission"`
 */
export const simulateRewardsCoordinatorCreateOperatorDirectedAvsRewardsSubmission =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'createOperatorDirectedAVSRewardsSubmission',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"createOperatorDirectedOperatorSetRewardsSubmission"`
 */
export const simulateRewardsCoordinatorCreateOperatorDirectedOperatorSetRewardsSubmission =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'createOperatorDirectedOperatorSetRewardsSubmission',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"createRewardsForAllEarners"`
 */
export const simulateRewardsCoordinatorCreateRewardsForAllEarners =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'createRewardsForAllEarners',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"createRewardsForAllSubmission"`
 */
export const simulateRewardsCoordinatorCreateRewardsForAllSubmission =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'createRewardsForAllSubmission',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"disableRoot"`
 */
export const simulateRewardsCoordinatorDisableRoot =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'disableRoot',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"initialize"`
 */
export const simulateRewardsCoordinatorInitialize =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"pause"`
 */
export const simulateRewardsCoordinatorPause =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'pause',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"pauseAll"`
 */
export const simulateRewardsCoordinatorPauseAll =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'pauseAll',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"processClaim"`
 */
export const simulateRewardsCoordinatorProcessClaim =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'processClaim',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"processClaims"`
 */
export const simulateRewardsCoordinatorProcessClaims =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'processClaims',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const simulateRewardsCoordinatorRenounceOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setActivationDelay"`
 */
export const simulateRewardsCoordinatorSetActivationDelay =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setActivationDelay',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setClaimerFor"`
 */
export const simulateRewardsCoordinatorSetClaimerFor =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setClaimerFor',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setDefaultOperatorSplit"`
 */
export const simulateRewardsCoordinatorSetDefaultOperatorSplit =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setDefaultOperatorSplit',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setOperatorAVSSplit"`
 */
export const simulateRewardsCoordinatorSetOperatorAvsSplit =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setOperatorAVSSplit',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setOperatorPISplit"`
 */
export const simulateRewardsCoordinatorSetOperatorPiSplit =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setOperatorPISplit',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setOperatorSetSplit"`
 */
export const simulateRewardsCoordinatorSetOperatorSetSplit =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setOperatorSetSplit',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setRewardsForAllSubmitter"`
 */
export const simulateRewardsCoordinatorSetRewardsForAllSubmitter =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setRewardsForAllSubmitter',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"setRewardsUpdater"`
 */
export const simulateRewardsCoordinatorSetRewardsUpdater =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'setRewardsUpdater',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"submitRoot"`
 */
export const simulateRewardsCoordinatorSubmitRoot =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'submitRoot',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const simulateRewardsCoordinatorTransferOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `functionName` set to `"unpause"`
 */
export const simulateRewardsCoordinatorUnpause =
  /*#__PURE__*/ createSimulateContract({
    abi: rewardsCoordinatorAbi,
    functionName: 'unpause',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__
 */
export const watchRewardsCoordinatorEvent =
  /*#__PURE__*/ createWatchContractEvent({ abi: rewardsCoordinatorAbi })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"AVSRewardsSubmissionCreated"`
 */
export const watchRewardsCoordinatorAvsRewardsSubmissionCreatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'AVSRewardsSubmissionCreated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"ActivationDelaySet"`
 */
export const watchRewardsCoordinatorActivationDelaySetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'ActivationDelaySet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"ClaimerForSet"`
 */
export const watchRewardsCoordinatorClaimerForSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'ClaimerForSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"DefaultOperatorSplitBipsSet"`
 */
export const watchRewardsCoordinatorDefaultOperatorSplitBipsSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'DefaultOperatorSplitBipsSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"DistributionRootDisabled"`
 */
export const watchRewardsCoordinatorDistributionRootDisabledEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'DistributionRootDisabled',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"DistributionRootSubmitted"`
 */
export const watchRewardsCoordinatorDistributionRootSubmittedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'DistributionRootSubmitted',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"Initialized"`
 */
export const watchRewardsCoordinatorInitializedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'Initialized',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"OperatorAVSSplitBipsSet"`
 */
export const watchRewardsCoordinatorOperatorAvsSplitBipsSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'OperatorAVSSplitBipsSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"OperatorDirectedAVSRewardsSubmissionCreated"`
 */
export const watchRewardsCoordinatorOperatorDirectedAvsRewardsSubmissionCreatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'OperatorDirectedAVSRewardsSubmissionCreated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"OperatorDirectedOperatorSetRewardsSubmissionCreated"`
 */
export const watchRewardsCoordinatorOperatorDirectedOperatorSetRewardsSubmissionCreatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'OperatorDirectedOperatorSetRewardsSubmissionCreated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"OperatorPISplitBipsSet"`
 */
export const watchRewardsCoordinatorOperatorPiSplitBipsSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'OperatorPISplitBipsSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"OperatorSetSplitBipsSet"`
 */
export const watchRewardsCoordinatorOperatorSetSplitBipsSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'OperatorSetSplitBipsSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const watchRewardsCoordinatorOwnershipTransferredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"Paused"`
 */
export const watchRewardsCoordinatorPausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'Paused',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"RewardsClaimed"`
 */
export const watchRewardsCoordinatorRewardsClaimedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'RewardsClaimed',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"RewardsForAllSubmitterSet"`
 */
export const watchRewardsCoordinatorRewardsForAllSubmitterSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'RewardsForAllSubmitterSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"RewardsSubmissionForAllCreated"`
 */
export const watchRewardsCoordinatorRewardsSubmissionForAllCreatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'RewardsSubmissionForAllCreated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"RewardsSubmissionForAllEarnersCreated"`
 */
export const watchRewardsCoordinatorRewardsSubmissionForAllEarnersCreatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'RewardsSubmissionForAllEarnersCreated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"RewardsUpdaterSet"`
 */
export const watchRewardsCoordinatorRewardsUpdaterSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'RewardsUpdaterSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rewardsCoordinatorAbi}__ and `eventName` set to `"Unpaused"`
 */
export const watchRewardsCoordinatorUnpausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rewardsCoordinatorAbi,
    eventName: 'Unpaused',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__
 */
export const readStrategyBaseTvlLimits = /*#__PURE__*/ createReadContract({
  abi: strategyBaseTvlLimitsAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"explanation"`
 */
export const readStrategyBaseTvlLimitsExplanation =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'explanation',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"getTVLLimits"`
 */
export const readStrategyBaseTvlLimitsGetTvlLimits =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'getTVLLimits',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"maxPerDeposit"`
 */
export const readStrategyBaseTvlLimitsMaxPerDeposit =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'maxPerDeposit',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"maxTotalDeposits"`
 */
export const readStrategyBaseTvlLimitsMaxTotalDeposits =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'maxTotalDeposits',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"paused"`
 */
export const readStrategyBaseTvlLimitsPaused = /*#__PURE__*/ createReadContract(
  { abi: strategyBaseTvlLimitsAbi, functionName: 'paused' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"pauserRegistry"`
 */
export const readStrategyBaseTvlLimitsPauserRegistry =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'pauserRegistry',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"shares"`
 */
export const readStrategyBaseTvlLimitsShares = /*#__PURE__*/ createReadContract(
  { abi: strategyBaseTvlLimitsAbi, functionName: 'shares' },
)

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"sharesToUnderlying"`
 */
export const readStrategyBaseTvlLimitsSharesToUnderlying =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'sharesToUnderlying',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"sharesToUnderlyingView"`
 */
export const readStrategyBaseTvlLimitsSharesToUnderlyingView =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'sharesToUnderlyingView',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"strategyManager"`
 */
export const readStrategyBaseTvlLimitsStrategyManager =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'strategyManager',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"totalShares"`
 */
export const readStrategyBaseTvlLimitsTotalShares =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'totalShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"underlyingToShares"`
 */
export const readStrategyBaseTvlLimitsUnderlyingToShares =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'underlyingToShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"underlyingToSharesView"`
 */
export const readStrategyBaseTvlLimitsUnderlyingToSharesView =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'underlyingToSharesView',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"underlyingToken"`
 */
export const readStrategyBaseTvlLimitsUnderlyingToken =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'underlyingToken',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"userUnderlyingView"`
 */
export const readStrategyBaseTvlLimitsUserUnderlyingView =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'userUnderlyingView',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"version"`
 */
export const readStrategyBaseTvlLimitsVersion =
  /*#__PURE__*/ createReadContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'version',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__
 */
export const writeStrategyBaseTvlLimits = /*#__PURE__*/ createWriteContract({
  abi: strategyBaseTvlLimitsAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"deposit"`
 */
export const writeStrategyBaseTvlLimitsDeposit =
  /*#__PURE__*/ createWriteContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'deposit',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"initialize"`
 */
export const writeStrategyBaseTvlLimitsInitialize =
  /*#__PURE__*/ createWriteContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"pause"`
 */
export const writeStrategyBaseTvlLimitsPause =
  /*#__PURE__*/ createWriteContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'pause',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"pauseAll"`
 */
export const writeStrategyBaseTvlLimitsPauseAll =
  /*#__PURE__*/ createWriteContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'pauseAll',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"setTVLLimits"`
 */
export const writeStrategyBaseTvlLimitsSetTvlLimits =
  /*#__PURE__*/ createWriteContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'setTVLLimits',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"unpause"`
 */
export const writeStrategyBaseTvlLimitsUnpause =
  /*#__PURE__*/ createWriteContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'unpause',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"userUnderlying"`
 */
export const writeStrategyBaseTvlLimitsUserUnderlying =
  /*#__PURE__*/ createWriteContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'userUnderlying',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"withdraw"`
 */
export const writeStrategyBaseTvlLimitsWithdraw =
  /*#__PURE__*/ createWriteContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'withdraw',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__
 */
export const simulateStrategyBaseTvlLimits =
  /*#__PURE__*/ createSimulateContract({ abi: strategyBaseTvlLimitsAbi })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"deposit"`
 */
export const simulateStrategyBaseTvlLimitsDeposit =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'deposit',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"initialize"`
 */
export const simulateStrategyBaseTvlLimitsInitialize =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"pause"`
 */
export const simulateStrategyBaseTvlLimitsPause =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'pause',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"pauseAll"`
 */
export const simulateStrategyBaseTvlLimitsPauseAll =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'pauseAll',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"setTVLLimits"`
 */
export const simulateStrategyBaseTvlLimitsSetTvlLimits =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'setTVLLimits',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"unpause"`
 */
export const simulateStrategyBaseTvlLimitsUnpause =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'unpause',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"userUnderlying"`
 */
export const simulateStrategyBaseTvlLimitsUserUnderlying =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'userUnderlying',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `functionName` set to `"withdraw"`
 */
export const simulateStrategyBaseTvlLimitsWithdraw =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyBaseTvlLimitsAbi,
    functionName: 'withdraw',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__
 */
export const watchStrategyBaseTvlLimitsEvent =
  /*#__PURE__*/ createWatchContractEvent({ abi: strategyBaseTvlLimitsAbi })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `eventName` set to `"ExchangeRateEmitted"`
 */
export const watchStrategyBaseTvlLimitsExchangeRateEmittedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyBaseTvlLimitsAbi,
    eventName: 'ExchangeRateEmitted',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `eventName` set to `"Initialized"`
 */
export const watchStrategyBaseTvlLimitsInitializedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyBaseTvlLimitsAbi,
    eventName: 'Initialized',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `eventName` set to `"MaxPerDepositUpdated"`
 */
export const watchStrategyBaseTvlLimitsMaxPerDepositUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyBaseTvlLimitsAbi,
    eventName: 'MaxPerDepositUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `eventName` set to `"MaxTotalDepositsUpdated"`
 */
export const watchStrategyBaseTvlLimitsMaxTotalDepositsUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyBaseTvlLimitsAbi,
    eventName: 'MaxTotalDepositsUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `eventName` set to `"Paused"`
 */
export const watchStrategyBaseTvlLimitsPausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyBaseTvlLimitsAbi,
    eventName: 'Paused',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `eventName` set to `"StrategyTokenSet"`
 */
export const watchStrategyBaseTvlLimitsStrategyTokenSetEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyBaseTvlLimitsAbi,
    eventName: 'StrategyTokenSet',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyBaseTvlLimitsAbi}__ and `eventName` set to `"Unpaused"`
 */
export const watchStrategyBaseTvlLimitsUnpausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyBaseTvlLimitsAbi,
    eventName: 'Unpaused',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__
 */
export const readStrategyManager = /*#__PURE__*/ createReadContract({
  abi: strategyManagerAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"DEFAULT_BURN_ADDRESS"`
 */
export const readStrategyManagerDefaultBurnAddress =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'DEFAULT_BURN_ADDRESS',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"DEPOSIT_TYPEHASH"`
 */
export const readStrategyManagerDepositTypehash =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'DEPOSIT_TYPEHASH',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"allocationManager"`
 */
export const readStrategyManagerAllocationManager =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'allocationManager',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"calculateStrategyDepositDigestHash"`
 */
export const readStrategyManagerCalculateStrategyDepositDigestHash =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'calculateStrategyDepositDigestHash',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"delegation"`
 */
export const readStrategyManagerDelegation = /*#__PURE__*/ createReadContract({
  abi: strategyManagerAbi,
  functionName: 'delegation',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"domainSeparator"`
 */
export const readStrategyManagerDomainSeparator =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'domainSeparator',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"getBurnOrRedistributableCount"`
 */
export const readStrategyManagerGetBurnOrRedistributableCount =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'getBurnOrRedistributableCount',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"getBurnOrRedistributableShares"`
 */
export const readStrategyManagerGetBurnOrRedistributableShares =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'getBurnOrRedistributableShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"getBurnableShares"`
 */
export const readStrategyManagerGetBurnableShares =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'getBurnableShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"getDeposits"`
 */
export const readStrategyManagerGetDeposits = /*#__PURE__*/ createReadContract({
  abi: strategyManagerAbi,
  functionName: 'getDeposits',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"getPendingOperatorSets"`
 */
export const readStrategyManagerGetPendingOperatorSets =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'getPendingOperatorSets',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"getPendingSlashIds"`
 */
export const readStrategyManagerGetPendingSlashIds =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'getPendingSlashIds',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"getStakerStrategyList"`
 */
export const readStrategyManagerGetStakerStrategyList =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'getStakerStrategyList',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"getStrategiesWithBurnableShares"`
 */
export const readStrategyManagerGetStrategiesWithBurnableShares =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'getStrategiesWithBurnableShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"nonces"`
 */
export const readStrategyManagerNonces = /*#__PURE__*/ createReadContract({
  abi: strategyManagerAbi,
  functionName: 'nonces',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"owner"`
 */
export const readStrategyManagerOwner = /*#__PURE__*/ createReadContract({
  abi: strategyManagerAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"paused"`
 */
export const readStrategyManagerPaused = /*#__PURE__*/ createReadContract({
  abi: strategyManagerAbi,
  functionName: 'paused',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"pauserRegistry"`
 */
export const readStrategyManagerPauserRegistry =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'pauserRegistry',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"stakerDepositShares"`
 */
export const readStrategyManagerStakerDepositShares =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'stakerDepositShares',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"stakerStrategyList"`
 */
export const readStrategyManagerStakerStrategyList =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'stakerStrategyList',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"stakerStrategyListLength"`
 */
export const readStrategyManagerStakerStrategyListLength =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'stakerStrategyListLength',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"strategyIsWhitelistedForDeposit"`
 */
export const readStrategyManagerStrategyIsWhitelistedForDeposit =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'strategyIsWhitelistedForDeposit',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"strategyWhitelister"`
 */
export const readStrategyManagerStrategyWhitelister =
  /*#__PURE__*/ createReadContract({
    abi: strategyManagerAbi,
    functionName: 'strategyWhitelister',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"version"`
 */
export const readStrategyManagerVersion = /*#__PURE__*/ createReadContract({
  abi: strategyManagerAbi,
  functionName: 'version',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__
 */
export const writeStrategyManager = /*#__PURE__*/ createWriteContract({
  abi: strategyManagerAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"addShares"`
 */
export const writeStrategyManagerAddShares = /*#__PURE__*/ createWriteContract({
  abi: strategyManagerAbi,
  functionName: 'addShares',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"addStrategiesToDepositWhitelist"`
 */
export const writeStrategyManagerAddStrategiesToDepositWhitelist =
  /*#__PURE__*/ createWriteContract({
    abi: strategyManagerAbi,
    functionName: 'addStrategiesToDepositWhitelist',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"burnShares"`
 */
export const writeStrategyManagerBurnShares = /*#__PURE__*/ createWriteContract(
  { abi: strategyManagerAbi, functionName: 'burnShares' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"clearBurnOrRedistributableShares"`
 */
export const writeStrategyManagerClearBurnOrRedistributableShares =
  /*#__PURE__*/ createWriteContract({
    abi: strategyManagerAbi,
    functionName: 'clearBurnOrRedistributableShares',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"clearBurnOrRedistributableSharesByStrategy"`
 */
export const writeStrategyManagerClearBurnOrRedistributableSharesByStrategy =
  /*#__PURE__*/ createWriteContract({
    abi: strategyManagerAbi,
    functionName: 'clearBurnOrRedistributableSharesByStrategy',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"depositIntoStrategy"`
 */
export const writeStrategyManagerDepositIntoStrategy =
  /*#__PURE__*/ createWriteContract({
    abi: strategyManagerAbi,
    functionName: 'depositIntoStrategy',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"depositIntoStrategyWithSignature"`
 */
export const writeStrategyManagerDepositIntoStrategyWithSignature =
  /*#__PURE__*/ createWriteContract({
    abi: strategyManagerAbi,
    functionName: 'depositIntoStrategyWithSignature',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"increaseBurnOrRedistributableShares"`
 */
export const writeStrategyManagerIncreaseBurnOrRedistributableShares =
  /*#__PURE__*/ createWriteContract({
    abi: strategyManagerAbi,
    functionName: 'increaseBurnOrRedistributableShares',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"initialize"`
 */
export const writeStrategyManagerInitialize = /*#__PURE__*/ createWriteContract(
  { abi: strategyManagerAbi, functionName: 'initialize' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"pause"`
 */
export const writeStrategyManagerPause = /*#__PURE__*/ createWriteContract({
  abi: strategyManagerAbi,
  functionName: 'pause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"pauseAll"`
 */
export const writeStrategyManagerPauseAll = /*#__PURE__*/ createWriteContract({
  abi: strategyManagerAbi,
  functionName: 'pauseAll',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"removeDepositShares"`
 */
export const writeStrategyManagerRemoveDepositShares =
  /*#__PURE__*/ createWriteContract({
    abi: strategyManagerAbi,
    functionName: 'removeDepositShares',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"removeStrategiesFromDepositWhitelist"`
 */
export const writeStrategyManagerRemoveStrategiesFromDepositWhitelist =
  /*#__PURE__*/ createWriteContract({
    abi: strategyManagerAbi,
    functionName: 'removeStrategiesFromDepositWhitelist',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const writeStrategyManagerRenounceOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: strategyManagerAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"setStrategyWhitelister"`
 */
export const writeStrategyManagerSetStrategyWhitelister =
  /*#__PURE__*/ createWriteContract({
    abi: strategyManagerAbi,
    functionName: 'setStrategyWhitelister',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const writeStrategyManagerTransferOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: strategyManagerAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"unpause"`
 */
export const writeStrategyManagerUnpause = /*#__PURE__*/ createWriteContract({
  abi: strategyManagerAbi,
  functionName: 'unpause',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"withdrawSharesAsTokens"`
 */
export const writeStrategyManagerWithdrawSharesAsTokens =
  /*#__PURE__*/ createWriteContract({
    abi: strategyManagerAbi,
    functionName: 'withdrawSharesAsTokens',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__
 */
export const simulateStrategyManager = /*#__PURE__*/ createSimulateContract({
  abi: strategyManagerAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"addShares"`
 */
export const simulateStrategyManagerAddShares =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'addShares',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"addStrategiesToDepositWhitelist"`
 */
export const simulateStrategyManagerAddStrategiesToDepositWhitelist =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'addStrategiesToDepositWhitelist',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"burnShares"`
 */
export const simulateStrategyManagerBurnShares =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'burnShares',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"clearBurnOrRedistributableShares"`
 */
export const simulateStrategyManagerClearBurnOrRedistributableShares =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'clearBurnOrRedistributableShares',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"clearBurnOrRedistributableSharesByStrategy"`
 */
export const simulateStrategyManagerClearBurnOrRedistributableSharesByStrategy =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'clearBurnOrRedistributableSharesByStrategy',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"depositIntoStrategy"`
 */
export const simulateStrategyManagerDepositIntoStrategy =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'depositIntoStrategy',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"depositIntoStrategyWithSignature"`
 */
export const simulateStrategyManagerDepositIntoStrategyWithSignature =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'depositIntoStrategyWithSignature',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"increaseBurnOrRedistributableShares"`
 */
export const simulateStrategyManagerIncreaseBurnOrRedistributableShares =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'increaseBurnOrRedistributableShares',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"initialize"`
 */
export const simulateStrategyManagerInitialize =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"pause"`
 */
export const simulateStrategyManagerPause =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'pause',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"pauseAll"`
 */
export const simulateStrategyManagerPauseAll =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'pauseAll',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"removeDepositShares"`
 */
export const simulateStrategyManagerRemoveDepositShares =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'removeDepositShares',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"removeStrategiesFromDepositWhitelist"`
 */
export const simulateStrategyManagerRemoveStrategiesFromDepositWhitelist =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'removeStrategiesFromDepositWhitelist',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const simulateStrategyManagerRenounceOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"setStrategyWhitelister"`
 */
export const simulateStrategyManagerSetStrategyWhitelister =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'setStrategyWhitelister',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const simulateStrategyManagerTransferOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"unpause"`
 */
export const simulateStrategyManagerUnpause =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'unpause',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link strategyManagerAbi}__ and `functionName` set to `"withdrawSharesAsTokens"`
 */
export const simulateStrategyManagerWithdrawSharesAsTokens =
  /*#__PURE__*/ createSimulateContract({
    abi: strategyManagerAbi,
    functionName: 'withdrawSharesAsTokens',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyManagerAbi}__
 */
export const watchStrategyManagerEvent = /*#__PURE__*/ createWatchContractEvent(
  { abi: strategyManagerAbi },
)

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyManagerAbi}__ and `eventName` set to `"BurnOrRedistributableSharesDecreased"`
 */
export const watchStrategyManagerBurnOrRedistributableSharesDecreasedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyManagerAbi,
    eventName: 'BurnOrRedistributableSharesDecreased',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyManagerAbi}__ and `eventName` set to `"BurnOrRedistributableSharesIncreased"`
 */
export const watchStrategyManagerBurnOrRedistributableSharesIncreasedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyManagerAbi,
    eventName: 'BurnOrRedistributableSharesIncreased',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyManagerAbi}__ and `eventName` set to `"BurnableSharesDecreased"`
 */
export const watchStrategyManagerBurnableSharesDecreasedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyManagerAbi,
    eventName: 'BurnableSharesDecreased',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyManagerAbi}__ and `eventName` set to `"Deposit"`
 */
export const watchStrategyManagerDepositEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyManagerAbi,
    eventName: 'Deposit',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyManagerAbi}__ and `eventName` set to `"Initialized"`
 */
export const watchStrategyManagerInitializedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyManagerAbi,
    eventName: 'Initialized',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyManagerAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const watchStrategyManagerOwnershipTransferredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyManagerAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyManagerAbi}__ and `eventName` set to `"Paused"`
 */
export const watchStrategyManagerPausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyManagerAbi,
    eventName: 'Paused',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyManagerAbi}__ and `eventName` set to `"StrategyAddedToDepositWhitelist"`
 */
export const watchStrategyManagerStrategyAddedToDepositWhitelistEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyManagerAbi,
    eventName: 'StrategyAddedToDepositWhitelist',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyManagerAbi}__ and `eventName` set to `"StrategyRemovedFromDepositWhitelist"`
 */
export const watchStrategyManagerStrategyRemovedFromDepositWhitelistEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyManagerAbi,
    eventName: 'StrategyRemovedFromDepositWhitelist',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyManagerAbi}__ and `eventName` set to `"StrategyWhitelisterChanged"`
 */
export const watchStrategyManagerStrategyWhitelisterChangedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyManagerAbi,
    eventName: 'StrategyWhitelisterChanged',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link strategyManagerAbi}__ and `eventName` set to `"Unpaused"`
 */
export const watchStrategyManagerUnpausedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: strategyManagerAbi,
    eventName: 'Unpaused',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link transparentUpgradeableProxyAbi}__
 */
export const watchTransparentUpgradeableProxyEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: transparentUpgradeableProxyAbi,
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link transparentUpgradeableProxyAbi}__ and `eventName` set to `"AdminChanged"`
 */
export const watchTransparentUpgradeableProxyAdminChangedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: transparentUpgradeableProxyAbi,
    eventName: 'AdminChanged',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link transparentUpgradeableProxyAbi}__ and `eventName` set to `"BeaconUpgraded"`
 */
export const watchTransparentUpgradeableProxyBeaconUpgradedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: transparentUpgradeableProxyAbi,
    eventName: 'BeaconUpgraded',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link transparentUpgradeableProxyAbi}__ and `eventName` set to `"Upgraded"`
 */
export const watchTransparentUpgradeableProxyUpgradedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: transparentUpgradeableProxyAbi,
    eventName: 'Upgraded',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link upgradeableBeaconAbi}__
 */
export const readUpgradeableBeacon = /*#__PURE__*/ createReadContract({
  abi: upgradeableBeaconAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link upgradeableBeaconAbi}__ and `functionName` set to `"implementation"`
 */
export const readUpgradeableBeaconImplementation =
  /*#__PURE__*/ createReadContract({
    abi: upgradeableBeaconAbi,
    functionName: 'implementation',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link upgradeableBeaconAbi}__ and `functionName` set to `"owner"`
 */
export const readUpgradeableBeaconOwner = /*#__PURE__*/ createReadContract({
  abi: upgradeableBeaconAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link upgradeableBeaconAbi}__
 */
export const writeUpgradeableBeacon = /*#__PURE__*/ createWriteContract({
  abi: upgradeableBeaconAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link upgradeableBeaconAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const writeUpgradeableBeaconRenounceOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: upgradeableBeaconAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link upgradeableBeaconAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const writeUpgradeableBeaconTransferOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: upgradeableBeaconAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link upgradeableBeaconAbi}__ and `functionName` set to `"upgradeTo"`
 */
export const writeUpgradeableBeaconUpgradeTo =
  /*#__PURE__*/ createWriteContract({
    abi: upgradeableBeaconAbi,
    functionName: 'upgradeTo',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link upgradeableBeaconAbi}__
 */
export const simulateUpgradeableBeacon = /*#__PURE__*/ createSimulateContract({
  abi: upgradeableBeaconAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link upgradeableBeaconAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const simulateUpgradeableBeaconRenounceOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: upgradeableBeaconAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link upgradeableBeaconAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const simulateUpgradeableBeaconTransferOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: upgradeableBeaconAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link upgradeableBeaconAbi}__ and `functionName` set to `"upgradeTo"`
 */
export const simulateUpgradeableBeaconUpgradeTo =
  /*#__PURE__*/ createSimulateContract({
    abi: upgradeableBeaconAbi,
    functionName: 'upgradeTo',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link upgradeableBeaconAbi}__
 */
export const watchUpgradeableBeaconEvent =
  /*#__PURE__*/ createWatchContractEvent({ abi: upgradeableBeaconAbi })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link upgradeableBeaconAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const watchUpgradeableBeaconOwnershipTransferredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: upgradeableBeaconAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link upgradeableBeaconAbi}__ and `eventName` set to `"Upgraded"`
 */
export const watchUpgradeableBeaconUpgradedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: upgradeableBeaconAbi,
    eventName: 'Upgraded',
  })

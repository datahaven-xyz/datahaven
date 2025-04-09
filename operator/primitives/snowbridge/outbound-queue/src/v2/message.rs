// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! # Outbound V2 primitives

use codec::{Decode, DecodeWithMemTracking, Encode};
use frame_support::{pallet_prelude::ConstU32, BoundedVec};
use scale_info::TypeInfo;
use sp_core::{RuntimeDebug, H160, H256};
use sp_std::vec::Vec;

use crate::{OperatingMode, SendError};
use abi::{
    CallContractParams, MintForeignTokenParams, RegisterForeignTokenParams, SetOperatingModeParams,
    UnlockNativeTokenParams, UpgradeParams,
};
use alloy_core::{
    primitives::{Address, Bytes, FixedBytes, U256},
    sol_types::SolValue,
};

pub mod abi {
    use alloy_core::sol;

    sol! {
        struct OutboundMessageWrapper {
            // origin
            bytes32 origin;
            // Message nonce
            uint64 nonce;
            // Topic
            bytes32 topic;
            // Commands
            CommandWrapper[] commands;
        }

        struct CommandWrapper {
            uint8 kind;
            uint64 gas;
            bytes payload;
        }

        // Payload for Upgrade
        struct UpgradeParams {
            // The address of the implementation contract
            address implAddress;
            // Codehash of the new implementation contract.
            bytes32 implCodeHash;
            // Parameters used to upgrade storage of the gateway
            bytes initParams;
        }

        // Payload for SetOperatingMode instruction
        struct SetOperatingModeParams {
            /// The new operating mode
            uint8 mode;
        }

        // Payload for NativeTokenUnlock instruction
        struct UnlockNativeTokenParams {
            // Token address
            address token;
            // Recipient address
            address recipient;
            // Amount to unlock
            uint128 amount;
        }

        // Payload for RegisterForeignToken
        struct RegisterForeignTokenParams {
            /// @dev The token ID (hash of stable location id of token)
            bytes32 foreignTokenID;
            /// @dev The name of the token
            bytes name;
            /// @dev The symbol of the token
            bytes symbol;
            /// @dev The decimal of the token
            uint8 decimals;
        }

        // Payload for MintForeignTokenParams instruction
        struct MintForeignTokenParams {
            // Foreign token ID
            bytes32 foreignTokenID;
            // Recipient address
            address recipient;
            // Amount to mint
            uint128 amount;
        }

        // Payload for CallContract
        struct CallContractParams {
            // target contract
            address target;
            // Call data
            bytes data;
            // Ether value
            uint256 value;
        }
    }
}

#[derive(Encode, Decode, TypeInfo, PartialEq, Clone, RuntimeDebug)]
pub struct OutboundCommandWrapper {
    pub kind: u8,
    pub gas: u64,
    pub payload: Vec<u8>,
}

#[derive(Encode, Decode, TypeInfo, PartialEq, Clone, RuntimeDebug)]
pub struct OutboundMessage {
    /// Origin
    pub origin: H256,
    /// Nonce
    pub nonce: u64,
    /// Topic
    pub topic: H256,
    /// Commands
    pub commands: BoundedVec<OutboundCommandWrapper, ConstU32<MAX_COMMANDS>>,
}

pub const MAX_COMMANDS: u32 = 8;

/// A message which can be accepted by implementations of `/[`SendMessage`\]`
#[derive(Encode, Decode, DecodeWithMemTracking, TypeInfo, PartialEq, Clone, RuntimeDebug)]
pub struct Message {
    /// Origin
    pub origin: H256,
    /// ID
    pub id: H256,
    /// Fee
    pub fee: u128,
    /// Commands
    pub commands: BoundedVec<Command, ConstU32<MAX_COMMANDS>>,
}

/// A command which is executable by the Gateway contract on Ethereum
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, PartialEq, RuntimeDebug, TypeInfo)]
pub enum Command {
    /// Upgrade the Gateway contract
    Upgrade {
        /// Address of the new implementation contract
        impl_address: H160,
        /// Codehash of the implementation contract
        impl_code_hash: H256,
        /// Invoke an initializer in the implementation contract
        initializer: Initializer,
    },
    /// Set the global operating mode of the Gateway contract
    SetOperatingMode {
        /// The new operating mode
        mode: OperatingMode,
    },
    /// Unlock ERC20 tokens
    UnlockNativeToken {
        /// Address of the ERC20 token
        token: H160,
        /// The recipient of the tokens
        recipient: H160,
        /// The amount of tokens to transfer
        amount: u128,
    },
    /// Register foreign token from Polkadot
    RegisterForeignToken {
        /// ID for the token
        token_id: H256,
        /// Name of the token
        name: Vec<u8>,
        /// Short symbol for the token
        symbol: Vec<u8>,
        /// Number of decimal places
        decimals: u8,
    },
    /// Mint foreign token from Polkadot
    MintForeignToken {
        /// ID for the token
        token_id: H256,
        /// The recipient of the newly minted tokens
        recipient: H160,
        /// The amount of tokens to mint
        amount: u128,
    },
    /// Call Contract on Ethereum
    CallContract {
        /// Target contract address
        target: H160,
        /// ABI-encoded calldata
        calldata: Vec<u8>,
        /// Maximum gas to forward to target contract
        gas: u64,
        /// Include ether held by agent contract
        value: u128,
    },
}

impl Command {
    /// Compute the enum variant index
    pub fn index(&self) -> u8 {
        match self {
            Command::Upgrade { .. } => 0,
            Command::SetOperatingMode { .. } => 1,
            Command::UnlockNativeToken { .. } => 2,
            Command::RegisterForeignToken { .. } => 3,
            Command::MintForeignToken { .. } => 4,
            Command::CallContract { .. } => 5,
        }
    }

    /// ABI-encode the Command.
    pub fn abi_encode(&self) -> Vec<u8> {
        match self {
            Command::Upgrade {
                impl_address,
                impl_code_hash,
                initializer,
                ..
            } => UpgradeParams {
                implAddress: Address::from(impl_address.as_fixed_bytes()),
                implCodeHash: FixedBytes::from(impl_code_hash.as_fixed_bytes()),
                initParams: Bytes::from(initializer.params.clone()),
            }
            .abi_encode(),
            Command::SetOperatingMode { mode } => SetOperatingModeParams {
                mode: (*mode) as u8,
            }
            .abi_encode(),
            Command::UnlockNativeToken {
                token,
                recipient,
                amount,
                ..
            } => UnlockNativeTokenParams {
                token: Address::from(token.as_fixed_bytes()),
                recipient: Address::from(recipient.as_fixed_bytes()),
                amount: *amount,
            }
            .abi_encode(),
            Command::RegisterForeignToken {
                token_id,
                name,
                symbol,
                decimals,
            } => RegisterForeignTokenParams {
                foreignTokenID: FixedBytes::from(token_id.as_fixed_bytes()),
                name: Bytes::from(name.to_vec()),
                symbol: Bytes::from(symbol.to_vec()),
                decimals: *decimals,
            }
            .abi_encode(),
            Command::MintForeignToken {
                token_id,
                recipient,
                amount,
            } => MintForeignTokenParams {
                foreignTokenID: FixedBytes::from(token_id.as_fixed_bytes()),
                recipient: Address::from(recipient.as_fixed_bytes()),
                amount: *amount,
            }
            .abi_encode(),
            Command::CallContract {
                target,
                calldata: data,
                value,
                ..
            } => CallContractParams {
                target: Address::from(target.as_fixed_bytes()),
                data: Bytes::from(data.to_vec()),
                value: U256::try_from(*value).unwrap(),
            }
            .abi_encode(),
        }
    }
}

/// Representation of a call to the initializer of an implementation contract.
/// The initializer has the following ABI signature: `initialize(bytes)`.
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, PartialEq, RuntimeDebug, TypeInfo)]
pub struct Initializer {
    /// ABI-encoded params of type `bytes` to pass to the initializer
    pub params: Vec<u8>,
    /// The initializer is allowed to consume this much gas at most.
    pub maximum_required_gas: u64,
}

pub trait SendMessage {
    type Ticket: Clone + Encode + Decode;

    /// Validate an outbound message and return a tuple:
    /// 1. Ticket for submitting the message
    /// 2. Delivery fee
    fn validate(message: &Message) -> Result<Self::Ticket, SendError>;

    /// Submit the message ticket for eventual delivery to Ethereum
    fn deliver(ticket: Self::Ticket) -> Result<H256, SendError>;
}

pub trait GasMeter {
    /// Measures the maximum amount of gas a command payload will require to *dispatch*, NOT
    /// including validation & verification.
    fn maximum_dispatch_gas_used_at_most(command: &Command) -> u64;
}

/// A meter that assigns a constant amount of gas for the execution of a command
///
/// The gas figures are extracted from this report:
/// > forge test --match-path test/Gateway.t.sol --gas-report
///
/// A healthy buffer is added on top of these figures to account for:
/// * The EIP-150 63/64 rule
/// * Future EVM upgrades that may increase gas cost
pub struct ConstantGasMeter;

impl GasMeter for ConstantGasMeter {
    fn maximum_dispatch_gas_used_at_most(command: &Command) -> u64 {
        match command {
            Command::SetOperatingMode { .. } => 40_000,
            Command::Upgrade { initializer, .. } => {
                // total maximum gas must also include the gas used for updating the proxy before
                // the the initializer is called.
                50_000 + initializer.maximum_required_gas
            }
            Command::UnlockNativeToken { .. } => 100_000,
            Command::RegisterForeignToken { .. } => 1_200_000,
            Command::MintForeignToken { .. } => 100_000,
            Command::CallContract { gas: gas_limit, .. } => *gas_limit,
        }
    }
}

impl GasMeter for () {
    fn maximum_dispatch_gas_used_at_most(_: &Command) -> u64 {
        1
    }
}

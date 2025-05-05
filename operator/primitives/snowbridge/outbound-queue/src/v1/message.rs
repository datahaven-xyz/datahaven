// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! # Outbound V1 primitives

use crate::{OperatingMode, SendError, SendMessageFeeProvider};
use codec::{Decode, DecodeWithMemTracking, Encode};
use ethabi::Token;
use scale_info::TypeInfo;
use snowbridge_core::{pricing::UD60x18, ChannelId};
use sp_arithmetic::traits::{BaseArithmetic, Unsigned};
use sp_core::{RuntimeDebug, H160, H256, U256};
use sp_std::{borrow::ToOwned, vec, vec::Vec};

/// Enqueued outbound messages need to be versioned to prevent data corruption
/// or loss after forkless runtime upgrades
#[derive(Encode, Decode, TypeInfo, Clone, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(PartialEq))]
pub enum VersionedQueuedMessage {
    V1(QueuedMessage),
}

impl TryFrom<VersionedQueuedMessage> for QueuedMessage {
    type Error = ();
    fn try_from(x: VersionedQueuedMessage) -> Result<Self, Self::Error> {
        use VersionedQueuedMessage::*;
        match x {
            V1(x) => Ok(x),
        }
    }
}

impl<T: Into<QueuedMessage>> From<T> for VersionedQueuedMessage {
    fn from(x: T) -> Self {
        VersionedQueuedMessage::V1(x.into())
    }
}

/// A message which can be accepted by implementations of `/[`SendMessage`\]`
#[derive(Encode, Decode, TypeInfo, Clone, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(PartialEq))]
pub struct Message {
    /// ID for this message. One will be automatically generated if not provided.
    ///
    /// When this message is created from an XCM message, the ID should be extracted
    /// from the `SetTopic` instruction.
    ///
    /// The ID plays no role in bridge consensus, and is purely meant for message tracing.
    pub id: Option<H256>,
    /// The message channel ID
    pub channel_id: ChannelId,
    /// The stable ID for a receiving gateway contract
    pub command: Command,
}

/// A command which is executable by the Gateway contract on Ethereum
#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo)]
#[cfg_attr(feature = "std", derive(PartialEq))]
pub enum Command {
    /// Execute a sub-command within an agent for a consensus system in Polkadot
    /// DEPRECATED in favour of `UnlockNativeToken`. We still have to keep it around in
    /// case buffered and uncommitted messages are using this variant.
    AgentExecute {
        /// The ID of the agent
        agent_id: H256,
        /// The sub-command to be executed
        command: AgentExecuteCommand,
    },
    /// Upgrade the Gateway contract
    Upgrade {
        /// Address of the new implementation contract
        impl_address: H160,
        /// Codehash of the implementation contract
        impl_code_hash: H256,
        /// Optionally invoke an initializer in the implementation contract
        initializer: Option<Initializer>,
    },
    /// Set the global operating mode of the Gateway contract
    SetOperatingMode {
        /// The new operating mode
        mode: OperatingMode,
    },
    /// Set token fees of the Gateway contract
    SetTokenTransferFees {
        /// The fee(DOT) for the cost of creating asset on AssetHub
        create_asset_xcm: u128,
        /// The fee(DOT) for the cost of sending asset on AssetHub
        transfer_asset_xcm: u128,
        /// The fee(Ether) for register token to discourage spamming
        register_token: U256,
    },
    /// Set pricing parameters
    SetPricingParameters {
        // ETH/DOT exchange rate
        exchange_rate: UD60x18,
        // Cost of delivering a message from Ethereum to BridgeHub, in ROC/KSM/DOT
        delivery_cost: u128,
        // Fee multiplier
        multiplier: UD60x18,
    },
    /// Transfer ERC20 tokens
    UnlockNativeToken {
        /// ID of the agent
        agent_id: H256,
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
}

impl Command {
    /// Compute the enum variant index
    pub fn index(&self) -> u8 {
        match self {
            Command::AgentExecute { .. } => 0,
            Command::Upgrade { .. } => 1,
            Command::SetOperatingMode { .. } => 5,
            Command::SetTokenTransferFees { .. } => 7,
            Command::SetPricingParameters { .. } => 8,
            Command::UnlockNativeToken { .. } => 9,
            Command::RegisterForeignToken { .. } => 10,
            Command::MintForeignToken { .. } => 11,
        }
    }

    /// ABI-encode the Command.
    pub fn abi_encode(&self) -> Vec<u8> {
        match self {
            Command::AgentExecute { agent_id, command } => ethabi::encode(&[Token::Tuple(vec![
                Token::FixedBytes(agent_id.as_bytes().to_owned()),
                Token::Bytes(command.abi_encode()),
            ])]),
            Command::Upgrade {
                impl_address,
                impl_code_hash,
                initializer,
                ..
            } => ethabi::encode(&[Token::Tuple(vec![
                Token::Address(*impl_address),
                Token::FixedBytes(impl_code_hash.as_bytes().to_owned()),
                initializer
                    .clone()
                    .map_or(Token::Bytes(vec![]), |i| Token::Bytes(i.params)),
            ])]),
            Command::SetOperatingMode { mode } => {
                ethabi::encode(&[Token::Tuple(vec![Token::Uint(U256::from((*mode) as u64))])])
            }
            Command::SetTokenTransferFees {
                create_asset_xcm,
                transfer_asset_xcm,
                register_token,
            } => ethabi::encode(&[Token::Tuple(vec![
                Token::Uint(U256::from(*create_asset_xcm)),
                Token::Uint(U256::from(*transfer_asset_xcm)),
                Token::Uint(*register_token),
            ])]),
            Command::SetPricingParameters {
                exchange_rate,
                delivery_cost,
                multiplier,
            } => ethabi::encode(&[Token::Tuple(vec![
                Token::Uint(exchange_rate.clone().into_inner()),
                Token::Uint(U256::from(*delivery_cost)),
                Token::Uint(multiplier.clone().into_inner()),
            ])]),
            Command::UnlockNativeToken {
                agent_id,
                token,
                recipient,
                amount,
            } => ethabi::encode(&[Token::Tuple(vec![
                Token::FixedBytes(agent_id.as_bytes().to_owned()),
                Token::Address(*token),
                Token::Address(*recipient),
                Token::Uint(U256::from(*amount)),
            ])]),
            Command::RegisterForeignToken {
                token_id,
                name,
                symbol,
                decimals,
            } => ethabi::encode(&[Token::Tuple(vec![
                Token::FixedBytes(token_id.as_bytes().to_owned()),
                Token::String(name.to_owned()),
                Token::String(symbol.to_owned()),
                Token::Uint(U256::from(*decimals)),
            ])]),
            Command::MintForeignToken {
                token_id,
                recipient,
                amount,
            } => ethabi::encode(&[Token::Tuple(vec![
                Token::FixedBytes(token_id.as_bytes().to_owned()),
                Token::Address(*recipient),
                Token::Uint(U256::from(*amount)),
            ])]),
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

/// A Sub-command executable within an agent
#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo)]
#[cfg_attr(feature = "std", derive(PartialEq))]
pub enum AgentExecuteCommand {
    /// Transfer ERC20 tokens
    TransferToken {
        /// Address of the ERC20 token
        token: H160,
        /// The recipient of the tokens
        recipient: H160,
        /// The amount of tokens to transfer
        amount: u128,
    },
}

impl AgentExecuteCommand {
    fn index(&self) -> u8 {
        match self {
            AgentExecuteCommand::TransferToken { .. } => 0,
        }
    }

    /// ABI-encode the sub-command
    pub fn abi_encode(&self) -> Vec<u8> {
        match self {
            AgentExecuteCommand::TransferToken {
                token,
                recipient,
                amount,
            } => ethabi::encode(&[
                Token::Uint(self.index().into()),
                Token::Bytes(ethabi::encode(&[
                    Token::Address(*token),
                    Token::Address(*recipient),
                    Token::Uint(U256::from(*amount)),
                ])),
            ]),
        }
    }
}

/// Message which is awaiting processing in the MessageQueue pallet
#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo)]
#[cfg_attr(feature = "std", derive(PartialEq))]
pub struct QueuedMessage {
    /// Message ID
    pub id: H256,
    /// Channel ID
    pub channel_id: ChannelId,
    /// Command to execute in the Gateway contract
    pub command: Command,
}

#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo)]
#[cfg_attr(feature = "std", derive(PartialEq))]
/// Fee for delivering message
pub struct Fee<Balance>
where
    Balance: BaseArithmetic + Unsigned + Copy,
{
    /// Fee to cover cost of processing the message locally
    pub local: Balance,
    /// Fee to cover cost processing the message remotely
    pub remote: Balance,
}

impl<Balance> Fee<Balance>
where
    Balance: BaseArithmetic + Unsigned + Copy,
{
    pub fn total(&self) -> Balance {
        self.local.saturating_add(self.remote)
    }
}

impl<Balance> From<(Balance, Balance)> for Fee<Balance>
where
    Balance: BaseArithmetic + Unsigned + Copy,
{
    fn from((local, remote): (Balance, Balance)) -> Self {
        Self { local, remote }
    }
}

/// A trait for sending messages to Ethereum
pub trait SendMessage: SendMessageFeeProvider {
    type Ticket: Clone + Encode + Decode;

    /// Validate an outbound message and return a tuple:
    /// 1. Ticket for submitting the message
    /// 2. Delivery fee
    fn validate(
        message: &Message,
    ) -> Result<(Self::Ticket, Fee<<Self as SendMessageFeeProvider>::Balance>), SendError>;

    /// Submit the message ticket for eventual delivery to Ethereum
    fn deliver(ticket: Self::Ticket) -> Result<H256, SendError>;
}

pub trait Ticket: Encode + Decode + Clone {
    fn message_id(&self) -> H256;
}

pub trait GasMeter {
    /// All the gas used for submitting a message to Ethereum, minus the cost of dispatching
    /// the command within the message
    const MAXIMUM_BASE_GAS: u64;

    /// Total gas consumed at most, including verification & dispatch
    fn maximum_gas_used_at_most(command: &Command) -> u64 {
        Self::MAXIMUM_BASE_GAS + Self::maximum_dispatch_gas_used_at_most(command)
    }

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
    // The base transaction cost, which includes:
    // 21_000 transaction cost, roughly worst case 64_000 for calldata, and 100_000
    // for message verification
    const MAXIMUM_BASE_GAS: u64 = 185_000;

    fn maximum_dispatch_gas_used_at_most(command: &Command) -> u64 {
        match command {
            Command::SetOperatingMode { .. } => 40_000,
            Command::AgentExecute { command, .. } => match command {
                // Execute IERC20.transferFrom
                //
                // Worst-case assumptions are important:
                // * No gas refund for clearing storage slot of source account in ERC20 contract
                // * Assume dest account in ERC20 contract does not yet have a storage slot
                // * ERC20.transferFrom possibly does other business logic besides updating balances
                AgentExecuteCommand::TransferToken { .. } => 200_000,
            },
            Command::Upgrade { initializer, .. } => {
                let initializer_max_gas = match *initializer {
                    Some(Initializer {
                        maximum_required_gas,
                        ..
                    }) => maximum_required_gas,
                    None => 0,
                };
                // total maximum gas must also include the gas used for updating the proxy before
                // the the initializer is called.
                50_000 + initializer_max_gas
            }
            Command::SetTokenTransferFees { .. } => 60_000,
            Command::SetPricingParameters { .. } => 60_000,
            Command::UnlockNativeToken { .. } => 200_000,
            Command::RegisterForeignToken { .. } => 1_200_000,
            Command::MintForeignToken { .. } => 100_000,
        }
    }
}

impl GasMeter for () {
    const MAXIMUM_BASE_GAS: u64 = 1;

    fn maximum_dispatch_gas_used_at_most(_: &Command) -> u64 {
        1
    }
}

pub const ETHER_DECIMALS: u8 = 18;

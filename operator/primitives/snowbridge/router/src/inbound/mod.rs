// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Converts messages from Ethereum to XCM messages

pub mod envelope;
#[cfg(test)]
mod tests;

use crate::inbound::envelope::Envelope;
use codec::{Decode, Encode};
use core::marker::PhantomData;
use frame_support::{traits::tokens::Balance as BalanceT, PalletError};
use scale_info::TypeInfo;
use snowbridge_core::{Channel, TokenId};
use sp_core::{Get, RuntimeDebug, H160, H256};
use sp_io::hashing::blake2_256;
use sp_runtime::{traits::MaybeEquivalence, DispatchError, MultiAddress};
use sp_std::prelude::*;
use xcm::prelude::{Junction::AccountKey20, *};
use xcm_executor::traits::ConvertLocation;

const MINIMUM_DEPOSIT: u128 = 1;

/// Messages from Ethereum are versioned. This is because in future,
/// we may want to evolve the protocol so that the ethereum side sends XCM messages directly.
/// Instead having BridgeHub transcode the messages into XCM.
#[derive(Clone, Encode, Decode, RuntimeDebug)]
pub enum VersionedXcmMessage {
    V1(MessageV1),
}

/// For V1, the ethereum side sends messages which are transcoded into XCM. These messages are
/// self-contained, in that they can be transcoded using only information in the message.
#[derive(Clone, Encode, Decode, RuntimeDebug)]
pub struct MessageV1 {
    /// EIP-155 chain id of the origin Ethereum network
    pub chain_id: u64,
    /// The command originating from the Gateway contract
    pub command: Command,
}

#[derive(Clone, Encode, Decode, RuntimeDebug)]
pub enum Command {
    /// Register a wrapped token on the AssetHub `ForeignAssets` pallet
    RegisterToken {
        /// The address of the ERC20 token to be bridged over to AssetHub
        token: H160,
        /// XCM execution fee on AssetHub
        fee: u128,
    },
    /// Send Ethereum token to AssetHub or another parachain
    SendToken {
        /// The address of the ERC20 token to be bridged over to AssetHub
        token: H160,
        /// The destination for the transfer
        destination: Destination,
        /// Amount to transfer
        amount: u128,
        /// XCM execution fee on AssetHub
        fee: u128,
    },
    /// Send Polkadot token back to the original parachain
    SendNativeToken {
        /// The Id of the token
        token_id: TokenId,
        /// The destination for the transfer
        destination: Destination,
        /// Amount to transfer
        amount: u128,
        /// XCM execution fee on AssetHub
        fee: u128,
    },
}

/// Destination for bridged tokens
#[derive(Clone, Encode, Decode, RuntimeDebug)]
pub enum Destination {
    /// The funds will be deposited into account `id` on AssetHub
    AccountId32 { id: [u8; 32] },
    /// The funds will deposited into the sovereign account of destination parachain `para_id` on
    /// AssetHub, Account `id` on the destination parachain will receive the funds via a
    /// reserve-backed transfer. See <https://github.com/paritytech/xcm-format#depositreserveasset>
    ForeignAccountId32 {
        para_id: u32,
        id: [u8; 32],
        /// XCM execution fee on final destination
        fee: u128,
    },
    /// The funds will deposited into the sovereign account of destination parachain `para_id` on
    /// AssetHub, Account `id` on the destination parachain will receive the funds via a
    /// reserve-backed transfer. See <https://github.com/paritytech/xcm-format#depositreserveasset>
    ForeignAccountId20 {
        para_id: u32,
        id: [u8; 20],
        /// XCM execution fee on final destination
        fee: u128,
    },
}

pub struct MessageToXcm<
    CreateAssetCall,
    CreateAssetDeposit,
    InboundQueuePalletInstance,
    AccountId,
    Balance,
    ConvertAssetId,
    EthereumUniversalLocation,
    GlobalAssetHubLocation,
> where
    CreateAssetCall: Get<CallIndex>,
    CreateAssetDeposit: Get<u128>,
    Balance: BalanceT,
    ConvertAssetId: MaybeEquivalence<TokenId, Location>,
    EthereumUniversalLocation: Get<InteriorLocation>,
    GlobalAssetHubLocation: Get<Location>,
{
    _phantom: PhantomData<(
        CreateAssetCall,
        CreateAssetDeposit,
        InboundQueuePalletInstance,
        AccountId,
        Balance,
        ConvertAssetId,
        EthereumUniversalLocation,
        GlobalAssetHubLocation,
    )>,
}

/// Reason why a message conversion failed.
#[derive(Copy, Clone, TypeInfo, PalletError, Encode, Decode, RuntimeDebug)]
pub enum ConvertMessageError {
    /// The message version is not supported for conversion.
    UnsupportedVersion,
    InvalidDestination,
    InvalidToken,
    /// The fee asset is not supported for conversion.
    UnsupportedFeeAsset,
    CannotReanchor,
}

/// convert the inbound message to xcm which will be forwarded to the destination chain
pub trait ConvertMessage {
    type Balance: BalanceT + From<u128>;
    type AccountId;
    /// Converts a versioned message into an XCM message and an optional topicID
    fn convert(
        message_id: H256,
        message: VersionedXcmMessage,
    ) -> Result<(Xcm<()>, Self::Balance), ConvertMessageError>;
}

pub type CallIndex = [u8; 2];

impl<
        CreateAssetCall,
        CreateAssetDeposit,
        InboundQueuePalletInstance,
        AccountId,
        Balance,
        ConvertAssetId,
        EthereumUniversalLocation,
        GlobalAssetHubLocation,
    > ConvertMessage
    for MessageToXcm<
        CreateAssetCall,
        CreateAssetDeposit,
        InboundQueuePalletInstance,
        AccountId,
        Balance,
        ConvertAssetId,
        EthereumUniversalLocation,
        GlobalAssetHubLocation,
    >
where
    CreateAssetCall: Get<CallIndex>,
    CreateAssetDeposit: Get<u128>,
    InboundQueuePalletInstance: Get<u8>,
    Balance: BalanceT + From<u128>,
    AccountId: Into<[u8; 32]>,
    ConvertAssetId: MaybeEquivalence<TokenId, Location>,
    EthereumUniversalLocation: Get<InteriorLocation>,
    GlobalAssetHubLocation: Get<Location>,
{
    type Balance = Balance;
    type AccountId = AccountId;

    fn convert(
        message_id: H256,
        message: VersionedXcmMessage,
    ) -> Result<(Xcm<()>, Self::Balance), ConvertMessageError> {
        use Command::*;
        use VersionedXcmMessage::*;
        match message {
            V1(MessageV1 {
                chain_id,
                command: RegisterToken { token, fee },
            }) => Ok(Self::convert_register_token(
                message_id, chain_id, token, fee,
            )),
            V1(MessageV1 {
                chain_id,
                command:
                    SendToken {
                        token,
                        destination,
                        amount,
                        fee,
                    },
            }) => Ok(Self::convert_send_token(
                message_id,
                chain_id,
                token,
                destination,
                amount,
                fee,
            )),
            V1(MessageV1 {
                chain_id,
                command:
                    SendNativeToken {
                        token_id,
                        destination,
                        amount,
                        fee,
                    },
            }) => Self::convert_send_native_token(
                message_id,
                chain_id,
                token_id,
                destination,
                amount,
                fee,
            ),
        }
    }
}

impl<
        CreateAssetCall,
        CreateAssetDeposit,
        InboundQueuePalletInstance,
        AccountId,
        Balance,
        ConvertAssetId,
        EthereumUniversalLocation,
        GlobalAssetHubLocation,
    >
    MessageToXcm<
        CreateAssetCall,
        CreateAssetDeposit,
        InboundQueuePalletInstance,
        AccountId,
        Balance,
        ConvertAssetId,
        EthereumUniversalLocation,
        GlobalAssetHubLocation,
    >
where
    CreateAssetCall: Get<CallIndex>,
    CreateAssetDeposit: Get<u128>,
    InboundQueuePalletInstance: Get<u8>,
    Balance: BalanceT + From<u128>,
    AccountId: Into<[u8; 32]>,
    ConvertAssetId: MaybeEquivalence<TokenId, Location>,
    EthereumUniversalLocation: Get<InteriorLocation>,
    GlobalAssetHubLocation: Get<Location>,
{
    fn convert_register_token(
        message_id: H256,
        chain_id: u64,
        token: H160,
        fee: u128,
    ) -> (Xcm<()>, Balance) {
        let network = Ethereum { chain_id };
        let xcm_fee: Asset = (Location::parent(), fee).into();
        let deposit: Asset = (Location::parent(), CreateAssetDeposit::get()).into();

        let total_amount = fee + CreateAssetDeposit::get();
        let total: Asset = (Location::parent(), total_amount).into();

        let bridge_location = Location::new(2, GlobalConsensus(network));

        let owner = EthereumLocationsConverterFor::<[u8; 32]>::from_chain_id(&chain_id);
        let asset_id = Self::convert_token_address(network, token);
        let create_call_index: [u8; 2] = CreateAssetCall::get();
        let inbound_queue_pallet_index = InboundQueuePalletInstance::get();

        let xcm: Xcm<()> = vec![
            // Teleport required fees.
            ReceiveTeleportedAsset(total.into()),
            // Pay for execution.
            BuyExecution {
                fees: xcm_fee,
                weight_limit: Unlimited,
            },
            // Fund the snowbridge sovereign with the required deposit for creation.
            DepositAsset {
                assets: Definite(deposit.into()),
                beneficiary: bridge_location.clone(),
            },
            // This `SetAppendix` ensures that `xcm_fee` not spent by `Transact` will be
            // deposited to snowbridge sovereign, instead of being trapped, regardless of
            // `Transact` success or not.
            SetAppendix(Xcm(vec![
                RefundSurplus,
                DepositAsset {
                    assets: AllCounted(1).into(),
                    beneficiary: bridge_location,
                },
            ])),
            // Only our inbound-queue pallet is allowed to invoke `UniversalOrigin`.
            DescendOrigin(PalletInstance(inbound_queue_pallet_index).into()),
            // Change origin to the bridge.
            UniversalOrigin(GlobalConsensus(network)),
            // Call create_asset on foreign assets pallet.
            Transact {
                origin_kind: OriginKind::Xcm,
                require_weight_at_most: Weight::from_parts(400_000_000, 8_000),
                call: (
                    create_call_index,
                    asset_id,
                    MultiAddress::<[u8; 32], ()>::Id(owner),
                    MINIMUM_DEPOSIT,
                )
                    .encode()
                    .into(),
            },
            // Forward message id to Asset Hub
            SetTopic(message_id.into()),
            // Once the program ends here, appendix program will run, which will deposit any
            // leftover fee to snowbridge sovereign.
        ]
        .into();

        (xcm, total_amount.into())
    }

    fn convert_send_token(
        message_id: H256,
        chain_id: u64,
        token: H160,
        destination: Destination,
        amount: u128,
        asset_hub_fee: u128,
    ) -> (Xcm<()>, Balance) {
        let network = Ethereum { chain_id };
        let asset_hub_fee_asset: Asset = (Location::parent(), asset_hub_fee).into();
        let asset: Asset = (Self::convert_token_address(network, token), amount).into();

        let (dest_para_id, beneficiary, dest_para_fee) = match destination {
            // Final destination is a 32-byte account on AssetHub
            Destination::AccountId32 { id } => (
                None,
                Location::new(0, [AccountId32 { network: None, id }]),
                0,
            ),
            // Final destination is a 32-byte account on a sibling of AssetHub
            Destination::ForeignAccountId32 { para_id, id, fee } => (
                Some(para_id),
                Location::new(0, [AccountId32 { network: None, id }]),
                // Total fee needs to cover execution on AssetHub and Sibling
                fee,
            ),
            // Final destination is a 20-byte account on a sibling of AssetHub
            Destination::ForeignAccountId20 { para_id, id, fee } => (
                Some(para_id),
                Location::new(
                    0,
                    [AccountKey20 {
                        network: None,
                        key: id,
                    }],
                ),
                // Total fee needs to cover execution on AssetHub and Sibling
                fee,
            ),
        };

        let total_fees = asset_hub_fee.saturating_add(dest_para_fee);
        let total_fee_asset: Asset = (Location::parent(), total_fees).into();
        let inbound_queue_pallet_index = InboundQueuePalletInstance::get();

        let mut instructions = vec![
            ReceiveTeleportedAsset(total_fee_asset.into()),
            BuyExecution {
                fees: asset_hub_fee_asset,
                weight_limit: Unlimited,
            },
            DescendOrigin(PalletInstance(inbound_queue_pallet_index).into()),
            UniversalOrigin(GlobalConsensus(network)),
            ReserveAssetDeposited(asset.clone().into()),
            ClearOrigin,
        ];

        match dest_para_id {
            Some(dest_para_id) => {
                let dest_para_fee_asset: Asset = (Location::parent(), dest_para_fee).into();
                let bridge_location = Location::new(2, GlobalConsensus(network));

                instructions.extend(vec![
                    // After program finishes deposit any leftover assets to the snowbridge
                    // sovereign.
                    SetAppendix(Xcm(vec![DepositAsset {
                        assets: Wild(AllCounted(2)),
                        beneficiary: bridge_location,
                    }])),
                    // Perform a deposit reserve to send to destination chain.
                    DepositReserveAsset {
                        // Send over assets and unspent fees, XCM delivery fee will be charged from
                        // here.
                        assets: Wild(AllCounted(2)),
                        dest: Location::new(1, [Parachain(dest_para_id)]),
                        xcm: vec![
                            // Buy execution on target.
                            BuyExecution {
                                fees: dest_para_fee_asset,
                                weight_limit: Unlimited,
                            },
                            // Deposit assets to beneficiary.
                            DepositAsset {
                                assets: Wild(AllCounted(2)),
                                beneficiary,
                            },
                            // Forward message id to destination parachain.
                            SetTopic(message_id.into()),
                        ]
                        .into(),
                    },
                ]);
            }
            None => {
                instructions.extend(vec![
                    // Deposit both asset and fees to beneficiary so the fees will not get
                    // trapped. Another benefit is when fees left more than ED on AssetHub could be
                    // used to create the beneficiary account in case it does not exist.
                    DepositAsset {
                        assets: Wild(AllCounted(2)),
                        beneficiary,
                    },
                ]);
            }
        }

        // Forward message id to Asset Hub.
        instructions.push(SetTopic(message_id.into()));

        // The `instructions` to forward to AssetHub, and the `total_fees` to locally burn (since
        // they are teleported within `instructions`).
        (instructions.into(), total_fees.into())
    }

    // Convert ERC20 token address to a location that can be understood by Assets Hub.
    fn convert_token_address(network: NetworkId, token: H160) -> Location {
        Location::new(
            2,
            [
                GlobalConsensus(network),
                AccountKey20 {
                    network: None,
                    key: token.into(),
                },
            ],
        )
    }

    /// Constructs an XCM message destined for AssetHub that withdraws assets from the sovereign
    /// account of the Gateway contract and either deposits those assets into a recipient account or
    /// forwards the assets to another parachain.
    fn convert_send_native_token(
        message_id: H256,
        chain_id: u64,
        token_id: TokenId,
        destination: Destination,
        amount: u128,
        asset_hub_fee: u128,
    ) -> Result<(Xcm<()>, Balance), ConvertMessageError> {
        let network = Ethereum { chain_id };
        let asset_hub_fee_asset: Asset = (Location::parent(), asset_hub_fee).into();

        let beneficiary = match destination {
            // Final destination is a 32-byte account on AssetHub
            Destination::AccountId32 { id } => {
                Ok(Location::new(0, [AccountId32 { network: None, id }]))
            }
            // Forwarding to a destination parachain is not allowed for PNA and is validated on the
            // Ethereum side. https://github.com/Snowfork/snowbridge/blob/e87ddb2215b513455c844463a25323bb9c01ff36/contracts/src/Assets.sol#L216-L224
            _ => Err(ConvertMessageError::InvalidDestination),
        }?;

        let total_fee_asset: Asset = (Location::parent(), asset_hub_fee).into();

        let asset_loc =
            ConvertAssetId::convert(&token_id).ok_or(ConvertMessageError::InvalidToken)?;

        let mut reanchored_asset_loc = asset_loc.clone();
        reanchored_asset_loc
            .reanchor(
                &GlobalAssetHubLocation::get(),
                &EthereumUniversalLocation::get(),
            )
            .map_err(|_| ConvertMessageError::CannotReanchor)?;

        let asset: Asset = (reanchored_asset_loc, amount).into();

        let inbound_queue_pallet_index = InboundQueuePalletInstance::get();

        let instructions = vec![
            ReceiveTeleportedAsset(total_fee_asset.clone().into()),
            BuyExecution {
                fees: asset_hub_fee_asset,
                weight_limit: Unlimited,
            },
            DescendOrigin(PalletInstance(inbound_queue_pallet_index).into()),
            UniversalOrigin(GlobalConsensus(network)),
            WithdrawAsset(asset.clone().into()),
            // Deposit both asset and fees to beneficiary so the fees will not get
            // trapped. Another benefit is when fees left more than ED on AssetHub could be
            // used to create the beneficiary account in case it does not exist.
            DepositAsset {
                assets: Wild(AllCounted(2)),
                beneficiary,
            },
            SetTopic(message_id.into()),
        ];

        // `total_fees` to burn on this chain when sending `instructions` to run on AH (which also
        // teleport fees)
        Ok((instructions.into(), asset_hub_fee.into()))
    }
}

pub struct EthereumLocationsConverterFor<AccountId>(PhantomData<AccountId>);
impl<AccountId> ConvertLocation<AccountId> for EthereumLocationsConverterFor<AccountId>
where
    AccountId: From<[u8; 32]> + Clone,
{
    fn convert_location(location: &Location) -> Option<AccountId> {
        match location.unpack() {
            (2, [GlobalConsensus(Ethereum { chain_id })]) => {
                Some(Self::from_chain_id(chain_id).into())
            }
            (2, [GlobalConsensus(Ethereum { chain_id }), AccountKey20 { network: _, key }]) => {
                Some(Self::from_chain_id_with_key(chain_id, *key).into())
            }
            _ => None,
        }
    }
}

impl<AccountId> EthereumLocationsConverterFor<AccountId> {
    pub fn from_chain_id(chain_id: &u64) -> [u8; 32] {
        (b"ethereum-chain", chain_id).using_encoded(blake2_256)
    }
    pub fn from_chain_id_with_key(chain_id: &u64, key: [u8; 20]) -> [u8; 32] {
        (b"ethereum-chain", chain_id, key).using_encoded(blake2_256)
    }
}

pub trait MessageProcessor {
    /// Lightweight function to check if this processor can handle the message
    fn can_process_message(channel: &Channel, envelope: &Envelope) -> bool;
    /// Process the message
    fn process_message(channel: Channel, envelope: Envelope) -> Result<(), DispatchError>;
}

#[impl_trait_for_tuples::impl_for_tuples(10)]
impl MessageProcessor for Tuple {
    fn can_process_message(channel: &Channel, envelope: &Envelope) -> bool {
        for_tuples!( #(
 			match Tuple::can_process_message(&channel, &envelope) {
				true => {
					return true;
				},
				_ => {}
			}
		)* );

        false
    }

    fn process_message(channel: Channel, envelope: Envelope) -> Result<(), DispatchError> {
        for_tuples!( #(
 			match Tuple::can_process_message(&channel, &envelope) {
				true => {
					return Tuple::process_message(channel, envelope)
				},
				_ => {}
			}
		)* );

        Err(DispatchError::Other("No handler for message found"))
    }
}

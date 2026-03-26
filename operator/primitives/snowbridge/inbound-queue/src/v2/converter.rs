// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Converts messages from Solidity ABI-encoding to XCM
extern crate alloc;

use super::{message::*, traits::*};
use crate::{v2::LOG_TARGET, CallIndex, EthereumLocationsConverterFor};
use alloc::vec;
use alloc::vec::Vec;
use codec::{Decode, DecodeLimit, Encode};
use core::marker::PhantomData;
use frame_support::ensure;
use snowbridge_core::TokenId;
use sp_core::{Get, RuntimeDebug, H160};
use sp_io::hashing::blake2_256;
use sp_runtime::{traits::MaybeEquivalence, MultiAddress};
use xcm::{
    prelude::{Junction::*, *},
    MAX_XCM_DECODE_DEPTH,
};

const MINIMUM_DEPOSIT: u128 = 1;

/// Topic prefix used for generating unique identifiers for messages
const INBOUND_QUEUE_TOPIC_PREFIX: &str = "SnowbridgeInboundQueueV2";

/// Representation of an intermediate parsed message, before final
/// conversion to XCM.
#[derive(Clone, RuntimeDebug, Encode)]
pub struct PreparedMessage {
    /// Ethereum account that initiated this messaging operation
    pub origin: H160,
    /// The claimer in the case that funds get trapped.
    pub claimer: Location,
    /// The assets bridged from Ethereum
    pub assets: Vec<AssetTransfer>,
    /// The XCM to execute on the destination
    pub remote_xcm: Xcm<()>,
    /// Fee in Ether to cover the xcm execution on AH.
    pub execution_fee: Asset,
}

/// An asset transfer instruction
#[derive(Clone, RuntimeDebug, Encode)]
pub enum AssetTransfer {
    ReserveDeposit(Asset),
    ReserveWithdraw(Asset),
}

/// Concrete implementation of `ConvertMessage`
pub struct MessageToXcm<
    CreateAssetCall,
    CreateAssetDeposit,
    EthereumNetwork,
    InboundQueueLocation,
    ConvertAssetId,
    GatewayProxyAddress,
    EthereumUniversalLocation,
    GlobalAssetHubLocation,
> {
    _phantom: PhantomData<(
        CreateAssetCall,
        CreateAssetDeposit,
        EthereumNetwork,
        InboundQueueLocation,
        ConvertAssetId,
        GatewayProxyAddress,
        EthereumUniversalLocation,
        GlobalAssetHubLocation,
    )>,
}

impl<
        CreateAssetCall,
        CreateAssetDeposit,
        EthereumNetwork,
        InboundQueueLocation,
        ConvertAssetId,
        GatewayProxyAddress,
        EthereumUniversalLocation,
        GlobalAssetHubLocation,
    >
    MessageToXcm<
        CreateAssetCall,
        CreateAssetDeposit,
        EthereumNetwork,
        InboundQueueLocation,
        ConvertAssetId,
        GatewayProxyAddress,
        EthereumUniversalLocation,
        GlobalAssetHubLocation,
    >
where
    CreateAssetCall: Get<CallIndex>,
    CreateAssetDeposit: Get<u128>,
    EthereumNetwork: Get<NetworkId>,
    InboundQueueLocation: Get<InteriorLocation>,
    ConvertAssetId: MaybeEquivalence<TokenId, Location>,
    GatewayProxyAddress: Get<H160>,
    EthereumUniversalLocation: Get<InteriorLocation>,
    GlobalAssetHubLocation: Get<Location>,
{
    /// Parse the message into an intermediate form, with all fields decoded
    /// and prepared.
    fn prepare(message: Message) -> Result<PreparedMessage, ConvertMessageError> {
        // ETH "asset id" is the Ethereum root location. Same location used for the "bridge owner".
        let ether_location = Location::new(2, [GlobalConsensus(EthereumNetwork::get())]);
        let bridge_owner = Self::bridge_owner()?;

        let claimer = message
            .claimer
            // Get the claimer from the message,
            .and_then(|claimer_bytes| Location::decode(&mut claimer_bytes.as_ref()).ok())
            // or use the Snowbridge sovereign on AH as the fallback claimer.
            .unwrap_or_else(|| {
                Location::new(
                    0,
                    [AccountId32 {
                        network: None,
                        id: bridge_owner,
                    }],
                )
            });

        let mut remote_xcm: Xcm<()> = match &message.xcm {
            Payload::Raw(raw) => Self::decode_raw_xcm(raw),
            Payload::CreateAsset { token, network } => Self::make_create_asset_xcm(
                token,
                *network,
                message.value,
                bridge_owner,
                claimer.clone(),
            )?,
        };

        // Asset to cover XCM execution fee
        let execution_fee_asset: Asset = (ether_location.clone(), message.execution_fee).into();

        let mut assets = vec![];

        if message.value > 0 {
            // Asset for remaining ether
            let remaining_ether_asset: Asset = (ether_location.clone(), message.value).into();
            assets.push(AssetTransfer::ReserveDeposit(remaining_ether_asset));
        }

        for asset in &message.assets {
            match asset {
                EthereumAsset::NativeTokenERC20 { token_id, value } => {
                    ensure!(*token_id != H160::zero(), ConvertMessageError::InvalidAsset);
                    let token_location: Location = Location::new(
                        2,
                        [
                            GlobalConsensus(EthereumNetwork::get()),
                            AccountKey20 {
                                network: None,
                                key: (*token_id).into(),
                            },
                        ],
                    );
                    let asset: Asset = (token_location, *value).into();
                    assets.push(AssetTransfer::ReserveDeposit(asset));
                }
                EthereumAsset::ForeignTokenERC20 { token_id, value } => {
                    let asset_loc = ConvertAssetId::convert(&token_id)
                        .ok_or(ConvertMessageError::InvalidAsset)?;
                    let reanchored_asset_loc = asset_loc
                        .reanchored(
                            &GlobalAssetHubLocation::get(),
                            &EthereumUniversalLocation::get(),
                        )
                        .map_err(|_| ConvertMessageError::CannotReanchor)?;
                    let asset: Asset = (reanchored_asset_loc, *value).into();
                    assets.push(AssetTransfer::ReserveWithdraw(asset));
                }
            }
        }

        // Add SetTopic instruction if not already present as the last instruction
        if !matches!(remote_xcm.0.last(), Some(SetTopic(_))) {
            let topic = blake2_256(&(INBOUND_QUEUE_TOPIC_PREFIX, message.nonce).encode());
            remote_xcm.0.push(SetTopic(topic));
        }

        let prepared_message = PreparedMessage {
            origin: message.origin,
            claimer,
            assets,
            remote_xcm,
            execution_fee: execution_fee_asset,
        };

        Ok(prepared_message)
    }

    /// Get the bridge owner account ID from the current Ethereum network chain ID.
    /// Returns an error if the network is not Ethereum.
    fn bridge_owner() -> Result<[u8; 32], ConvertMessageError> {
        let chain_id = match EthereumNetwork::get() {
            NetworkId::Ethereum { chain_id } => chain_id,
            _ => return Err(ConvertMessageError::InvalidNetwork),
        };
        Ok(EthereumLocationsConverterFor::<[u8; 32]>::from_chain_id(
            &chain_id,
        ))
    }

    /// Construct the remote XCM needed to create a new asset in the `ForeignAssets` pallet
    /// on AssetHub. Polkadot is the only supported network at the moment.
    fn make_create_asset_xcm(
        token: &H160,
        network: super::message::Network,
        eth_value: u128,
        bridge_owner: [u8; 32],
        claimer: Location,
    ) -> Result<Xcm<()>, ConvertMessageError> {
        let dot_asset = Location::new(1, Here);
        let dot_fee: xcm::prelude::Asset = (dot_asset, CreateAssetDeposit::get()).into();

        let eth_asset: xcm::prelude::Asset = (
            Location::new(2, [GlobalConsensus(EthereumNetwork::get())]),
            eth_value,
        )
            .into();

        let create_call_index: [u8; 2] = CreateAssetCall::get();

        let asset_id = Location::new(
            2,
            [
                GlobalConsensus(EthereumNetwork::get()),
                AccountKey20 {
                    network: None,
                    key: (*token).into(),
                },
            ],
        );

        match network {
            super::message::Network::Polkadot => Ok(Self::make_create_asset_xcm_for_polkadot(
                create_call_index,
                asset_id,
                bridge_owner,
                dot_fee,
                eth_asset,
                claimer,
            )),
        }
    }

    /// Construct the asset creation XCM for the Polkdot network.
    fn make_create_asset_xcm_for_polkadot(
        create_call_index: [u8; 2],
        asset_id: Location,
        bridge_owner: [u8; 32],
        dot_fee_asset: xcm::prelude::Asset,
        eth_asset: xcm::prelude::Asset,
        claimer: Location,
    ) -> Xcm<()> {
        vec![
            // Exchange eth for dot to pay the asset creation deposit.
            ExchangeAsset {
                give: eth_asset.into(),
                want: dot_fee_asset.clone().into(),
                maximal: false,
            },
            // Deposit the dot deposit into the bridge sovereign account (where the asset
            // creation fee will be deducted from).
            DepositAsset {
                assets: dot_fee_asset.clone().into(),
                beneficiary: bridge_owner.into(),
            },
            // Call to create the asset.
            Transact {
                origin_kind: OriginKind::Xcm,
                fallback_max_weight: None,
                call: (
                    create_call_index,
                    asset_id.clone(),
                    MultiAddress::<[u8; 32], ()>::Id(bridge_owner.into()),
                    MINIMUM_DEPOSIT,
                )
                    .encode()
                    .into(),
            },
            RefundSurplus,
            // Deposit leftover funds to Snowbridge sovereign
            DepositAsset {
                assets: Wild(AllCounted(2)),
                beneficiary: claimer,
            },
        ]
        .into()
    }

    /// Parse and (non-strictly) decode `raw` XCM bytes into a `Xcm<()>`.
    /// If decoding fails, return an empty `Xcm<()>`—thus allowing the message
    /// to proceed so assets can still be trapped on AH rather than the funds being locked on
    /// Ethereum but not accessible on AH.
    fn decode_raw_xcm(raw: &[u8]) -> Xcm<()> {
        let mut data = raw;
        if let Ok(versioned_xcm) =
            VersionedXcm::<()>::decode_with_depth_limit(MAX_XCM_DECODE_DEPTH, &mut data)
        {
            if let Ok(decoded_xcm) = versioned_xcm.try_into() {
                return decoded_xcm;
            }
        }
        // Decoding failed; allow an empty XCM so the message won't fail entirely.
        Xcm::new()
    }
}

impl<
        CreateAssetCall,
        CreateAssetDeposit,
        EthereumNetwork,
        InboundQueueLocation,
        ConvertAssetId,
        GatewayProxyAddress,
        EthereumUniversalLocation,
        GlobalAssetHubLocation,
    > ConvertMessage
    for MessageToXcm<
        CreateAssetCall,
        CreateAssetDeposit,
        EthereumNetwork,
        InboundQueueLocation,
        ConvertAssetId,
        GatewayProxyAddress,
        EthereumUniversalLocation,
        GlobalAssetHubLocation,
    >
where
    CreateAssetCall: Get<CallIndex>,
    CreateAssetDeposit: Get<u128>,
    EthereumNetwork: Get<NetworkId>,
    InboundQueueLocation: Get<InteriorLocation>,
    ConvertAssetId: MaybeEquivalence<TokenId, Location>,
    GatewayProxyAddress: Get<H160>,
    EthereumUniversalLocation: Get<InteriorLocation>,
    GlobalAssetHubLocation: Get<Location>,
{
    fn convert(message: Message) -> Result<Xcm<()>, ConvertMessageError> {
        let message = Self::prepare(message)?;

        log::trace!(target: LOG_TARGET, "prepared message: {:?}", message);

        let mut instructions = vec![
            DescendOrigin(InboundQueueLocation::get()),
            UniversalOrigin(GlobalConsensus(EthereumNetwork::get())),
            ReserveAssetDeposited(message.execution_fee.clone().into()),
        ];

        // Set claimer before PayFees, in case the fees are not enough. Then the claimer will be
        // able to claim the funds still.
        instructions.push(SetHints {
            hints: vec![AssetClaimer {
                location: message.claimer,
            }]
            .try_into()
            .expect("checked statically, qed"),
        });

        instructions.push(PayFees {
            asset: message.execution_fee.clone(),
        });

        let mut reserve_deposit_assets = vec![];
        let mut reserve_withdraw_assets = vec![];

        for asset in message.assets {
            match asset {
                AssetTransfer::ReserveDeposit(asset) => reserve_deposit_assets.push(asset),
                AssetTransfer::ReserveWithdraw(asset) => reserve_withdraw_assets.push(asset),
            };
        }

        if !reserve_deposit_assets.is_empty() {
            instructions.push(ReserveAssetDeposited(reserve_deposit_assets.into()));
        }
        if !reserve_withdraw_assets.is_empty() {
            instructions.push(WithdrawAsset(reserve_withdraw_assets.into()));
        }

        // If the message origin is not the gateway proxy contract, set the origin to
        // the original sender on Ethereum. Important to be before the arbitrary XCM that is
        // appended to the message on the next line.
        if message.origin != GatewayProxyAddress::get() {
            instructions.push(DescendOrigin(
                AccountKey20 {
                    key: message.origin.into(),
                    network: None,
                }
                .into(),
            ));
        }

        // Add the XCM sent in the message to the end of the xcm instruction
        instructions.extend(message.remote_xcm.0);

        Ok(instructions.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use codec::Encode;
    use frame_support::{assert_err, assert_ok, parameter_types};
    use hex_literal::hex;
    use snowbridge_core::TokenId;
    use sp_core::{H160, H256};
    use sp_runtime::traits::MaybeEquivalence;
    use xcm::opaque::latest::WESTEND_GENESIS_HASH;
    const GATEWAY_ADDRESS: [u8; 20] = hex!["eda338e4dc46038493b885327842fd3e301cab39"];

    parameter_types! {
        pub const EthereumNetwork: xcm::v5::NetworkId = xcm::v5::NetworkId::Ethereum { chain_id: 11155111 };
        pub const GatewayAddress: H160 = H160(GATEWAY_ADDRESS);
        pub InboundQueueLocation: InteriorLocation = [PalletInstance(84)].into();
        pub UniversalLocation: InteriorLocation =
            [GlobalConsensus(ByGenesis(WESTEND_GENESIS_HASH)), Parachain(1002)].into();
        pub AssetHubFromEthereum: Location = Location::new(1,[GlobalConsensus(ByGenesis(WESTEND_GENESIS_HASH)),Parachain(1000)]);
        pub const CreateAssetCall: [u8;2] = [53, 0];
        pub const CreateAssetDeposit: u128 = 10_000_000_000u128;
    }

    pub struct MockTokenIdConvert;
    impl MaybeEquivalence<TokenId, Location> for MockTokenIdConvert {
        fn convert(_id: &TokenId) -> Option<Location> {
            Some(Location::parent())
        }
        fn convert_back(_loc: &Location) -> Option<TokenId> {
            None
        }
    }

    pub struct MockFailedTokenConvert;
    impl MaybeEquivalence<TokenId, Location> for MockFailedTokenConvert {
        fn convert(_id: &TokenId) -> Option<Location> {
            None
        }
        fn convert_back(_loc: &Location) -> Option<TokenId> {
            None
        }
    }

    type Converter = MessageToXcm<
        CreateAssetCall,
        CreateAssetDeposit,
        EthereumNetwork,
        InboundQueueLocation,
        MockTokenIdConvert,
        GatewayAddress,
        UniversalLocation,
        AssetHubFromEthereum,
    >;

    type ConverterFailing = MessageToXcm<
        CreateAssetCall,
        CreateAssetDeposit,
        EthereumNetwork,
        InboundQueueLocation,
        MockFailedTokenConvert,
        GatewayAddress,
        UniversalLocation,
        AssetHubFromEthereum,
    >;

    #[test]
    fn test_successful_message() {
        sp_io::TestExternalities::default().execute_with(|| {
            let origin: H160 = hex!("29e3b139f4393adda86303fcdaa35f60bb7092bf").into();
            let native_token_id: H160 = hex!("5615deb798bb3e4dfa0139dfa1b3d433cc23b72f").into();
            let foreign_token_id: H256 =
                hex!("37a6c666da38711a963d938eafdd09314fd3f95a96a3baffb55f26560f4ecdd8").into();
            let beneficiary: Location =
                hex!("908783d8cd24c9e02cee1d26ab9c46d458621ad0150b626c536a40b9df3f09c6").into();
            let token_value = 3_000_000_000_000u128;
            let assets = vec![
                EthereumAsset::NativeTokenERC20 {
                    token_id: native_token_id,
                    value: token_value,
                },
                EthereumAsset::ForeignTokenERC20 {
                    token_id: foreign_token_id,
                    value: token_value,
                },
            ];
            let instructions = vec![DepositAsset {
                assets: Wild(AllCounted(1).into()),
                beneficiary: beneficiary.clone(),
            }];
            let xcm: Xcm<()> = instructions.into();
            let versioned_xcm = VersionedXcm::V5(xcm);
            let claimer_location = Location::new(
                0,
                AccountId32 {
                    network: None,
                    id: H256::random().into(),
                },
            );
            let claimer: Option<Vec<u8>> = Some(claimer_location.clone().encode());
            let value = 6_000_000_000_000u128;
            let execution_fee = 1_000_000_000_000u128;
            let relayer_fee = 5_000_000_000_000u128;

            let message = Message {
                gateway: H160::zero(),
                nonce: 0,
                origin,
                assets,
                xcm: Payload::Raw(versioned_xcm.encode()),
                claimer,
                value,
                execution_fee,
                relayer_fee,
            };

            let result = Converter::convert(message);

            assert_ok!(result.clone());

            let xcm = result.unwrap();

            // Convert to vec for easier inspection
            let instructions: Vec<_> = xcm.into_iter().collect();

            // Check last instruction is a SetTopic (automatically added)
            let last_instruction = instructions
                .last()
                .expect("should have at least one instruction");
            assert!(
                matches!(last_instruction, SetTopic(_)),
                "Last instruction should be SetTopic"
            );

            let mut asset_claimer_found = false;
            let mut pay_fees_found = false;
            let mut descend_origin_found = 0;
            let mut reserve_deposited_found = 0;
            let mut withdraw_assets_found = 0;
            let mut deposit_asset_found = 0;

            for instruction in &instructions {
                if let SetHints { ref hints } = instruction {
                    if let Some(AssetClaimer { ref location }) = hints.clone().into_iter().next() {
                        assert_eq!(claimer_location, location.clone());
                        asset_claimer_found = true;
                    }
                }
                if let DescendOrigin(ref location) = instruction {
                    descend_origin_found += 1;
                    // The second DescendOrigin should be the message.origin (sender)
                    if descend_origin_found == 2 {
                        let junctions: Junctions = AccountKey20 {
                            key: origin.into(),
                            network: None,
                        }
                        .into();
                        assert_eq!(junctions, location.clone());
                    }
                }
                if let PayFees { ref asset } = instruction {
                    let fee_asset = Location::new(2, [GlobalConsensus(EthereumNetwork::get())]);
                    assert_eq!(asset.id, AssetId(fee_asset));
                    assert_eq!(asset.fun, Fungible(execution_fee));
                    pay_fees_found = true;
                }
                if let ReserveAssetDeposited(ref reserve_assets) = instruction {
                    reserve_deposited_found += 1;
                    if reserve_deposited_found == 1 {
                        let fee_asset = Location::new(2, [GlobalConsensus(EthereumNetwork::get())]);
                        let fee: Asset = (fee_asset, execution_fee).into();
                        let fee_assets: Assets = fee.into();
                        assert_eq!(fee_assets, reserve_assets.clone());
                    }
                    if reserve_deposited_found == 2 {
                        let token_asset = Location::new(
                            2,
                            [
                                GlobalConsensus(EthereumNetwork::get()),
                                AccountKey20 {
                                    network: None,
                                    key: native_token_id.into(),
                                },
                            ],
                        );
                        let token: Asset = (token_asset, token_value).into();

                        let remaining_ether_asset: Asset = (
                            Location::new(2, [GlobalConsensus(EthereumNetwork::get())]),
                            value,
                        )
                            .into();

                        let expected_assets: Assets = vec![token, remaining_ether_asset].into();
                        assert_eq!(expected_assets, reserve_assets.clone());
                    }
                }
                if let WithdrawAsset(ref withdraw_assets) = instruction {
                    withdraw_assets_found += 1;
                    let token_asset = Location::new(2, Here);
                    let token: Asset = (token_asset, token_value).into();
                    let token_assets: Assets = token.into();
                    assert_eq!(token_assets, withdraw_assets.clone());
                }
                if let DepositAsset {
                    ref assets,
                    beneficiary: deposit_beneficiary,
                } = instruction
                {
                    deposit_asset_found += 1;
                    if deposit_asset_found == 1 {
                        assert_eq!(
                            AssetFilter::from(Wild(AllCounted(1).into())),
                            assets.clone()
                        );
                        assert_eq!(*deposit_beneficiary, beneficiary);
                    }
                }
            }

            // SetAssetClaimer must be in the message.
            assert!(asset_claimer_found);
            // PayFees must be in the message.
            assert!(pay_fees_found);
            // The first DescendOrigin to descend into the InboundV2 pallet index and the
            // DescendOrigin into the message.origin
            assert!(descend_origin_found == 2);
            // Expecting two ReserveAssetDeposited instructions, one for the fee and one for the
            // token being transferred.
            assert!(reserve_deposited_found == 2);
            // Expecting one WithdrawAsset for the foreign ERC-20
            assert!(withdraw_assets_found == 1);
            // Deposit asset added by user
            assert!(deposit_asset_found == 1);
        });
    }

    #[test]
    fn test_message_with_gateway_origin_does_not_descend_origin_into_sender() {
        let origin: H160 = GatewayAddress::get();
        let native_token_id: H160 = hex!("5615deb798bb3e4dfa0139dfa1b3d433cc23b72f").into();
        let foreign_token_id: H256 =
            hex!("37a6c666da38711a963d938eafdd09314fd3f95a96a3baffb55f26560f4ecdd8").into();
        let beneficiary =
            hex!("908783d8cd24c9e02cee1d26ab9c46d458621ad0150b626c536a40b9df3f09c6").into();
        let message_id: H256 =
            hex!("8b69c7e376e28114618e829a7ec768dbda28357d359ba417a3bd79b11215059d").into();
        let token_value = 3_000_000_000_000u128;
        let assets = vec![
            EthereumAsset::NativeTokenERC20 {
                token_id: native_token_id,
                value: token_value,
            },
            EthereumAsset::ForeignTokenERC20 {
                token_id: foreign_token_id,
                value: token_value,
            },
        ];
        let instructions = vec![
            DepositAsset {
                assets: Wild(AllCounted(1).into()),
                beneficiary,
            },
            SetTopic(message_id.into()),
        ];
        let xcm: Xcm<()> = instructions.into();
        let versioned_xcm = VersionedXcm::V5(xcm);
        let claimer_account = AccountId32 {
            network: None,
            id: H256::random().into(),
        };
        let claimer: Option<Vec<u8>> = Some(claimer_account.clone().encode());
        let value = 6_000_000_000_000u128;
        let execution_fee = 1_000_000_000_000u128;
        let relayer_fee = 5_000_000_000_000u128;

        let message = Message {
            gateway: H160::zero(),
            nonce: 0,
            origin,
            assets,
            xcm: Payload::Raw(versioned_xcm.encode()),
            claimer,
            value,
            execution_fee,
            relayer_fee,
        };

        let result = Converter::convert(message);

        assert_ok!(result.clone());

        let xcm = result.unwrap();

        let mut instructions = xcm.into_iter();
        let mut commands_found = 0;
        while let Some(instruction) = instructions.next() {
            if let DescendOrigin(ref _location) = instruction {
                commands_found = commands_found + 1;
            }
        }
        // There should only be 1 DescendOrigin in the message.
        assert!(commands_found == 1);
    }

    #[test]
    fn test_invalid_foreign_erc20() {
        let origin: H160 = hex!("29e3b139f4393adda86303fcdaa35f60bb7092bf").into();
        let token_id: H256 =
            hex!("37a6c666da38711a963d938eafdd09314fd3f95a96a3baffb55f26560f4ecdd8").into();
        let beneficiary =
            hex!("908783d8cd24c9e02cee1d26ab9c46d458621ad0150b626c536a40b9df3f09c6").into();
        let message_id: H256 =
            hex!("8b69c7e376e28114618e829a7ec768dbda28357d359ba417a3bd79b11215059d").into();
        let token_value = 3_000_000_000_000u128;
        let assets = vec![EthereumAsset::ForeignTokenERC20 {
            token_id,
            value: token_value,
        }];
        let instructions = vec![
            DepositAsset {
                assets: Wild(AllCounted(1).into()),
                beneficiary,
            },
            SetTopic(message_id.into()),
        ];
        let xcm: Xcm<()> = instructions.into();
        let versioned_xcm = VersionedXcm::V5(xcm);
        let claimer_account = AccountId32 {
            network: None,
            id: H256::random().into(),
        };
        let claimer: Option<Vec<u8>> = Some(claimer_account.clone().encode());
        let value = 0;
        let execution_fee = 1_000_000_000_000u128;
        let relayer_fee = 5_000_000_000_000u128;

        let message = Message {
            gateway: H160::zero(),
            nonce: 0,
            origin,
            assets,
            xcm: Payload::Raw(versioned_xcm.encode()),
            claimer,
            value,
            execution_fee,
            relayer_fee,
        };

        assert_err!(
            ConverterFailing::convert(message),
            ConvertMessageError::InvalidAsset
        );
    }

    #[test]
    fn test_invalid_claimer() {
        sp_io::TestExternalities::default().execute_with(|| {
            let origin: H160 = hex!("29e3b139f4393adda86303fcdaa35f60bb7092bf").into();
            let token_id: H256 =
                hex!("37a6c666da38711a963d938eafdd09314fd3f95a96a3baffb55f26560f4ecdd8").into();
            let beneficiary =
                hex!("908783d8cd24c9e02cee1d26ab9c46d458621ad0150b626c536a40b9df3f09c6").into();
            let token_value = 3_000_000_000_000u128;
            let assets = vec![EthereumAsset::ForeignTokenERC20 {
                token_id,
                value: token_value,
            }];
            let instructions = vec![DepositAsset {
                assets: Wild(AllCounted(1).into()),
                beneficiary,
            }];
            let xcm: Xcm<()> = instructions.into();
            let versioned_xcm = VersionedXcm::V5(xcm);
            // Invalid claimer location, cannot be decoded into a Location
            let claimer: Option<Vec<u8>> = Some(vec![]);
            let value = 6_000_000_000_000u128;
            let execution_fee = 1_000_000_000_000u128;
            let relayer_fee = 5_000_000_000_000u128;

            let message = Message {
                gateway: H160::zero(),
                nonce: 0,
                origin,
                assets,
                xcm: Payload::Raw(versioned_xcm.encode()),
                claimer,
                value,
                execution_fee,
                relayer_fee,
            };

            let result = Converter::convert(message.clone());

            // Invalid claimer does not break the message conversion
            assert_ok!(result.clone());

            let xcm = result.unwrap();
            let instructions: Vec<_> = xcm.into_iter().collect();

            // Check last instruction is a SetTopic (automatically added)
            let last_instruction = instructions
                .last()
                .expect("should have at least one instruction");
            assert!(
                matches!(last_instruction, SetTopic(_)),
                "Last instruction should be SetTopic"
            );

            let mut actual_claimer: Option<Location> = None;
            for instruction in &instructions {
                if let SetHints { ref hints } = instruction {
                    if let Some(AssetClaimer { location }) = hints.clone().into_iter().next() {
                        actual_claimer = Some(location);
                        break;
                    }
                }
            }

            // actual claimer should default to Snowbridge sovereign account
            let chain_id = match EthereumNetwork::get() {
                NetworkId::Ethereum { chain_id } => chain_id,
                _ => 0,
            };
            let bridge_owner = EthereumLocationsConverterFor::<[u8; 32]>::from_chain_id(&chain_id);
            assert_eq!(
                actual_claimer,
                Some(Location::new(
                    0,
                    [AccountId32 {
                        network: None,
                        id: bridge_owner
                    }]
                ))
            );
        });
    }

    #[test]
    fn test_invalid_xcm() {
        sp_io::TestExternalities::default().execute_with(|| {
            let origin: H160 = hex!("29e3b139f4393adda86303fcdaa35f60bb7092bf").into();
            let token_id: H256 =
                hex!("37a6c666da38711a963d938eafdd09314fd3f95a96a3baffb55f26560f4ecdd8").into();
            let token_value = 3_000_000_000_000u128;
            let assets = vec![EthereumAsset::ForeignTokenERC20 {
                token_id,
                value: token_value,
            }];
            // invalid xcm
            let versioned_xcm = hex!("8b69c7e376e28114618e829a7ec7").to_vec();
            let claimer_account = AccountId32 {
                network: None,
                id: H256::random().into(),
            };
            let claimer: Option<Vec<u8>> = Some(claimer_account.clone().encode());
            let value = 6_000_000_000_000u128;
            let execution_fee = 1_000_000_000_000u128;
            let relayer_fee = 5_000_000_000_000u128;

            let message = Message {
                gateway: H160::zero(),
                nonce: 0,
                origin,
                assets,
                xcm: Payload::Raw(versioned_xcm),
                claimer: Some(claimer.encode()),
                value,
                execution_fee,
                relayer_fee,
            };

            let result = Converter::convert(message);

            // Invalid xcm does not break the message, allowing funds to be trapped on AH.
            assert_ok!(result.clone());
        });
    }

    #[test]
    fn message_with_set_topic_respects_user_topic() {
        sp_io::TestExternalities::default().execute_with(|| {
            let origin: H160 = hex!("29e3b139f4393adda86303fcdaa35f60bb7092bf").into();

            // Create a custom topic ID that the user specifies
            let user_topic: [u8; 32] =
                hex!("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");

            // User's XCM with a SetTopic as the last instruction
            let instructions = vec![RefundSurplus, SetTopic(user_topic)];
            let xcm: Xcm<()> = instructions.into();
            let versioned_xcm = VersionedXcm::V5(xcm);

            let execution_fee = 1_000_000_000_000u128;
            let value = 0;

            let message = Message {
                gateway: H160::zero(),
                nonce: 0,
                origin,
                assets: vec![],
                xcm: Payload::Raw(versioned_xcm.encode()),
                claimer: None,
                value,
                execution_fee,
                relayer_fee: 0,
            };

            let result = Converter::convert(message);
            assert_ok!(result.clone());

            let xcm = result.unwrap();
            let instructions: Vec<_> = xcm.into_iter().collect();

            // The last instruction should be the user's SetTopic
            let last_instruction = instructions
                .last()
                .expect("should have at least one instruction");
            if let SetTopic(ref topic) = last_instruction {
                assert_eq!(*topic, user_topic);
            } else {
                panic!("Last instruction should be SetTopic");
            }
        });
    }

    #[test]
    fn message_with_generates_a_unique_topic_if_no_topic_is_present() {
        sp_io::TestExternalities::default().execute_with(|| {
            let origin: H160 = hex!("29e3b139f4393adda86303fcdaa35f60bb7092bf").into();

            let execution_fee = 1_000_000_000_000u128;
            let value = 0;

            let message = Message {
                gateway: H160::zero(),
                nonce: 0,
                origin,
                assets: vec![],
                xcm: Payload::Raw(vec![]),
                claimer: None,
                value,
                execution_fee,
                relayer_fee: 0,
            };

            let result = Converter::convert(message);
            assert_ok!(result.clone());

            let xcm = result.unwrap();
            let instructions: Vec<_> = xcm.into_iter().collect();

            // The last instruction should be a SetTopic
            let last_instruction = instructions
                .last()
                .expect("should have at least one instruction");
            assert!(matches!(last_instruction, SetTopic(_)));
        });
    }

    #[test]
    fn message_with_user_topic_not_last_instruction_gets_appended() {
        sp_io::TestExternalities::default().execute_with(|| {
            let origin: H160 = hex!("29e3b139f4393adda86303fcdaa35f60bb7092bf").into();

            let execution_fee = 1_000_000_000_000u128;
            let value = 0;

            let user_topic: [u8; 32] =
                hex!("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");

            // Add a set topic, but not as the last instruction.
            let instructions = vec![SetTopic(user_topic), RefundSurplus];
            let xcm: Xcm<()> = instructions.into();
            let versioned_xcm = VersionedXcm::V5(xcm);

            let message = Message {
                gateway: H160::zero(),
                nonce: 0,
                origin,
                assets: vec![],
                xcm: Payload::Raw(versioned_xcm.encode()),
                claimer: None,
                value,
                execution_fee,
                relayer_fee: 0,
            };

            let result = Converter::convert(message);
            assert_ok!(result.clone());

            let xcm = result.unwrap();
            let instructions: Vec<_> = xcm.into_iter().collect();

            // Get the last instruction - should still be a SetTopic, but might not have the
            // original topic since for non-last-instruction topics, the filter_topic function
            // extracts it during prepare() and then the original value is later lost when we
            // append a new one
            let last_instruction = instructions
                .last()
                .expect("should have at least one instruction");

            // Check if the last instruction is a SetTopic (content isn't important)
            assert!(
                matches!(last_instruction, SetTopic(_)),
                "Last instruction should be SetTopic"
            );
        });
    }
}

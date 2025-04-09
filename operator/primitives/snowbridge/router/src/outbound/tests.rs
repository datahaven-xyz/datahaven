use frame_support::parameter_types;
use hex_literal::hex;
use snowbridge_core::{
    outbound::{Fee, SendError, SendMessageFeeProvider},
    AgentIdOf,
};
use sp_std::default::Default;
use xcm::{
    latest::{ROCOCO_GENESIS_HASH, WESTEND_GENESIS_HASH},
    prelude::SendError as XcmSendError,
};

use super::*;

parameter_types! {
    const MaxMessageSize: u32 = u32::MAX;
    const RelayNetwork: NetworkId = Polkadot;
    UniversalLocation: InteriorLocation = [GlobalConsensus(RelayNetwork::get()), Parachain(1013)].into();
    const BridgedNetwork: NetworkId =  Ethereum{ chain_id: 1 };
    const NonBridgedNetwork: NetworkId =  Ethereum{ chain_id: 2 };
}

struct MockOkOutboundQueue;
impl SendMessage for MockOkOutboundQueue {
    type Ticket = ();

    fn validate(_: &Message) -> Result<(Self::Ticket, Fee<Self::Balance>), SendError> {
        Ok((
            (),
            Fee {
                local: 1,
                remote: 1,
            },
        ))
    }

    fn deliver(_: Self::Ticket) -> Result<H256, SendError> {
        Ok(H256::zero())
    }
}

impl SendMessageFeeProvider for MockOkOutboundQueue {
    type Balance = u128;

    fn local_fee() -> Self::Balance {
        1
    }
}
struct MockErrOutboundQueue;
impl SendMessage for MockErrOutboundQueue {
    type Ticket = ();

    fn validate(_: &Message) -> Result<(Self::Ticket, Fee<Self::Balance>), SendError> {
        Err(SendError::MessageTooLarge)
    }

    fn deliver(_: Self::Ticket) -> Result<H256, SendError> {
        Err(SendError::MessageTooLarge)
    }
}

impl SendMessageFeeProvider for MockErrOutboundQueue {
    type Balance = u128;

    fn local_fee() -> Self::Balance {
        1
    }
}

pub struct MockTokenIdConvert;
impl MaybeEquivalence<TokenId, Location> for MockTokenIdConvert {
    fn convert(_id: &TokenId) -> Option<Location> {
        Some(Location::new(
            1,
            [GlobalConsensus(ByGenesis(WESTEND_GENESIS_HASH))],
        ))
    }
    fn convert_back(_loc: &Location) -> Option<TokenId> {
        None
    }
}

#[test]
fn exporter_validate_with_unknown_network_yields_not_applicable() {
    let network = Ethereum { chain_id: 1337 };
    let channel: u32 = 0;
    let mut universal_source: Option<InteriorLocation> = None;
    let mut destination: Option<InteriorLocation> = None;
    let mut message: Option<Xcm<()>> = None;

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );
    assert_eq!(result, Err(XcmSendError::NotApplicable));
}

#[test]
fn exporter_validate_with_invalid_destination_yields_missing_argument() {
    let network = BridgedNetwork::get();
    let channel: u32 = 0;
    let mut universal_source: Option<InteriorLocation> = None;
    let mut destination: Option<InteriorLocation> = None;
    let mut message: Option<Xcm<()>> = None;

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );
    assert_eq!(result, Err(XcmSendError::MissingArgument));
}

#[test]
fn exporter_validate_with_x8_destination_yields_not_applicable() {
    let network = BridgedNetwork::get();
    let channel: u32 = 0;
    let mut universal_source: Option<InteriorLocation> = None;
    let mut destination: Option<InteriorLocation> = Some(
        [
            OnlyChild, OnlyChild, OnlyChild, OnlyChild, OnlyChild, OnlyChild, OnlyChild, OnlyChild,
        ]
        .into(),
    );
    let mut message: Option<Xcm<()>> = None;

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );
    assert_eq!(result, Err(XcmSendError::NotApplicable));
}

#[test]
fn exporter_validate_without_universal_source_yields_missing_argument() {
    let network = BridgedNetwork::get();
    let channel: u32 = 0;
    let mut universal_source: Option<InteriorLocation> = None;
    let mut destination: Option<InteriorLocation> = Here.into();
    let mut message: Option<Xcm<()>> = None;

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );
    assert_eq!(result, Err(XcmSendError::MissingArgument));
}

#[test]
fn exporter_validate_without_global_universal_location_yields_not_applicable() {
    let network = BridgedNetwork::get();
    let channel: u32 = 0;
    let mut universal_source: Option<InteriorLocation> = Here.into();
    let mut destination: Option<InteriorLocation> = Here.into();
    let mut message: Option<Xcm<()>> = None;

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );
    assert_eq!(result, Err(XcmSendError::NotApplicable));
}

#[test]
fn exporter_validate_without_global_bridge_location_yields_not_applicable() {
    let network = NonBridgedNetwork::get();
    let channel: u32 = 0;
    let mut universal_source: Option<InteriorLocation> = Here.into();
    let mut destination: Option<InteriorLocation> = Here.into();
    let mut message: Option<Xcm<()>> = None;

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );
    assert_eq!(result, Err(XcmSendError::NotApplicable));
}

#[test]
fn exporter_validate_with_remote_universal_source_yields_not_applicable() {
    let network = BridgedNetwork::get();
    let channel: u32 = 0;
    let mut universal_source: Option<InteriorLocation> =
        Some([GlobalConsensus(Kusama), Parachain(1000)].into());
    let mut destination: Option<InteriorLocation> = Here.into();
    let mut message: Option<Xcm<()>> = None;

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );
    assert_eq!(result, Err(XcmSendError::NotApplicable));
}

#[test]
fn exporter_validate_without_para_id_in_source_yields_not_applicable() {
    let network = BridgedNetwork::get();
    let channel: u32 = 0;
    let mut universal_source: Option<InteriorLocation> = Some(GlobalConsensus(Polkadot).into());
    let mut destination: Option<InteriorLocation> = Here.into();
    let mut message: Option<Xcm<()>> = None;

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );
    assert_eq!(result, Err(XcmSendError::NotApplicable));
}

#[test]
fn exporter_validate_complex_para_id_in_source_yields_not_applicable() {
    let network = BridgedNetwork::get();
    let channel: u32 = 0;
    let mut universal_source: Option<InteriorLocation> = Some(
        [
            GlobalConsensus(Polkadot),
            Parachain(1000),
            PalletInstance(12),
        ]
        .into(),
    );
    let mut destination: Option<InteriorLocation> = Here.into();
    let mut message: Option<Xcm<()>> = None;

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );
    assert_eq!(result, Err(XcmSendError::NotApplicable));
}

#[test]
fn exporter_validate_without_xcm_message_yields_missing_argument() {
    let network = BridgedNetwork::get();
    let channel: u32 = 0;
    let mut universal_source: Option<InteriorLocation> =
        Some([GlobalConsensus(Polkadot), Parachain(1000)].into());
    let mut destination: Option<InteriorLocation> = Here.into();
    let mut message: Option<Xcm<()>> = None;

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );
    assert_eq!(result, Err(XcmSendError::MissingArgument));
}

#[test]
fn exporter_validate_with_max_target_fee_yields_unroutable() {
    let network = BridgedNetwork::get();
    let mut destination: Option<InteriorLocation> = Here.into();

    let mut universal_source: Option<InteriorLocation> =
        Some([GlobalConsensus(Polkadot), Parachain(1000)].into());

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let channel: u32 = 0;
    let fee = Asset {
        id: AssetId(Here.into()),
        fun: Fungible(1000),
    };
    let fees: Assets = vec![fee.clone()].into();
    let assets: Assets = vec![Asset {
        id: AssetId(
            AccountKey20 {
                network: None,
                key: token_address,
            }
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = assets.clone().into();

    let mut message: Option<Xcm<()>> = Some(
        vec![
            WithdrawAsset(fees),
            BuyExecution {
                fees: fee,
                weight_limit: Unlimited,
            },
            WithdrawAsset(assets),
            DepositAsset {
                assets: filter,
                beneficiary: AccountKey20 {
                    network: Some(network),
                    key: beneficiary_address,
                }
                .into(),
            },
            SetTopic([0; 32]),
        ]
        .into(),
    );

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );

    assert_eq!(result, Err(XcmSendError::Unroutable));
}

#[test]
fn exporter_validate_with_unparsable_xcm_yields_unroutable() {
    let network = BridgedNetwork::get();
    let mut destination: Option<InteriorLocation> = Here.into();

    let mut universal_source: Option<InteriorLocation> =
        Some([GlobalConsensus(Polkadot), Parachain(1000)].into());

    let channel: u32 = 0;
    let fee = Asset {
        id: AssetId(Here.into()),
        fun: Fungible(1000),
    };
    let fees: Assets = vec![fee.clone()].into();

    let mut message: Option<Xcm<()>> = Some(
        vec![
            WithdrawAsset(fees),
            BuyExecution {
                fees: fee,
                weight_limit: Unlimited,
            },
        ]
        .into(),
    );

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );

    assert_eq!(result, Err(XcmSendError::Unroutable));
}

#[test]
fn exporter_validate_xcm_success_case_1() {
    let network = BridgedNetwork::get();
    let mut destination: Option<InteriorLocation> = Here.into();

    let mut universal_source: Option<InteriorLocation> =
        Some([GlobalConsensus(Polkadot), Parachain(1000)].into());

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let channel: u32 = 0;
    let assets: Assets = vec![Asset {
        id: AssetId(
            [AccountKey20 {
                network: None,
                key: token_address,
            }]
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let fee = assets.clone().get(0).unwrap().clone();
    let filter: AssetFilter = assets.clone().into();

    let mut message: Option<Xcm<()>> = Some(
        vec![
            WithdrawAsset(assets.clone()),
            ClearOrigin,
            BuyExecution {
                fees: fee,
                weight_limit: Unlimited,
            },
            DepositAsset {
                assets: filter,
                beneficiary: AccountKey20 {
                    network: None,
                    key: beneficiary_address,
                }
                .into(),
            },
            SetTopic([0; 32]),
        ]
        .into(),
    );

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source,
        &mut destination,
        &mut message,
    );

    assert!(result.is_ok());
}

#[test]
fn exporter_deliver_with_submit_failure_yields_unroutable() {
    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockErrOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::deliver((hex!("deadbeef").to_vec(), XcmHash::default()));
    assert_eq!(
        result,
        Err(XcmSendError::Transport("other transport error"))
    )
}

#[test]
fn xcm_converter_convert_success() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            [AccountKey20 {
                network: None,
                key: token_address,
            }]
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = assets.clone().into();

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());
    let expected_payload = Command::AgentExecute {
        agent_id: Default::default(),
        command: AgentExecuteCommand::TransferToken {
            token: token_address.into(),
            recipient: beneficiary_address.into(),
            amount: 1000,
        },
    };
    let result = converter.convert();
    assert_eq!(result, Ok((expected_payload, [0; 32])));
}

#[test]
fn xcm_converter_convert_without_buy_execution_yields_success() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            [AccountKey20 {
                network: None,
                key: token_address,
            }]
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = assets.clone().into();

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());
    let expected_payload = Command::AgentExecute {
        agent_id: Default::default(),
        command: AgentExecuteCommand::TransferToken {
            token: token_address.into(),
            recipient: beneficiary_address.into(),
            amount: 1000,
        },
    };
    let result = converter.convert();
    assert_eq!(result, Ok((expected_payload, [0; 32])));
}

#[test]
fn xcm_converter_convert_with_wildcard_all_asset_filter_succeeds() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            [AccountKey20 {
                network: None,
                key: token_address,
            }]
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = Wild(All);

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());
    let expected_payload = Command::AgentExecute {
        agent_id: Default::default(),
        command: AgentExecuteCommand::TransferToken {
            token: token_address.into(),
            recipient: beneficiary_address.into(),
            amount: 1000,
        },
    };
    let result = converter.convert();
    assert_eq!(result, Ok((expected_payload, [0; 32])));
}

#[test]
fn xcm_converter_convert_with_fees_less_than_reserve_yields_success() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let asset_location: Location = [AccountKey20 {
        network: None,
        key: token_address,
    }]
    .into();
    let fee_asset = Asset {
        id: AssetId(asset_location.clone()),
        fun: Fungible(500),
    };

    let assets: Assets = vec![Asset {
        id: AssetId(asset_location),
        fun: Fungible(1000),
    }]
    .into();

    let filter: AssetFilter = assets.clone().into();

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: fee_asset,
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());
    let expected_payload = Command::AgentExecute {
        agent_id: Default::default(),
        command: AgentExecuteCommand::TransferToken {
            token: token_address.into(),
            recipient: beneficiary_address.into(),
            amount: 1000,
        },
    };
    let result = converter.convert();
    assert_eq!(result, Ok((expected_payload, [0; 32])));
}

#[test]
fn xcm_converter_convert_without_set_topic_yields_set_topic_expected() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            [AccountKey20 {
                network: None,
                key: token_address,
            }]
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = assets.clone().into();

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        ClearTopic,
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());
    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::SetTopicExpected));
}

#[test]
fn xcm_converter_convert_with_partial_message_yields_unexpected_end_of_xcm() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let assets: Assets = vec![Asset {
        id: AssetId(
            [AccountKey20 {
                network: None,
                key: token_address,
            }]
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let message: Xcm<()> = vec![WithdrawAsset(assets)].into();

    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());
    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::UnexpectedEndOfXcm));
}

#[test]
fn xcm_converter_with_different_fee_asset_fails() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let asset_location = [AccountKey20 {
        network: None,
        key: token_address,
    }]
    .into();
    let fee_asset = Asset {
        id: AssetId(Location {
            parents: 0,
            interior: Here,
        }),
        fun: Fungible(1000),
    };

    let assets: Assets = vec![Asset {
        id: AssetId(asset_location),
        fun: Fungible(1000),
    }]
    .into();

    let filter: AssetFilter = assets.clone().into();

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: fee_asset,
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());
    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::InvalidFeeAsset));
}

#[test]
fn xcm_converter_with_fees_greater_than_reserve_fails() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let asset_location: Location = [AccountKey20 {
        network: None,
        key: token_address,
    }]
    .into();
    let fee_asset = Asset {
        id: AssetId(asset_location.clone()),
        fun: Fungible(1001),
    };

    let assets: Assets = vec![Asset {
        id: AssetId(asset_location),
        fun: Fungible(1000),
    }]
    .into();

    let filter: AssetFilter = assets.clone().into();

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: fee_asset,
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());
    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::InvalidFeeAsset));
}

#[test]
fn xcm_converter_convert_with_empty_xcm_yields_unexpected_end_of_xcm() {
    let network = BridgedNetwork::get();

    let message: Xcm<()> = vec![].into();

    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::UnexpectedEndOfXcm));
}

#[test]
fn xcm_converter_convert_with_extra_instructions_yields_end_of_xcm_message_expected() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            [AccountKey20 {
                network: None,
                key: token_address,
            }]
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = assets.clone().into();

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
        ClearError,
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(
        result.err(),
        Some(XcmConverterError::EndOfXcmMessageExpected)
    );
}

#[test]
fn xcm_converter_convert_without_withdraw_asset_yields_withdraw_expected() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            [AccountKey20 {
                network: None,
                key: token_address,
            }]
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = assets.clone().into();

    let message: Xcm<()> = vec![
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::UnexpectedInstruction));
}

#[test]
fn xcm_converter_convert_without_withdraw_asset_yields_deposit_expected() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            AccountKey20 {
                network: None,
                key: token_address,
            }
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::DepositAssetExpected));
}

#[test]
fn xcm_converter_convert_without_assets_yields_no_reserve_assets() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");

    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![].into();
    let filter: AssetFilter = assets.clone().into();

    let fee = Asset {
        id: AssetId(
            AccountKey20 {
                network: None,
                key: token_address,
            }
            .into(),
        ),
        fun: Fungible(1000),
    };

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: fee,
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::NoReserveAssets));
}

#[test]
fn xcm_converter_convert_with_two_assets_yields_too_many_assets() {
    let network = BridgedNetwork::get();

    let token_address_1: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let token_address_2: [u8; 20] = hex!("1100000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![
        Asset {
            id: AssetId(
                AccountKey20 {
                    network: None,
                    key: token_address_1,
                }
                .into(),
            ),
            fun: Fungible(1000),
        },
        Asset {
            id: AssetId(
                AccountKey20 {
                    network: None,
                    key: token_address_2,
                }
                .into(),
            ),
            fun: Fungible(500),
        },
    ]
    .into();
    let filter: AssetFilter = assets.clone().into();

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::TooManyAssets));
}

#[test]
fn xcm_converter_convert_without_consuming_filter_yields_filter_does_not_consume_all_assets() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            AccountKey20 {
                network: None,
                key: token_address,
            }
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = Wild(WildAsset::AllCounted(0));

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(
        result.err(),
        Some(XcmConverterError::FilterDoesNotConsumeAllAssets)
    );
}

#[test]
fn xcm_converter_convert_with_zero_amount_asset_yields_zero_asset_transfer() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            AccountKey20 {
                network: None,
                key: token_address,
            }
            .into(),
        ),
        fun: Fungible(0),
    }]
    .into();
    let filter: AssetFilter = Wild(WildAsset::AllCounted(1));

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::ZeroAssetTransfer));
}

#[test]
fn xcm_converter_convert_non_ethereum_asset_yields_asset_resolution_failed() {
    let network = BridgedNetwork::get();

    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId([GlobalConsensus(Polkadot), Parachain(1000), GeneralIndex(0)].into()),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = Wild(WildAsset::AllCounted(1));

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::AssetResolutionFailed));
}

#[test]
fn xcm_converter_convert_non_ethereum_chain_asset_yields_asset_resolution_failed() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            AccountKey20 {
                network: Some(Ethereum { chain_id: 2 }),
                key: token_address,
            }
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = Wild(WildAsset::AllCounted(1));

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::AssetResolutionFailed));
}

#[test]
fn xcm_converter_convert_non_ethereum_chain_yields_asset_resolution_failed() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            [AccountKey20 {
                network: Some(NonBridgedNetwork::get()),
                key: token_address,
            }]
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = Wild(WildAsset::AllCounted(1));

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::AssetResolutionFailed));
}

#[test]
fn xcm_converter_convert_with_non_ethereum_beneficiary_yields_beneficiary_resolution_failed() {
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");

    let beneficiary_address: [u8; 32] =
        hex!("2000000000000000000000000000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            AccountKey20 {
                network: None,
                key: token_address,
            }
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = Wild(WildAsset::AllCounted(1));
    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: [
                GlobalConsensus(Polkadot),
                Parachain(1000),
                AccountId32 {
                    network: Some(Polkadot),
                    id: beneficiary_address,
                },
            ]
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(
        result.err(),
        Some(XcmConverterError::BeneficiaryResolutionFailed)
    );
}

#[test]
fn xcm_converter_convert_with_non_ethereum_chain_beneficiary_yields_beneficiary_resolution_failed()
{
    let network = BridgedNetwork::get();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let assets: Assets = vec![Asset {
        id: AssetId(
            AccountKey20 {
                network: None,
                key: token_address,
            }
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let filter: AssetFilter = Wild(WildAsset::AllCounted(1));

    let message: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: Some(Ethereum { chain_id: 2 }),
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());

    let result = converter.convert();
    assert_eq!(
        result.err(),
        Some(XcmConverterError::BeneficiaryResolutionFailed)
    );
}

#[test]
fn test_describe_asset_hub() {
    let legacy_location: Location = Location::new(0, [Parachain(1000)]);
    let legacy_agent_id = AgentIdOf::convert_location(&legacy_location).unwrap();
    assert_eq!(
        legacy_agent_id,
        hex!("72456f48efed08af20e5b317abf8648ac66e86bb90a411d9b0b713f7364b75b4").into()
    );
    let location: Location = Location::new(1, [Parachain(1000)]);
    let agent_id = AgentIdOf::convert_location(&location).unwrap();
    assert_eq!(
        agent_id,
        hex!("81c5ab2571199e3188135178f3c2c8e2d268be1313d029b30f534fa579b69b79").into()
    )
}

#[test]
fn test_describe_here() {
    let location: Location = Location::new(0, []);
    let agent_id = AgentIdOf::convert_location(&location).unwrap();
    assert_eq!(
        agent_id,
        hex!("03170a2e7597b7b7e3d84c05391d139a62b157e78786d8c082f29dcf4c111314").into()
    )
}

#[test]
fn xcm_converter_transfer_native_token_success() {
    let network = BridgedNetwork::get();

    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let amount = 1000000;
    let asset_location = Location::new(1, [GlobalConsensus(ByGenesis(WESTEND_GENESIS_HASH))]);
    let token_id = TokenIdOf::convert_location(&asset_location).unwrap();

    let assets: Assets = vec![Asset {
        id: AssetId(asset_location),
        fun: Fungible(amount),
    }]
    .into();
    let filter: AssetFilter = assets.clone().into();

    let message: Xcm<()> = vec![
        ReserveAssetDeposited(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());
    let expected_payload = Command::MintForeignToken {
        recipient: beneficiary_address.into(),
        amount,
        token_id,
    };
    let result = converter.convert();
    assert_eq!(result, Ok((expected_payload, [0; 32])));
}

#[test]
fn xcm_converter_transfer_native_token_with_invalid_location_will_fail() {
    let network = BridgedNetwork::get();

    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let amount = 1000000;
    // Invalid asset location from a different consensus
    let asset_location = Location {
        parents: 2,
        interior: [GlobalConsensus(ByGenesis(ROCOCO_GENESIS_HASH))].into(),
    };

    let assets: Assets = vec![Asset {
        id: AssetId(asset_location),
        fun: Fungible(amount),
    }]
    .into();
    let filter: AssetFilter = assets.clone().into();

    let message: Xcm<()> = vec![
        ReserveAssetDeposited(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: assets.get(0).unwrap().clone(),
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut converter =
        XcmConverter::<MockTokenIdConvert, ()>::new(&message, network, Default::default());
    let result = converter.convert();
    assert_eq!(result.err(), Some(XcmConverterError::InvalidAsset));
}

#[test]
fn exporter_validate_with_invalid_dest_does_not_alter_destination() {
    let network = BridgedNetwork::get();
    let destination: InteriorLocation = Parachain(1000).into();

    let universal_source: InteriorLocation = [GlobalConsensus(Polkadot), Parachain(1000)].into();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let channel: u32 = 0;
    let assets: Assets = vec![Asset {
        id: AssetId(
            [AccountKey20 {
                network: None,
                key: token_address,
            }]
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let fee = assets.clone().get(0).unwrap().clone();
    let filter: AssetFilter = assets.clone().into();
    let msg: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: fee,
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut msg_wrapper: Option<Xcm<()>> = Some(msg.clone());
    let mut dest_wrapper = Some(destination.clone());
    let mut universal_source_wrapper = Some(universal_source.clone());

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source_wrapper,
        &mut dest_wrapper,
        &mut msg_wrapper,
    );

    assert_eq!(result, Err(XcmSendError::NotApplicable));

    // ensure mutable variables are not changed
    assert_eq!(Some(destination), dest_wrapper);
    assert_eq!(Some(msg), msg_wrapper);
    assert_eq!(Some(universal_source), universal_source_wrapper);
}

#[test]
fn exporter_validate_with_invalid_universal_source_does_not_alter_universal_source() {
    let network = BridgedNetwork::get();
    let destination: InteriorLocation = Here.into();

    let universal_source: InteriorLocation = [
        GlobalConsensus(ByGenesis(WESTEND_GENESIS_HASH)),
        Parachain(1000),
    ]
    .into();

    let token_address: [u8; 20] = hex!("1000000000000000000000000000000000000000");
    let beneficiary_address: [u8; 20] = hex!("2000000000000000000000000000000000000000");

    let channel: u32 = 0;
    let assets: Assets = vec![Asset {
        id: AssetId(
            [AccountKey20 {
                network: None,
                key: token_address,
            }]
            .into(),
        ),
        fun: Fungible(1000),
    }]
    .into();
    let fee = assets.clone().get(0).unwrap().clone();
    let filter: AssetFilter = assets.clone().into();
    let msg: Xcm<()> = vec![
        WithdrawAsset(assets.clone()),
        ClearOrigin,
        BuyExecution {
            fees: fee,
            weight_limit: Unlimited,
        },
        DepositAsset {
            assets: filter,
            beneficiary: AccountKey20 {
                network: None,
                key: beneficiary_address,
            }
            .into(),
        },
        SetTopic([0; 32]),
    ]
    .into();
    let mut msg_wrapper: Option<Xcm<()>> = Some(msg.clone());
    let mut dest_wrapper = Some(destination.clone());
    let mut universal_source_wrapper = Some(universal_source.clone());

    let result = EthereumBlobExporter::<
        UniversalLocation,
        BridgedNetwork,
        MockOkOutboundQueue,
        AgentIdOf,
        MockTokenIdConvert,
    >::validate(
        network,
        channel,
        &mut universal_source_wrapper,
        &mut dest_wrapper,
        &mut msg_wrapper,
    );

    assert_eq!(result, Err(XcmSendError::NotApplicable));

    // ensure mutable variables are not changed
    assert_eq!(Some(destination), dest_wrapper);
    assert_eq!(Some(msg), msg_wrapper);
    assert_eq!(Some(universal_source), universal_source_wrapper);
}

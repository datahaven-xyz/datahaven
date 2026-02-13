// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

extern crate alloc;

use crate::reward::RewardPaymentError::{ChargeFeesFailure, XcmSendFailure};
use core::{fmt::Debug, marker::PhantomData};
use frame_support::dispatch::GetDispatchInfo;
use scale_info::TypeInfo;
use sp_runtime::{
    codec::{Decode, Encode},
    traits::Get,
    DispatchError,
};
use xcm::{
    opaque::latest::prelude::Xcm,
    prelude::{ExecuteXcm, Junction::*, Location, SendXcm, *},
};

// Reward payment procedure.
pub trait PaymentProcedure<Relayer, Reward, RewardBalance> {
    /// Error that may be returned by the procedure.
    type Error: Debug;

    /// Type parameter used to identify the beneficiaries eligible to receive rewards.
    type Beneficiary: Clone + Debug + Decode + Encode + Eq + TypeInfo;

    /// Pay reward to the relayer (or alternative beneficiary if provided) from the account with
    /// provided params.
    fn pay_reward(
        relayer: &Relayer,
        reward: Reward,
        reward_balance: RewardBalance,
        beneficiary: Self::Beneficiary,
    ) -> Result<(), Self::Error>;
}

impl<Relayer, Reward, RewardBalance> PaymentProcedure<Relayer, Reward, RewardBalance> for () {
    type Error = &'static str;
    type Beneficiary = ();

    fn pay_reward(
        _: &Relayer,
        _: Reward,
        _: RewardBalance,
        _: Self::Beneficiary,
    ) -> Result<(), Self::Error> {
        Ok(())
    }
}

/// Error related to paying out relayer rewards.
#[derive(Debug, Encode, Decode)]
pub enum RewardPaymentError {
    /// The XCM to mint the reward on AssetHub could not be sent.
    XcmSendFailure,
    /// The delivery fee to send the XCM could not be charged.
    ChargeFeesFailure,
}

impl From<RewardPaymentError> for DispatchError {
    fn from(e: RewardPaymentError) -> DispatchError {
        match e {
            XcmSendFailure => DispatchError::Other("xcm send failure"),
            ChargeFeesFailure => DispatchError::Other("charge fees error"),
        }
    }
}

/// Reward payment procedure that sends a XCM to AssetHub to mint the reward (foreign asset)
/// into the provided beneficiary account.
pub struct PayAccountOnLocation<
    Relayer,
    RewardBalance,
    EthereumNetwork,
    AssetHubLocation,
    InboundQueueLocation,
    XcmSender,
    XcmExecutor,
    Call,
>(
    PhantomData<(
        Relayer,
        RewardBalance,
        EthereumNetwork,
        AssetHubLocation,
        InboundQueueLocation,
        XcmSender,
        XcmExecutor,
        Call,
    )>,
);

impl<
        Relayer,
        RewardBalance,
        EthereumNetwork,
        AssetHubLocation,
        InboundQueueLocation,
        XcmSender,
        XcmExecutor,
        Call,
    > PaymentProcedure<Relayer, (), RewardBalance>
    for PayAccountOnLocation<
        Relayer,
        RewardBalance,
        EthereumNetwork,
        AssetHubLocation,
        InboundQueueLocation,
        XcmSender,
        XcmExecutor,
        Call,
    >
where
    Relayer: Clone
        + Debug
        + Decode
        + Encode
        + Eq
        + TypeInfo
        + Into<sp_runtime::AccountId32>
        + Into<Location>,
    EthereumNetwork: Get<NetworkId>,
    InboundQueueLocation: Get<InteriorLocation>,
    AssetHubLocation: Get<Location>,
    XcmSender: SendXcm,
    RewardBalance: Into<u128> + Clone,
    XcmExecutor: ExecuteXcm<Call>,
    Call: Decode + GetDispatchInfo,
{
    type Error = DispatchError;
    type Beneficiary = Location;

    fn pay_reward(
        relayer: &Relayer,
        _: (),
        reward: RewardBalance,
        beneficiary: Self::Beneficiary,
    ) -> Result<(), Self::Error> {
        let ethereum_location = Location::new(2, [GlobalConsensus(EthereumNetwork::get())]);
        let assets: Asset = (ethereum_location.clone(), reward.into()).into();

        let xcm: Xcm<()> = alloc::vec![
            UnpaidExecution {
                weight_limit: Unlimited,
                check_origin: None
            },
            DescendOrigin(InboundQueueLocation::get().into()),
            UniversalOrigin(GlobalConsensus(EthereumNetwork::get())),
            ReserveAssetDeposited(assets.into()),
            DepositAsset {
                assets: AllCounted(1).into(),
                beneficiary
            },
        ]
        .into();

        let (ticket, fee) =
            validate_send::<XcmSender>(AssetHubLocation::get(), xcm).map_err(|_| XcmSendFailure)?;
        XcmExecutor::charge_fees(relayer.clone(), fee).map_err(|_| ChargeFeesFailure)?;
        XcmSender::deliver(ticket).map_err(|_| XcmSendFailure)?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use frame_support::parameter_types;
    use sp_runtime::AccountId32;

    #[derive(Clone, Debug, Decode, Encode, Eq, PartialEq, TypeInfo)]
    pub struct MockRelayer(pub AccountId32);

    impl From<MockRelayer> for AccountId32 {
        fn from(m: MockRelayer) -> Self {
            m.0
        }
    }

    impl From<MockRelayer> for Location {
        fn from(_m: MockRelayer) -> Self {
            // For simplicity, return a dummy location
            Location::new(1, Here)
        }
    }

    pub enum BridgeReward {
        Snowbridge,
    }

    parameter_types! {
        pub AssetHubLocation: Location = Location::new(1,[Parachain(1000)]);
        pub InboundQueueLocation: InteriorLocation = [PalletInstance(84)].into();
        pub EthereumNetwork: NetworkId = NetworkId::Ethereum { chain_id: 11155111 };
        pub const DefaultMyRewardKind: BridgeReward = BridgeReward::Snowbridge;
    }

    pub enum Weightless {}
    impl PreparedMessage for Weightless {
        fn weight_of(&self) -> Weight {
            unreachable!();
        }
    }

    pub struct MockXcmExecutor;
    impl<C> ExecuteXcm<C> for MockXcmExecutor {
        type Prepared = Weightless;
        fn prepare(message: Xcm<C>) -> Result<Self::Prepared, Xcm<C>> {
            Err(message)
        }
        fn execute(
            _: impl Into<Location>,
            _: Self::Prepared,
            _: &mut XcmHash,
            _: Weight,
        ) -> Outcome {
            unreachable!()
        }
        fn charge_fees(_: impl Into<Location>, _: Assets) -> xcm::latest::Result {
            Ok(())
        }
    }

    #[derive(Debug, Decode, Default)]
    pub struct MockCall;
    impl GetDispatchInfo for MockCall {
        fn get_dispatch_info(&self) -> frame_support::dispatch::DispatchInfo {
            Default::default()
        }
    }

    pub struct MockXcmSender;
    impl SendXcm for MockXcmSender {
        type Ticket = Xcm<()>;

        fn validate(
            dest: &mut Option<Location>,
            xcm: &mut Option<Xcm<()>>,
        ) -> SendResult<Self::Ticket> {
            if let Some(location) = dest {
                match location.unpack() {
                    (_, [Parachain(1001)]) => return Err(SendError::NotApplicable),
                    _ => Ok((xcm.clone().unwrap(), Assets::default())),
                }
            } else {
                Ok((xcm.clone().unwrap(), Assets::default()))
            }
        }

        fn deliver(xcm: Self::Ticket) -> core::result::Result<XcmHash, SendError> {
            let hash = xcm.using_encoded(sp_io::hashing::blake2_256);
            Ok(hash)
        }
    }

    #[test]
    fn pay_reward_success() {
        let relayer = MockRelayer(AccountId32::new([1u8; 32]));
        let beneficiary = Location::new(1, Here);
        let reward = 1_000u128;

        type TestedPayAccountOnLocation = PayAccountOnLocation<
            MockRelayer,
            u128,
            EthereumNetwork,
            AssetHubLocation,
            InboundQueueLocation,
            MockXcmSender,
            MockXcmExecutor,
            MockCall,
        >;

        let result = TestedPayAccountOnLocation::pay_reward(&relayer, (), reward, beneficiary);

        assert!(result.is_ok());
    }

    #[test]
    fn pay_reward_fails_on_xcm_validate_xcm() {
        struct FailingXcmValidator;
        impl SendXcm for FailingXcmValidator {
            type Ticket = ();

            fn validate(
                _dest: &mut Option<Location>,
                _xcm: &mut Option<Xcm<()>>,
            ) -> SendResult<Self::Ticket> {
                Err(SendError::NotApplicable)
            }

            fn deliver(xcm: Self::Ticket) -> core::result::Result<XcmHash, SendError> {
                let hash = xcm.using_encoded(sp_io::hashing::blake2_256);
                Ok(hash)
            }
        }

        type FailingSenderPayAccount = PayAccountOnLocation<
            MockRelayer,
            u128,
            EthereumNetwork,
            AssetHubLocation,
            InboundQueueLocation,
            FailingXcmValidator,
            MockXcmExecutor,
            MockCall,
        >;

        let relayer = MockRelayer(AccountId32::new([1u8; 32]));
        let reward = 1_000u128;
        let beneficiary = Location::new(1, Here);
        let result = FailingSenderPayAccount::pay_reward(&relayer, (), reward, beneficiary);

        assert!(result.is_err());
        let err_str = format!("{:?}", result.err().unwrap());
        assert!(
            err_str.contains("xcm send failure"),
            "Expected xcm send failure error, got {:?}",
            err_str
        );
    }

    #[test]
    fn pay_reward_fails_on_charge_fees() {
        struct FailingXcmExecutor;
        impl<C> ExecuteXcm<C> for FailingXcmExecutor {
            type Prepared = Weightless;
            fn prepare(message: Xcm<C>) -> Result<Self::Prepared, Xcm<C>> {
                Err(message)
            }
            fn execute(
                _: impl Into<Location>,
                _: Self::Prepared,
                _: &mut XcmHash,
                _: Weight,
            ) -> Outcome {
                unreachable!()
            }
            fn charge_fees(_: impl Into<Location>, _: Assets) -> xcm::latest::Result {
                Err(crate::reward::SendError::Fees.into())
            }
        }

        type FailingExecutorPayAccount = PayAccountOnLocation<
            MockRelayer,
            u128,
            EthereumNetwork,
            AssetHubLocation,
            InboundQueueLocation,
            MockXcmSender,
            FailingXcmExecutor,
            MockCall,
        >;

        let relayer = MockRelayer(AccountId32::new([3u8; 32]));
        let beneficiary = Location::new(1, Here);
        let reward = 500u128;
        let result = FailingExecutorPayAccount::pay_reward(&relayer, (), reward, beneficiary);

        assert!(result.is_err());
        let err_str = format!("{:?}", result.err().unwrap());
        assert!(
            err_str.contains("charge fees error"),
            "Expected 'charge fees error', got {:?}",
            err_str
        );
    }

    #[test]
    fn pay_reward_fails_on_delivery() {
        #[derive(Default)]
        struct FailingDeliveryXcmSender;
        impl SendXcm for FailingDeliveryXcmSender {
            type Ticket = ();

            fn validate(
                _dest: &mut Option<Location>,
                _xcm: &mut Option<Xcm<()>>,
            ) -> SendResult<Self::Ticket> {
                Ok(((), Assets::from(vec![])))
            }

            fn deliver(_xcm: Self::Ticket) -> core::result::Result<XcmHash, SendError> {
                Err(SendError::NotApplicable)
            }
        }

        type FailingDeliveryPayAccount = PayAccountOnLocation<
            MockRelayer,
            u128,
            EthereumNetwork,
            AssetHubLocation,
            InboundQueueLocation,
            FailingDeliveryXcmSender,
            MockXcmExecutor,
            MockCall,
        >;

        let relayer = MockRelayer(AccountId32::new([4u8; 32]));
        let beneficiary = Location::new(1, Here);
        let reward = 123u128;
        let result = FailingDeliveryPayAccount::pay_reward(&relayer, (), reward, beneficiary);

        assert!(result.is_err());
        let err_str = format!("{:?}", result.err().unwrap());
        assert!(
            err_str.contains("xcm send failure"),
            "Expected 'xcm delivery failure', got {:?}",
            err_str
        );
    }
}

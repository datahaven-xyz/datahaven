// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Converts XCM messages into InboundMessage that can be processed by the Gateway contract

use codec::DecodeAll;
use core::slice::Iter;
use frame_support::{ensure, BoundedVec};
use snowbridge_core::{AgentIdOf, TokenId, TokenIdOf};

use crate::v2::{
    message::{Command, Message},
    ContractCall,
};

use crate::v2::convert::XcmConverterError::{AssetResolutionFailed, FilterDoesNotConsumeAllAssets};
use sp_core::H160;
use sp_runtime::traits::MaybeEquivalence;
use sp_std::{iter::Peekable, marker::PhantomData, prelude::*};
use xcm::prelude::*;
use xcm_executor::traits::ConvertLocation;
use XcmConverterError::*;

/// Errors that can be thrown to the pattern matching step.
#[derive(PartialEq, Debug)]
pub enum XcmConverterError {
    UnexpectedEndOfXcm,
    EndOfXcmMessageExpected,
    WithdrawAssetExpected,
    DepositAssetExpected,
    NoReserveAssets,
    FilterDoesNotConsumeAllAssets,
    TooManyAssets,
    ZeroAssetTransfer,
    BeneficiaryResolutionFailed,
    AssetResolutionFailed,
    InvalidFeeAsset,
    SetTopicExpected,
    ReserveAssetDepositedExpected,
    InvalidAsset,
    UnexpectedInstruction,
    TooManyCommands,
    AliasOriginExpected,
    InvalidOrigin,
    TransactDecodeFailed,
    TransactParamsDecodeFailed,
    FeeAssetResolutionFailed,
    CallContractValueInsufficient,
    NoCommands,
}

macro_rules! match_expression {
	($expression:expr, $(|)? $( $pattern:pat_param )|+ $( if $guard: expr )?, $value:expr $(,)?) => {
		match $expression {
			$( $pattern )|+ $( if $guard )? => Some($value),
			_ => None,
		}
	};
}

pub struct XcmConverter<'a, ConvertAssetId, Call> {
    iter: Peekable<Iter<'a, Instruction<Call>>>,
    ethereum_network: NetworkId,
    _marker: PhantomData<ConvertAssetId>,
}
impl<'a, ConvertAssetId, Call> XcmConverter<'a, ConvertAssetId, Call>
where
    ConvertAssetId: MaybeEquivalence<TokenId, Location>,
{
    pub fn new(message: &'a Xcm<Call>, ethereum_network: NetworkId) -> Self {
        Self {
            iter: message.inner().iter().peekable(),
            ethereum_network,
            _marker: Default::default(),
        }
    }

    fn next(&mut self) -> Result<&'a Instruction<Call>, XcmConverterError> {
        self.iter
            .next()
            .ok_or(XcmConverterError::UnexpectedEndOfXcm)
    }

    fn peek(&mut self) -> Result<&&'a Instruction<Call>, XcmConverterError> {
        self.iter
            .peek()
            .ok_or(XcmConverterError::UnexpectedEndOfXcm)
    }

    fn network_matches(&self, network: &Option<NetworkId>) -> bool {
        if let Some(network) = network {
            *network == self.ethereum_network
        } else {
            true
        }
    }

    /// Extract the fee asset item from PayFees(V5)
    fn extract_remote_fee(&mut self) -> Result<u128, XcmConverterError> {
        use XcmConverterError::*;
        let reserved_fee_assets = match_expression!(self.next()?, WithdrawAsset(fee), fee)
            .ok_or(WithdrawAssetExpected)?;
        ensure!(reserved_fee_assets.len() == 1, AssetResolutionFailed);
        let reserved_fee_asset = reserved_fee_assets
            .inner()
            .first()
            .cloned()
            .ok_or(AssetResolutionFailed)?;
        let (reserved_fee_asset_id, reserved_fee_amount) = match reserved_fee_asset {
            Asset {
                id: asset_id,
                fun: Fungible(amount),
            } => Ok((asset_id, amount)),
            _ => Err(AssetResolutionFailed),
        }?;
        let fee_asset =
            match_expression!(self.next()?, PayFees { asset: fee }, fee).ok_or(InvalidFeeAsset)?;
        let (fee_asset_id, fee_amount) = match fee_asset {
            Asset {
                id: asset_id,
                fun: Fungible(amount),
            } => Ok((asset_id, *amount)),
            _ => Err(AssetResolutionFailed),
        }?;
        // Check the fee asset is Ether (XCM is evaluated in Ethereum context).
        ensure!(fee_asset_id.0 == Here.into(), InvalidFeeAsset);
        ensure!(reserved_fee_asset_id.0 == Here.into(), InvalidFeeAsset);
        ensure!(reserved_fee_amount >= fee_amount, InvalidFeeAsset);
        Ok(fee_amount)
    }

    /// Extract ethereum native assets
    fn extract_ethereum_native_assets(
        &mut self,
        enas: &Assets,
        deposit_assets: &AssetFilter,
        recipient: H160,
    ) -> Result<Vec<Command>, XcmConverterError> {
        let mut commands: Vec<Command> = Vec::new();
        for ena in enas.clone().into_inner().into_iter() {
            // Check the the deposit asset filter matches what was reserved.
            if !deposit_assets.matches(&ena) {
                return Err(FilterDoesNotConsumeAllAssets);
            }

            // only fungible asset is allowed
            let (token, amount) = match ena {
                Asset {
                    id: AssetId(inner_location),
                    fun: Fungible(amount),
                } => match inner_location.unpack() {
                    (0, [AccountKey20 { network, key }]) if self.network_matches(network) => {
                        Ok((H160(*key), amount))
                    }
                    // To allow ether
                    (0, []) => Ok((H160([0; 20]), amount)),
                    _ => Err(AssetResolutionFailed),
                },
                _ => Err(AssetResolutionFailed),
            }?;

            // transfer amount must be greater than 0.
            ensure!(amount > 0, ZeroAssetTransfer);

            commands.push(Command::UnlockNativeToken {
                token,
                recipient,
                amount,
            });
        }
        Ok(commands)
    }

    /// Extract polkadot native assets
    fn extract_polkadot_native_assets(
        &mut self,
        pnas: &Assets,
        deposit_assets: &AssetFilter,
        recipient: H160,
    ) -> Result<Vec<Command>, XcmConverterError> {
        let mut commands: Vec<Command> = Vec::new();
        ensure!(pnas.len() > 0, NoReserveAssets);
        for pna in pnas.clone().into_inner().into_iter() {
            if !deposit_assets.matches(&pna) {
                return Err(FilterDoesNotConsumeAllAssets);
            }

            // Only fungible is allowed
            let Asset {
                id: AssetId(asset_id),
                fun: Fungible(amount),
            } = pna
            else {
                return Err(AssetResolutionFailed);
            };

            // transfer amount must be greater than 0.
            ensure!(amount > 0, ZeroAssetTransfer);

            // Ensure PNA already registered
            let token_id = TokenIdOf::convert_location(&asset_id).ok_or(InvalidAsset)?;
            let expected_asset_id = ConvertAssetId::convert(&token_id).ok_or(InvalidAsset)?;
            ensure!(asset_id == expected_asset_id, InvalidAsset);

            commands.push(Command::MintForeignToken {
                token_id,
                recipient,
                amount,
            });
        }
        Ok(commands)
    }

    /// Convert the XCM into an outbound message which can be dispatched to
    /// the Gateway contract on Ethereum
    ///
    /// Assets being transferred can either be Polkadot-native assets (PNA)
    /// or Ethereum-native assets (ENA).
    ///
    /// The XCM is evaluated in Ethereum context.
    ///
    /// Expected Input Syntax:
    /// ```ignore
    /// WithdrawAsset(ETH)
    /// PayFees(ETH)
    /// ReserveAssetDeposited(PNA) | WithdrawAsset(ENA)
    /// AliasOrigin(Origin)
    /// DepositAsset(Asset)
    /// Transact() [OPTIONAL]
    /// SetTopic(Topic)
    /// ```
    /// Notes:
    /// a. Fee asset will be checked and currently only Ether is allowed
    /// b. For a specific transfer, either `ReserveAssetDeposited` or `WithdrawAsset` should be
    /// 	present
    /// c. `ReserveAssetDeposited` and `WithdrawAsset` can also be present in any order within the
    /// 	same message
    /// d. Currently, teleport asset is not allowed, transfer types other than
    /// 	above will cause the conversion to fail
    /// e. Currently, `AliasOrigin` is always required, can distinguish the V2 process from V1.
    /// 	it's required also for dispatching transact from that specific origin.
    /// f. SetTopic is required for tracing the message all the way along.
    pub fn convert(&mut self) -> Result<Message, XcmConverterError> {
        // Get fee amount
        let fee_amount = self.extract_remote_fee()?;

        // Get ENA reserve asset from WithdrawAsset.
        let mut enas = match_expression!(
            self.peek(),
            Ok(WithdrawAsset(reserve_assets)),
            reserve_assets
        );
        if enas.is_some() {
            let _ = self.next();
        }

        // Get PNA reserve asset from ReserveAssetDeposited
        let pnas = match_expression!(
            self.peek(),
            Ok(ReserveAssetDeposited(reserve_assets)),
            reserve_assets
        );
        if pnas.is_some() {
            let _ = self.next();
        }

        // Try to get ENA again if it is after PNA
        if enas.is_none() {
            enas = match_expression!(
                self.peek(),
                Ok(WithdrawAsset(reserve_assets)),
                reserve_assets
            );
            if enas.is_some() {
                let _ = self.next();
            }
        }
        // Check AliasOrigin.
        let origin_location = match_expression!(self.next()?, AliasOrigin(origin), origin)
            .ok_or(AliasOriginExpected)?;
        let origin = AgentIdOf::convert_location(origin_location).ok_or(InvalidOrigin)?;

        let (deposit_assets, beneficiary) = match_expression!(
            self.next()?,
            DepositAsset {
                assets,
                beneficiary
            },
            (assets, beneficiary)
        )
        .ok_or(DepositAssetExpected)?;

        // assert that the beneficiary is AccountKey20.
        let recipient = match_expression!(
            beneficiary.unpack(),
            (0, [AccountKey20 { network, key }])
                if self.network_matches(network),
            H160(*key)
        )
        .ok_or(BeneficiaryResolutionFailed)?;

        let mut commands: Vec<Command> = Vec::new();

        // ENA transfer commands
        if let Some(enas) = enas {
            commands.append(&mut self.extract_ethereum_native_assets(
                enas,
                deposit_assets,
                recipient,
            )?);
        }

        // PNA transfer commands
        if let Some(pnas) = pnas {
            commands.append(&mut self.extract_polkadot_native_assets(
                pnas,
                deposit_assets,
                recipient,
            )?);
        }

        // Transact commands
        let transact_call = match_expression!(self.peek(), Ok(Transact { call, .. }), call);
        if let Some(transact_call) = transact_call {
            let _ = self.next();
            let transact =
                ContractCall::decode_all(&mut transact_call.clone().into_encoded().as_slice())
                    .map_err(|_| TransactDecodeFailed)?;
            match transact {
                ContractCall::V1 {
                    target,
                    calldata,
                    gas,
                    value,
                } => commands.push(Command::CallContract {
                    target: target.into(),
                    calldata,
                    gas,
                    value,
                }),
            }
        }

        ensure!(commands.len() > 0, NoCommands);

        // ensure SetTopic exists
        let topic_id = match_expression!(self.next()?, SetTopic(id), id).ok_or(SetTopicExpected)?;

        let message = Message {
            id: (*topic_id).into(),
            origin,
            fee: fee_amount,
            commands: BoundedVec::try_from(commands).map_err(|_| TooManyCommands)?,
        };

        // All xcm instructions must be consumed before exit.
        if self.next().is_ok() {
            return Err(EndOfXcmMessageExpected);
        }

        Ok(message)
    }
}

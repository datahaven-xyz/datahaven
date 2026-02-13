// Copyright 2019-2025 PureStake Inc.
// This file is part of Moonbeam.

// Moonbeam is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Moonbeam is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Moonbeam.  If not, see <http://www.gnu.org/licenses/>.

//! Precompile to receive GMP callbacks and forward to XCM

#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

use alloc::boxed::Box;
use alloc::vec::Vec;
use core::marker::PhantomData;
use fp_evm::PrecompileHandle;
use frame_support::dispatch::{GetDispatchInfo, PostDispatchInfo};
use frame_support::sp_runtime::traits::StaticLookup;
use frame_support::traits::Currency;
use pallet_evm::AddressMapping;
use pallet_identity::legacy::IdentityField;
use parity_scale_codec::MaxEncodedLen;
use precompile_utils::prelude::*;
use sp_core::{ConstU32, Get, H160, H256, U256};
use sp_runtime::traits::Dispatchable;

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

type BalanceOf<T> = <<T as pallet_identity::Config>::Currency as Currency<
    <T as frame_system::Config>::AccountId,
>>::Balance;

type IdentityFieldOf<T> = <<T as pallet_identity::Config>::IdentityInformation
	as pallet_identity::IdentityInformationProvider>::FieldsIdentifier;

/// Solidity selector of the Vote log, which is the Keccak of the Log signature.
pub(crate) const SELECTOR_LOG_IDENTITY_SET: [u8; 32] = keccak256!("IdentitySet(address)");
pub(crate) const SELECTOR_LOG_IDENTITY_CLEARED: [u8; 32] = keccak256!("IdentityCleared(address)");
pub(crate) const SELECTOR_LOG_JUDGEMENT_REQUESTED: [u8; 32] =
    keccak256!("JudgementRequested(address,uint32)");
pub(crate) const SELECTOR_LOG_JUDGEMENT_UNREQUESTED: [u8; 32] =
    keccak256!("JudgementUnrequested(address,uint32)");
pub(crate) const SELECTOR_LOG_JUDGEMENT_GIVEN: [u8; 32] =
    keccak256!("JudgementGiven(address,uint32)");
pub(crate) const SELECTOR_LOG_SUB_IDENTITY_ADDED: [u8; 32] =
    keccak256!("SubIdentityAdded(address,address)");
pub(crate) const SELECTOR_LOG_SUB_IDENTITY_REMOVED: [u8; 32] =
    keccak256!("SubIdentityRemoved(address,address)");
pub(crate) const SELECTOR_LOG_SUB_IDENTITY_REVOKED: [u8; 32] =
    keccak256!("SubIdentityRevoked(address)");

/// A precompile to wrap the functionality from pallet-identity
pub struct IdentityPrecompile<Runtime, MaxAdditionalFields>(
    PhantomData<(Runtime, MaxAdditionalFields)>,
);

#[precompile_utils::precompile]
#[precompile::test_concrete_types(mock::Runtime, mock::MaxAdditionalFields)]
impl<Runtime, MaxAdditionalFields> IdentityPrecompile<Runtime, MaxAdditionalFields>
where
    MaxAdditionalFields: Get<u32> + 'static,
    Runtime: pallet_evm::Config
        + pallet_identity::Config<
            IdentityInformation = pallet_identity::legacy::IdentityInfo<MaxAdditionalFields>,
        >,
    Runtime::AccountId: Into<H160>,
    Runtime::Hash: From<H256>,
    <Runtime as frame_system::Config>::RuntimeCall:
        Dispatchable<PostInfo = PostDispatchInfo> + GetDispatchInfo,
    <<Runtime as frame_system::Config>::RuntimeCall as Dispatchable>::RuntimeOrigin:
        From<Option<Runtime::AccountId>>,
    Runtime::RuntimeCall: From<pallet_identity::Call<Runtime>>,
    BalanceOf<Runtime>: TryFrom<U256> + Into<U256> + solidity::Codec,
    <Runtime as pallet_evm::Config>::AddressMapping: AddressMapping<Runtime::AccountId>,
{
    // Note: addRegistrar(address) & killIdentity(address) are not supported since they use a
    // force origin.

    #[precompile::public("setIdentity((((bool,bytes),(bool,bytes))[],(bool,bytes),(bool,bytes),(bool,bytes),(bool,bytes),(bool,bytes),bool,bytes,(bool,bytes),(bool,bytes)))")]
    fn set_identity(
        handle: &mut impl PrecompileHandle,
        info: IdentityInfo<MaxAdditionalFields>,
    ) -> EvmResult {
        let caller = handle.context().caller;

        let event = log1(
            handle.context().address,
            SELECTOR_LOG_IDENTITY_SET,
            solidity::encode_event_data(Address(caller)),
        );
        handle.record_log_costs(&[&event])?;

        let info: Box<Runtime::IdentityInformation> = Self::identity_to_input(info)?;

        let call = pallet_identity::Call::<Runtime>::set_identity { info };

        let origin = Runtime::AddressMapping::into_account_id(caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        event.record(handle)?;

        Ok(())
    }

    #[precompile::public("setSubs((address,(bool,bytes))[])")]
    fn set_subs(
        handle: &mut impl PrecompileHandle,
        subs: BoundedVec<(Address, Data), Runtime::MaxSubAccounts>,
    ) -> EvmResult {
        let subs: Vec<_> = subs.into();
        let mut call_subs = Vec::with_capacity(subs.len());
        for (i, (addr, data)) in subs.into_iter().enumerate() {
            let addr = Runtime::AddressMapping::into_account_id(addr.into());
            let data: pallet_identity::Data = data
                .try_into()
                .map_err(|e| RevertReason::custom(e).in_field(alloc::format!("index {i}")))?;
            call_subs.push((addr, data));
        }
        let call = pallet_identity::Call::<Runtime>::set_subs { subs: call_subs };

        let origin = Runtime::AddressMapping::into_account_id(handle.context().caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        Ok(())
    }

    #[precompile::public("clearIdentity()")]
    fn clear_identity(handle: &mut impl PrecompileHandle) -> EvmResult {
        let caller = handle.context().caller;

        let event = log1(
            handle.context().address,
            SELECTOR_LOG_IDENTITY_CLEARED,
            solidity::encode_event_data(Address(caller)),
        );
        handle.record_log_costs(&[&event])?;

        let call = pallet_identity::Call::<Runtime>::clear_identity {};

        let origin = Runtime::AddressMapping::into_account_id(caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        event.record(handle)?;

        Ok(())
    }

    #[precompile::public("requestJudgement(uint32,uint256)")]
    fn request_judgement(
        handle: &mut impl PrecompileHandle,
        reg_index: u32,
        max_fee: U256,
    ) -> EvmResult {
        let caller = handle.context().caller;

        let event = log1(
            handle.context().address,
            SELECTOR_LOG_JUDGEMENT_REQUESTED,
            solidity::encode_event_data((Address(caller), reg_index)),
        );
        handle.record_log_costs(&[&event])?;

        let max_fee = max_fee
            .try_into()
            .map_err(|_| RevertReason::value_is_too_large("max_fee"))?;
        let call = pallet_identity::Call::<Runtime>::request_judgement { reg_index, max_fee };

        let origin = Runtime::AddressMapping::into_account_id(caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        event.record(handle)?;

        Ok(())
    }

    #[precompile::public("cancelRequest(uint32)")]
    fn cancel_request(handle: &mut impl PrecompileHandle, reg_index: u32) -> EvmResult {
        let caller = handle.context().caller;

        let event = log1(
            handle.context().address,
            SELECTOR_LOG_JUDGEMENT_UNREQUESTED,
            solidity::encode_event_data((Address(caller), reg_index)),
        );
        handle.record_log_costs(&[&event])?;

        let call = pallet_identity::Call::<Runtime>::cancel_request { reg_index };

        let origin = Runtime::AddressMapping::into_account_id(caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        event.record(handle)?;

        Ok(())
    }

    #[precompile::public("setFee(uint32,uint256)")]
    fn set_fee(handle: &mut impl PrecompileHandle, index: u32, fee: U256) -> EvmResult {
        let fee = fee
            .try_into()
            .map_err(|_| RevertReason::value_is_too_large("fee"))?;
        let call = pallet_identity::Call::<Runtime>::set_fee { index, fee };

        let origin = Runtime::AddressMapping::into_account_id(handle.context().caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        Ok(())
    }

    #[precompile::public("setAccountId(uint32,address)")]
    fn set_account_id(handle: &mut impl PrecompileHandle, index: u32, new: Address) -> EvmResult {
        let new = Runtime::Lookup::unlookup(Runtime::AddressMapping::into_account_id(new.0));
        let call = pallet_identity::Call::<Runtime>::set_account_id { index, new };

        let origin = Runtime::AddressMapping::into_account_id(handle.context().caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        Ok(())
    }

    #[precompile::public("setFields(uint32,(bool,bool,bool,bool,bool,bool,bool,bool))")]
    fn set_fields(
        handle: &mut impl PrecompileHandle,
        index: u32,
        fields: IdentityFields,
    ) -> EvmResult {
        let fields = Self::identity_fields_to_input(fields);
        let call = pallet_identity::Call::<Runtime>::set_fields { index, fields };

        let origin = Runtime::AddressMapping::into_account_id(handle.context().caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        Ok(())
    }

    #[precompile::public(
        "provideJudgement(uint32,address,(bool,bool,uint256,bool,bool,bool,bool,bool),bytes32)"
    )]
    fn provide_judgement(
        handle: &mut impl PrecompileHandle,
        reg_index: u32,
        target: Address,
        judgement: Judgement,
        identity: H256,
    ) -> EvmResult {
        let caller = handle.context().caller;

        let event = log1(
            handle.context().address,
            SELECTOR_LOG_JUDGEMENT_GIVEN,
            solidity::encode_event_data((target, reg_index)),
        );
        handle.record_log_costs(&[&event])?;

        let target = Runtime::Lookup::unlookup(Runtime::AddressMapping::into_account_id(target.0));
        let judgement = Self::judgment_to_input(judgement)?;
        let identity: Runtime::Hash = identity.into();
        let call = pallet_identity::Call::<Runtime>::provide_judgement {
            reg_index,
            target,
            judgement,
            identity,
        };

        let origin = Runtime::AddressMapping::into_account_id(caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        event.record(handle)?;

        Ok(())
    }

    #[precompile::public("addSub(address,(bool,bytes))")]
    fn add_sub(handle: &mut impl PrecompileHandle, sub: Address, data: Data) -> EvmResult {
        let caller = handle.context().caller;

        let event = log1(
            handle.context().address,
            SELECTOR_LOG_SUB_IDENTITY_ADDED,
            solidity::encode_event_data((sub, Address(caller))),
        );
        handle.record_log_costs(&[&event])?;

        let sub = Runtime::Lookup::unlookup(Runtime::AddressMapping::into_account_id(sub.0));
        let data: pallet_identity::Data = data
            .try_into()
            .map_err(|e| RevertReason::custom(e).in_field("data"))?;
        let call = pallet_identity::Call::<Runtime>::add_sub { sub, data };

        let origin = Runtime::AddressMapping::into_account_id(caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        event.record(handle)?;

        Ok(())
    }

    #[precompile::public("renameSub(address,(bool,bytes))")]
    fn rename_sub(handle: &mut impl PrecompileHandle, sub: Address, data: Data) -> EvmResult {
        let sub = Runtime::Lookup::unlookup(Runtime::AddressMapping::into_account_id(sub.0));
        let data: pallet_identity::Data = data
            .try_into()
            .map_err(|e| RevertReason::custom(e).in_field("data"))?;
        let call = pallet_identity::Call::<Runtime>::rename_sub { sub, data };

        let origin = Runtime::AddressMapping::into_account_id(handle.context().caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        Ok(())
    }

    #[precompile::public("removeSub(address)")]
    fn remove_sub(handle: &mut impl PrecompileHandle, sub: Address) -> EvmResult {
        let caller = handle.context().caller;

        let event = log1(
            handle.context().address,
            SELECTOR_LOG_SUB_IDENTITY_REMOVED,
            solidity::encode_event_data((sub, Address(caller))),
        );
        handle.record_log_costs(&[&event])?;

        let sub = Runtime::Lookup::unlookup(Runtime::AddressMapping::into_account_id(sub.0));
        let call = pallet_identity::Call::<Runtime>::remove_sub { sub };

        let origin = Runtime::AddressMapping::into_account_id(caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        event.record(handle)?;

        Ok(())
    }

    #[precompile::public("quitSub()")]
    fn quit_sub(handle: &mut impl PrecompileHandle) -> EvmResult {
        let caller = handle.context().caller;

        let event = log1(
            handle.context().address,
            SELECTOR_LOG_SUB_IDENTITY_REVOKED,
            solidity::encode_event_data(Address(caller)),
        );
        handle.record_log_costs(&[&event])?;

        let call = pallet_identity::Call::<Runtime>::quit_sub {};

        let origin = Runtime::AddressMapping::into_account_id(caller);
        RuntimeHelper::<Runtime>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        event.record(handle)?;

        Ok(())
    }

    #[precompile::public("identity(address)")]
    #[precompile::view]
    fn identity(
        handle: &mut impl PrecompileHandle,
        who: Address,
    ) -> EvmResult<Registration<MaxAdditionalFields>> {
        // Storage item: IdentityOf ->
        //		Registration<BalanceOf<T>, T::MaxRegistrars, T::MaxAdditionalFields>
        handle.record_db_read::<Runtime>(pallet_identity::Registration::<
            BalanceOf<Runtime>,
            Runtime::MaxRegistrars,
            Runtime::IdentityInformation,
        >::max_encoded_len())?;

        let who: H160 = who.into();
        let who = Runtime::AddressMapping::into_account_id(who);
        let identity = pallet_identity::IdentityOf::<Runtime>::get(who);

        Ok(Self::identity_to_output(identity)?)
    }

    #[precompile::public("superOf(address)")]
    #[precompile::view]
    fn super_of(handle: &mut impl PrecompileHandle, who: Address) -> EvmResult<SuperOf> {
        // Storage item: SuperOf -> (T::AccountId, Data)
        handle.record_db_read::<Runtime>(
            Runtime::AccountId::max_encoded_len()
                .saturating_add(pallet_identity::Data::max_encoded_len()),
        )?;

        let who: H160 = who.into();
        let who = Runtime::AddressMapping::into_account_id(who);
        if let Some((account, data)) = pallet_identity::SuperOf::<Runtime>::get(who) {
            Ok(SuperOf {
                is_valid: true,
                account: Address(account.into()),
                data: Self::data_to_output(data),
            })
        } else {
            Ok(SuperOf::default())
        }
    }

    #[precompile::public("subsOf(address)")]
    #[precompile::view]
    fn subs_of(handle: &mut impl PrecompileHandle, who: Address) -> EvmResult<SubsOf> {
        // Storage item: SubsOf -> (BalanceOf<T>, BoundedVec<T::AccountId, T::MaxSubAccounts>)
        handle.record_db_read::<Runtime>(
            BalanceOf::<Runtime>::max_encoded_len().saturating_add(
                Runtime::AccountId::max_encoded_len()
                    .saturating_mul(Runtime::MaxSubAccounts::get() as usize),
            ),
        )?;

        let who: H160 = who.into();
        let who = Runtime::AddressMapping::into_account_id(who);
        let (deposit, accounts) = pallet_identity::SubsOf::<Runtime>::get(who);

        let accounts = accounts
            .into_iter()
            .map(|account| Address(account.into()))
            .collect();

        Ok(SubsOf {
            deposit: deposit.into(),
            accounts,
        })
    }

    #[precompile::public("registrars()")]
    #[precompile::view]
    fn registrars(handle: &mut impl PrecompileHandle) -> EvmResult<Vec<Registrar>> {
        // Storage item: Registrars ->
        // 		BoundedVec<Option<RegistrarInfo<BalanceOf<T>, T::AccountId>>, T::MaxRegistrars>
        handle.record_db_read::<Runtime>(
            pallet_identity::RegistrarInfo::<
                BalanceOf<Runtime>,
                Runtime::AccountId,
                IdentityFieldOf<Runtime>,
            >::max_encoded_len()
            .saturating_mul(Runtime::MaxRegistrars::get() as usize),
        )?;

        let registrars = pallet_identity::Registrars::<Runtime>::get()
            .into_iter()
            .enumerate()
            .map(|(index, maybe_reg)| {
                if let Some(reg) = maybe_reg {
                    let fields: u64 = reg.fields.into();
                    Registrar {
                        is_valid: true,
                        index: index as u32,
                        account: Address(reg.account.into()),
                        fee: reg.fee.into(),
                        fields: IdentityFields {
                            display: fields & (IdentityField::Display as u64)
                                == (IdentityField::Display as u64),
                            legal: fields & (IdentityField::Legal as u64)
                                == (IdentityField::Legal as u64),
                            web: fields & (IdentityField::Web as u64)
                                == (IdentityField::Web as u64),
                            riot: fields & (IdentityField::Riot as u64)
                                == (IdentityField::Riot as u64),
                            email: fields & (IdentityField::Email as u64)
                                == (IdentityField::Email as u64),
                            pgp_fingerprint: fields & (IdentityField::PgpFingerprint as u64)
                                == (IdentityField::PgpFingerprint as u64),
                            image: fields & (IdentityField::Image as u64)
                                == (IdentityField::Image as u64),
                            twitter: fields & (IdentityField::Twitter as u64)
                                == (IdentityField::Twitter as u64),
                        },
                    }
                } else {
                    Registrar {
                        is_valid: false,
                        index: index as u32,
                        ..Default::default()
                    }
                }
            })
            .collect();

        Ok(registrars)
    }

    fn identity_fields_to_input(fields: IdentityFields) -> IdentityFieldOf<Runtime> {
        let mut field_bits = 0u64;
        if fields.display {
            field_bits = field_bits | IdentityField::Display as u64;
        }
        if fields.legal {
            field_bits = field_bits | IdentityField::Legal as u64;
        }
        if fields.web {
            field_bits = field_bits | IdentityField::Web as u64;
        }
        if fields.riot {
            field_bits = field_bits | IdentityField::Riot as u64;
        }
        if fields.email {
            field_bits = field_bits | IdentityField::Email as u64;
        }
        if fields.pgp_fingerprint {
            field_bits = field_bits | IdentityField::PgpFingerprint as u64;
        }
        if fields.image {
            field_bits = field_bits | IdentityField::Image as u64;
        }
        if fields.twitter {
            field_bits = field_bits | IdentityField::Twitter as u64;
        }

        IdentityFieldOf::<Runtime>::from(field_bits)
    }

    fn identity_to_input(
        info: IdentityInfo<MaxAdditionalFields>,
    ) -> MayRevert<Box<pallet_identity::legacy::IdentityInfo<MaxAdditionalFields>>> {
        // let additional: Vec<(pallet_identity::Data, pallet_identity::Data)> = info.additional.into();
        let mut additional: sp_runtime::BoundedVec<
            (pallet_identity::Data, pallet_identity::Data),
            MaxAdditionalFields,
        > = Default::default();
        let iter: Vec<_> = info.additional.into();
        for (i, (k, v)) in iter.into_iter().enumerate() {
            let k: pallet_identity::Data = k.try_into().map_err(|e| {
                RevertReason::custom(e).in_field(alloc::format!("additional.{i}.key"))
            })?;
            let v: pallet_identity::Data = v.try_into().map_err(|e| {
                RevertReason::custom(e).in_field(alloc::format!("additional.{i}.value"))
            })?;
            additional
                .try_push((k, v))
                .map_err(|_| RevertReason::custom("out of bounds").in_field("additional"))?;
        }

        let pgp_fingerprint: Option<[u8; 20]> = if info.has_pgp_fingerprint {
            let fingerprint: Vec<_> = info.pgp_fingerprint.into();
            let fingerprint = fingerprint
                .try_into()
                .map_err(|_| RevertReason::custom("pgp_fingerprint must be 20 bytes long"))?;
            Some(fingerprint)
        } else {
            None
        };
        let identity_info = pallet_identity::legacy::IdentityInfo::<MaxAdditionalFields> {
            additional,
            display: info
                .display
                .try_into()
                .map_err(|e| RevertReason::custom(e).in_field("display"))?,
            legal: info
                .legal
                .try_into()
                .map_err(|e| RevertReason::custom(e).in_field("legal"))?,
            web: info
                .web
                .try_into()
                .map_err(|e| RevertReason::custom(e).in_field("web"))?,
            riot: info
                .riot
                .try_into()
                .map_err(|e| RevertReason::custom(e).in_field("riot"))?,
            email: info
                .email
                .try_into()
                .map_err(|e| RevertReason::custom(e).in_field("email"))?,
            pgp_fingerprint,
            image: info
                .image
                .try_into()
                .map_err(|e| RevertReason::custom(e).in_field("image"))?,
            twitter: info
                .twitter
                .try_into()
                .map_err(|e| RevertReason::custom(e).in_field("twitter"))?,
        };

        Ok(Box::new(identity_info))
    }

    fn identity_to_output(
        registration: Option<
            pallet_identity::Registration<
                BalanceOf<Runtime>,
                Runtime::MaxRegistrars,
                Runtime::IdentityInformation,
            >,
        >,
    ) -> MayRevert<Registration<MaxAdditionalFields>> {
        let Some(registration) = registration else {
            return Ok(Registration::<MaxAdditionalFields>::default());
        };

        let mut identity_info = IdentityInfo::<MaxAdditionalFields> {
            additional: Default::default(),
            display: Self::data_to_output(registration.info.display),
            legal: Self::data_to_output(registration.info.legal),
            web: Self::data_to_output(registration.info.web),
            riot: Self::data_to_output(registration.info.riot),
            email: Self::data_to_output(registration.info.email),
            has_pgp_fingerprint: false,
            pgp_fingerprint: Default::default(),
            image: Self::data_to_output(registration.info.image),
            twitter: Self::data_to_output(registration.info.twitter),
        };

        let mut additional = Vec::new();
        for (k, v) in registration.info.additional.into_iter() {
            let k: Data = Self::data_to_output(k);
            let v: Data = Self::data_to_output(v);
            additional.push((k, v));
        }

        if let Some(pgp_fingerprint) = registration.info.pgp_fingerprint {
            identity_info.has_pgp_fingerprint = true;
            identity_info.pgp_fingerprint = pgp_fingerprint.into();
        }

        identity_info.additional = additional.into();

        let mut judgements = Vec::new();
        for (index, judgement) in registration.judgements.into_iter() {
            judgements.push((index, Self::judgement_to_output(judgement)));
        }

        let reg = Registration::<MaxAdditionalFields> {
            is_valid: true,
            judgements: judgements.into(),
            deposit: registration.deposit.into(),
            info: identity_info,
        };

        Ok(reg)
    }

    fn judgement_to_output(value: pallet_identity::Judgement<BalanceOf<Runtime>>) -> Judgement {
        let mut judgement = Judgement::default();

        match value {
            pallet_identity::Judgement::Unknown => {
                judgement.is_unknown = true;
            }
            pallet_identity::Judgement::FeePaid(balance) => {
                judgement.is_fee_paid = true;
                judgement.fee_paid_deposit = balance.into();
            }
            pallet_identity::Judgement::Reasonable => {
                judgement.is_reasonable = true;
            }
            pallet_identity::Judgement::KnownGood => {
                judgement.is_known_good = true;
            }
            pallet_identity::Judgement::OutOfDate => {
                judgement.is_out_of_date = true;
            }
            pallet_identity::Judgement::LowQuality => {
                judgement.is_low_quality = true;
            }
            pallet_identity::Judgement::Erroneous => {
                judgement.is_erroneous = true;
            }
        };

        judgement
    }

    fn judgment_to_input(
        value: Judgement,
    ) -> Result<pallet_identity::Judgement<BalanceOf<Runtime>>, RevertReason> {
        if value.is_unknown {
            return Ok(pallet_identity::Judgement::Unknown);
        }

        if value.is_fee_paid {
            let amount: BalanceOf<Runtime> = value
                .fee_paid_deposit
                .try_into()
                .map_err(|_| RevertReason::value_is_too_large("fee_paid_deposit").into())?;

            return Ok(pallet_identity::Judgement::FeePaid(amount));
        }

        if value.is_reasonable {
            return Ok(pallet_identity::Judgement::Reasonable);
        }

        if value.is_known_good {
            return Ok(pallet_identity::Judgement::KnownGood);
        }

        if value.is_out_of_date {
            return Ok(pallet_identity::Judgement::OutOfDate);
        }

        if value.is_low_quality {
            return Ok(pallet_identity::Judgement::LowQuality);
        }

        if value.is_erroneous {
            return Ok(pallet_identity::Judgement::Erroneous);
        }

        return Err(RevertReason::custom("invalid"));
    }

    fn data_to_output(data: pallet_identity::Data) -> Data {
        let mut output = Data::default();
        match data {
            pallet_identity::Data::None => (),
            pallet_identity::Data::Raw(bytes) => {
                let bytes: Vec<_> = bytes.into();
                output.has_data = true;
                output.value = bytes.into();
            }
            pallet_identity::Data::BlakeTwo256(bytes) => {
                output.has_data = true;
                output.value = bytes.into();
            }
            pallet_identity::Data::Sha256(bytes) => {
                output.has_data = true;
                output.value = bytes.into();
            }
            pallet_identity::Data::Keccak256(bytes) => {
                output.has_data = true;
                output.value = bytes.into();
            }
            pallet_identity::Data::ShaThree256(bytes) => {
                output.has_data = true;
                output.value = bytes.into();
            }
        }

        output
    }
}

#[derive(Default, Debug, Eq, PartialEq, solidity::Codec)]
pub struct Data {
    has_data: bool,
    value: BoundedBytes<ConstU32<32>>,
}

impl TryFrom<Data> for pallet_identity::Data {
    type Error = &'static str;

    fn try_from(value: Data) -> Result<Self, Self::Error> {
        if !value.has_data {
            return Ok(pallet_identity::Data::None);
        }

        let value: Vec<_> = value.value.into();
        let value: sp_runtime::BoundedVec<_, ConstU32<32>> =
            value.try_into().map_err(|_| "exceeded bounds")?;
        Ok(pallet_identity::Data::Raw(value))
    }
}

#[derive(Eq, PartialEq, Debug, solidity::Codec)]
pub struct Additional {
    key: Data,
    value: Data,
}

#[derive(Eq, PartialEq, Debug, solidity::Codec)]
pub struct IdentityInfo<FieldLimit> {
    additional: BoundedVec<(Data, Data), FieldLimit>,
    display: Data,
    legal: Data,
    web: Data,
    riot: Data,
    email: Data,
    has_pgp_fingerprint: bool,
    pgp_fingerprint: BoundedBytes<ConstU32<20>>,
    image: Data,
    twitter: Data,
}

impl<T> Default for IdentityInfo<T> {
    fn default() -> Self {
        Self {
            additional: Default::default(),
            display: Default::default(),
            legal: Default::default(),
            web: Default::default(),
            riot: Default::default(),
            email: Default::default(),
            has_pgp_fingerprint: Default::default(),
            pgp_fingerprint: Default::default(),
            image: Default::default(),
            twitter: Default::default(),
        }
    }
}

#[derive(Eq, PartialEq, Default, Debug, solidity::Codec)]
pub struct Judgement {
    is_unknown: bool,
    is_fee_paid: bool,
    fee_paid_deposit: U256,
    is_reasonable: bool,
    is_known_good: bool,
    is_out_of_date: bool,
    is_low_quality: bool,
    is_erroneous: bool,
}

#[derive(Eq, PartialEq, Debug, solidity::Codec)]
pub struct Registration<FieldLimit> {
    is_valid: bool,
    judgements: Vec<(u32, Judgement)>,
    deposit: U256,
    info: IdentityInfo<FieldLimit>,
}

impl<T> Default for Registration<T> {
    fn default() -> Self {
        Self {
            is_valid: false,
            judgements: Vec::new(),
            deposit: Default::default(),
            info: Default::default(),
        }
    }
}

#[derive(Default, Debug, solidity::Codec)]
pub struct SuperOf {
    is_valid: bool,
    account: Address,
    data: Data,
}

#[derive(Default, Debug, solidity::Codec)]
pub struct SubsOf {
    deposit: U256,
    accounts: Vec<Address>,
}

#[derive(Default, Debug, solidity::Codec)]
pub struct IdentityFields {
    display: bool,
    legal: bool,
    web: bool,
    riot: bool,
    email: bool,
    pgp_fingerprint: bool,
    image: bool,
    twitter: bool,
}

#[derive(Default, Debug, solidity::Codec)]
pub struct Registrar {
    is_valid: bool,
    index: u32,
    account: Address,
    fee: U256,
    fields: IdentityFields,
}

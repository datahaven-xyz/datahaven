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

#![cfg_attr(not(feature = "std"), no_std)]
extern crate alloc;

use alloc::boxed::Box;
use alloc::vec::Vec;
use core::{marker::PhantomData, str::FromStr};
use fp_evm::PrecompileHandle;
use frame_support::dispatch::{GetDispatchInfo, PostDispatchInfo};
use frame_support::traits::{
    schedule::DispatchTime, Bounded, Currency, Get, OriginTrait, VoteTally,
};
use pallet_evm::AddressMapping;
use pallet_referenda::{
    Call as ReferendaCall, DecidingCount, Deposit, Pallet as Referenda, ReferendumCount,
    ReferendumInfo, ReferendumInfoFor, TracksInfo,
};
use parity_scale_codec::{Encode, MaxEncodedLen};
use precompile_utils::prelude::*;
use sp_core::{H160, H256, U256};
use sp_runtime::str_array;
use sp_runtime::traits::Dispatchable;

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

pub const CALL_DATA_LIMIT: u32 = 2u32.pow(16);

type BlockNumberFor<T> = pallet_referenda::BlockNumberFor<T, ()>;
type BalanceOf<Runtime> = <<Runtime as pallet_referenda::Config>::Currency as Currency<
    <Runtime as frame_system::Config>::AccountId,
>>::Balance;
type TrackIdOf<Runtime> = <<Runtime as pallet_referenda::Config>::Tracks as TracksInfo<
    BalanceOf<Runtime>,
    BlockNumberFor<Runtime>,
>>::Id;
type BoundedCallOf<Runtime> = Bounded<
    <Runtime as pallet_referenda::Config>::RuntimeCall,
    <Runtime as frame_system::Config>::Hashing,
>;

type OriginOf<Runtime> =
    <<Runtime as frame_system::Config>::RuntimeOrigin as OriginTrait>::PalletsOrigin;

pub(crate) const SELECTOR_LOG_SUBMITTED_AT: [u8; 32] =
    keccak256!("SubmittedAt(uint16,uint32,bytes32)");

pub(crate) const SELECTOR_LOG_SUBMITTED_AFTER: [u8; 32] =
    keccak256!("SubmittedAfter(uint16,uint32,bytes32)");

pub(crate) const SELECTOR_LOG_DECISION_DEPOSIT_PLACED: [u8; 32] =
    keccak256!("DecisionDepositPlaced(uint32,address,uint256)");

pub(crate) const SELECTOR_LOG_DECISION_DEPOSIT_REFUNDED: [u8; 32] =
    keccak256!("DecisionDepositRefunded(uint32,address,uint256)");

pub(crate) const SELECTOR_LOG_SUBMISSION_DEPOSIT_REFUNDED: [u8; 32] =
    keccak256!("SubmissionDepositRefunded(uint32,address,uint256)");

#[derive(solidity::Codec)]
pub struct TrackInfo {
    name: UnboundedBytes,
    max_deciding: U256,
    decision_deposit: U256,
    prepare_period: U256,
    decision_period: U256,
    confirm_period: U256,
    min_enactment_period: U256,
    min_approval: UnboundedBytes,
    min_support: UnboundedBytes,
}

#[derive(solidity::Codec)]
pub struct OngoingReferendumInfo {
    /// The track of this referendum.
    track_id: u16,
    /// The origin for this referendum.
    origin: UnboundedBytes,
    /// The hash of the proposal up for referendum.
    proposal: UnboundedBytes,
    /// Whether proposal is scheduled for enactment at or after `enactment_time`.
    enactment_type: bool,
    /// The time the proposal should be scheduled for enactment.
    enactment_time: U256,
    /// The time of submission. Once `UndecidingTimeout` passes, it may be closed by anyone if
    /// `deciding` is `None`.
    submission_time: U256,
    submission_depositor: Address,
    submission_deposit: U256,
    decision_depositor: Address,
    decision_deposit: U256,
    /// When this referendum began being "decided". If confirming, then the
    /// end will actually be delayed until the end of the confirmation period.
    deciding_since: U256,
    /// If nonzero, then the referendum has entered confirmation stage and will end at
    /// the block number as long as it doesn't lose its approval in the meantime.
    deciding_confirming_end: U256,
    /// The number of aye votes, expressed in terms of post-conviction lock-vote.
    ayes: U256,
    /// Percent aye votes, expressed pre-conviction, over the total votes in the class.
    support: u32,
    /// Percent of aye votes over aye + nay votes.
    approval: u32,
    /// Whether we have been placed in the queue for being decided or not.
    in_queue: bool,
    /// The next scheduled wake-up
    alarm_time: U256,
    alarm_task_address: UnboundedBytes,
}

#[derive(solidity::Codec)]
pub struct ClosedReferendumInfo {
    status: u8,
    end: U256,
    submission_depositor: Address,
    submission_deposit: U256,
    decision_depositor: Address,
    decision_deposit: U256,
}

/// A precompile to wrap the functionality from pallet-referenda.
pub struct ReferendaPrecompile<Runtime, GovOrigin>(PhantomData<(Runtime, GovOrigin)>);

#[precompile_utils::precompile]
impl<Runtime, GovOrigin> ReferendaPrecompile<Runtime, GovOrigin>
where
    Runtime: pallet_referenda::Config + pallet_evm::Config + frame_system::Config,
    OriginOf<Runtime>: From<GovOrigin>,
    Runtime::AccountId: Into<H160>,
    <Runtime as frame_system::Config>::RuntimeCall:
        Dispatchable<PostInfo = PostDispatchInfo> + GetDispatchInfo,
    <<Runtime as frame_system::Config>::RuntimeCall as Dispatchable>::RuntimeOrigin:
        From<Option<Runtime::AccountId>>,
    <Runtime as frame_system::Config>::RuntimeCall: From<ReferendaCall<Runtime>>,
    <Runtime as frame_system::Config>::Hash: Into<H256>,
    BlockNumberFor<Runtime>: Into<U256>,
    Runtime::AccountId: Into<H160>,
    TrackIdOf<Runtime>: TryFrom<u16> + TryInto<u16>,
    BalanceOf<Runtime>: Into<U256>,
    Runtime::Votes: Into<U256>,
    GovOrigin: FromStr,
    H256: From<<Runtime as frame_system::Config>::Hash>
        + Into<<Runtime as frame_system::Config>::Hash>,
    <Runtime as pallet_evm::Config>::AddressMapping: AddressMapping<Runtime::AccountId>,
{
    // The accessors are first. They directly return their result.
    #[precompile::public("referendumCount()")]
    #[precompile::view]
    fn referendum_count(handle: &mut impl PrecompileHandle) -> EvmResult<u32> {
        // ReferendumCount
        handle.record_db_read::<Runtime>(4)?;
        let ref_count = ReferendumCount::<Runtime>::get();
        log::trace!(target: "referendum-precompile", "Referendum count is {:?}", ref_count);

        Ok(ref_count)
    }

    #[precompile::public("submissionDeposit()")]
    #[precompile::view]
    fn submission_deposit(_handle: &mut impl PrecompileHandle) -> EvmResult<U256> {
        let submission_deposit = Runtime::SubmissionDeposit::get();
        log::trace!(target: "referendum-precompile", "Submission deposit is {:?}", submission_deposit);

        Ok(submission_deposit.into())
    }

    #[precompile::public("decidingCount(uint16)")]
    #[precompile::view]
    fn deciding_count(handle: &mut impl PrecompileHandle, track_id: u16) -> EvmResult<U256> {
        // DecidingCount:
        // Twox64Concat(8) + TrackIdOf(2) + 4
        handle.record_db_read::<Runtime>(14)?;
        let track_id: TrackIdOf<Runtime> = track_id
            .try_into()
            .map_err(|_| RevertReason::value_is_too_large("Track id type").into())
            .in_field("trackId")?;
        let deciding_count = DecidingCount::<Runtime>::get(track_id);
        log::trace!(
            target: "referendum-precompile", "Track {:?} deciding count is {:?}",
            track_id,
            deciding_count
        );

        Ok(deciding_count.into())
    }

    #[precompile::public("trackIds()")]
    #[precompile::view]
    fn track_ids(_handle: &mut impl PrecompileHandle) -> EvmResult<Vec<u16>> {
        let track_ids: Vec<u16> = Runtime::Tracks::tracks()
            .into_iter()
            .filter_map(|track| track.id.try_into().ok())
            .collect();

        Ok(track_ids)
    }

    #[precompile::public("trackInfo(uint16)")]
    #[precompile::view]
    fn track_info(_handle: &mut impl PrecompileHandle, track_id: u16) -> EvmResult<TrackInfo> {
        let track_id: TrackIdOf<Runtime> = track_id
            .try_into()
            .map_err(|_| RevertReason::value_is_too_large("Track id type").into())
            .in_field("trackId")?;
        let track = Runtime::Tracks::tracks()
            .find(|track| track.id == track_id)
            .ok_or(RevertReason::custom("No such track").in_field("trackId"))?;
        let track_info = &track.info;

        // trim the nulls bytes at the end of the name
        // caused by this https://github.com/paritytech/polkadot-sdk/pull/2072
        let track_name_trimmed: &[u8] = track_info
            .name
            .iter()
            .rposition(|&b| b != 0)
            .map_or(&[], |pos| &track_info.name[..=pos]);

        Ok(TrackInfo {
            name: track_name_trimmed.into(),
            max_deciding: track_info.max_deciding.into(),
            decision_deposit: track_info.decision_deposit.into(),
            prepare_period: track_info.prepare_period.into(),
            decision_period: track_info.decision_period.into(),
            confirm_period: track_info.confirm_period.into(),
            min_enactment_period: track_info.min_enactment_period.into(),
            min_approval: track_info.min_approval.encode().into(),
            min_support: track_info.min_support.encode().into(),
        })
    }

    /// Use Runtime::Tracks::tracks to get the origin for input trackId
    fn track_id_to_origin(track_id: TrackIdOf<Runtime>) -> EvmResult<Box<OriginOf<Runtime>>> {
        let track = Runtime::Tracks::tracks()
            .find(|track| track.id == track_id)
            .ok_or(RevertReason::custom("No such track").in_field("trackId"))?;
        let track_info = &track.info;

        let origin = if track_info.name == str_array("root") {
            frame_system::RawOrigin::Root.into()
        } else {
            GovOrigin::from_str(str::from_utf8(&track_info.name).map_err(|_| {
                RevertReason::custom("Track name is not valid UTF-8").in_field("trackId")
            })?)
            .map_err(|_| {
                RevertReason::custom("Custom origin does not exist for {track_info.name}")
                    .in_field("trackId")
            })?
            .into()
        };
        Ok(Box::new(origin))
    }

    // Helper function for submitAt and submitAfter
    fn submit(
        handle: &mut impl PrecompileHandle,
        track_id: u16,
        proposal: BoundedCallOf<Runtime>,
        enactment_moment: DispatchTime<BlockNumberFor<Runtime>>,
    ) -> EvmResult<u32> {
        log::trace!(
            target: "referendum-precompile",
            "Submitting proposal {:?} [len: {:?}] to track {}",
            proposal.hash(),
            proposal.len(),
            track_id
        );
        // ReferendumCount
        handle.record_db_read::<Runtime>(4)?;
        let referendum_index = ReferendumCount::<Runtime>::get();

        let proposal_origin = Self::track_id_to_origin(
            track_id
                .try_into()
                .map_err(|_| RevertReason::value_is_too_large("Track id type").into())
                .in_field("trackId")?,
        )?;
        let origin = Runtime::AddressMapping::into_account_id(handle.context().caller);

        let call = ReferendaCall::<Runtime>::submit {
            proposal_origin,
            proposal,
            enactment_moment,
        }
        .into();

        <RuntimeHelper<Runtime>>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        Ok(referendum_index)
    }

    #[precompile::public("referendumStatus(uint32)")]
    #[precompile::view]
    fn referendum_status(
        handle: &mut impl PrecompileHandle,
        referendum_index: u32,
    ) -> EvmResult<u8> {
        // ReferendumInfoFor: Blake2128(16) + 4 + ReferendumInfoOf::max_encoded_len
        handle.record_db_read::<Runtime>(
            20 + pallet_referenda::ReferendumInfoOf::<Runtime, ()>::max_encoded_len(),
        )?;

        let status = match ReferendumInfoFor::<Runtime>::get(referendum_index).ok_or(
            RevertReason::custom("Referendum does not exist for index")
                .in_field("referendum_index"),
        )? {
            ReferendumInfo::Ongoing(..) => 0,
            ReferendumInfo::Approved(..) => 1,
            ReferendumInfo::Rejected(..) => 2,
            ReferendumInfo::Cancelled(..) => 3,
            ReferendumInfo::TimedOut(..) => 4,
            ReferendumInfo::Killed(..) => 5,
        };

        Ok(status)
    }

    #[precompile::public("ongoingReferendumInfo(uint32)")]
    #[precompile::view]
    fn ongoing_referendum_info(
        handle: &mut impl PrecompileHandle,
        referendum_index: u32,
    ) -> EvmResult<OngoingReferendumInfo> {
        // ReferendumInfoFor: Blake2128(16) + 4 + ReferendumInfoOf::max_encoded_len
        handle.record_db_read::<Runtime>(
            20 + pallet_referenda::ReferendumInfoOf::<Runtime, ()>::max_encoded_len(),
        )?;

        match ReferendumInfoFor::<Runtime>::get(referendum_index).ok_or(
            RevertReason::custom("Referendum does not exist for index")
                .in_field("referendum_index"),
        )? {
            ReferendumInfo::Ongoing(info) => {
                let track_id = info
                    .track
                    .try_into()
                    .map_err(|_| RevertReason::value_is_too_large("Track id type not u16"))?;
                let (enactment_type, enactment_time) = match info.enactment {
                    DispatchTime::At(x) => (true, x.into()),
                    DispatchTime::After(x) => (false, x.into()),
                };
                let (decision_depositor, decision_deposit) =
                    if let Some(deposit) = info.decision_deposit {
                        (Address(deposit.who.into()), deposit.amount.into())
                    } else {
                        (Address(H160::zero()), U256::zero())
                    };
                let (deciding_since, deciding_confirming_end) =
                    if let Some(deciding_status) = info.deciding {
                        (
                            deciding_status.since.into(),
                            deciding_status.confirming.unwrap_or_default().into(),
                        )
                    } else {
                        (U256::zero(), U256::zero())
                    };
                let (alarm_time, alarm_task_address) =
                    if let Some((time, task_address)) = info.alarm {
                        (time.into(), task_address.encode().into())
                    } else {
                        (U256::zero(), UnboundedBytes::from(&[]))
                    };

                Ok(OngoingReferendumInfo {
                    track_id,
                    origin: info.origin.encode().into(),
                    proposal: info.proposal.encode().into(),
                    enactment_type,
                    enactment_time,
                    submission_time: info.submitted.into(),
                    submission_depositor: Address(info.submission_deposit.who.into()),
                    submission_deposit: info.submission_deposit.amount.into(),
                    decision_depositor,
                    decision_deposit,
                    deciding_since,
                    deciding_confirming_end,
                    ayes: info.tally.ayes(info.track).into(),
                    support: info.tally.support(info.track).deconstruct(),
                    approval: info.tally.approval(info.track).deconstruct(),
                    in_queue: info.in_queue,
                    alarm_time,
                    alarm_task_address,
                })
            }
            _ => Err(RevertReason::custom("Referendum not ongoing").into()),
        }
    }

    #[precompile::public("closedReferendumInfo(uint32)")]
    #[precompile::view]
    fn closed_referendum_info(
        handle: &mut impl PrecompileHandle,
        referendum_index: u32,
    ) -> EvmResult<ClosedReferendumInfo> {
        // ReferendumInfoFor: Blake2128(16) + 4 + ReferendumInfoOf::max_encoded_len
        handle.record_db_read::<Runtime>(
            20 + pallet_referenda::ReferendumInfoOf::<Runtime, ()>::max_encoded_len(),
        )?;

        let get_closed_ref_info =
            |status,
             moment: BlockNumberFor<Runtime>,
             submission_deposit: Option<Deposit<Runtime::AccountId, BalanceOf<Runtime>>>,
             decision_deposit: Option<Deposit<Runtime::AccountId, BalanceOf<Runtime>>>|
             -> ClosedReferendumInfo {
                let (submission_depositor, submission_deposit_amount): (Address, U256) =
                    if let Some(Deposit { who, amount }) = submission_deposit {
                        (Address(who.into()), amount.into())
                    } else {
                        (Address(H160::zero()), U256::zero())
                    };
                let (decision_depositor, decision_deposit_amount) =
                    if let Some(Deposit { who, amount }) = decision_deposit {
                        (Address(who.into()), amount.into())
                    } else {
                        (Address(H160::zero()), U256::zero())
                    };
                ClosedReferendumInfo {
                    status,
                    end: moment.into(),
                    submission_depositor,
                    submission_deposit: submission_deposit_amount,
                    decision_depositor,
                    decision_deposit: decision_deposit_amount,
                }
            };

        match ReferendumInfoFor::<Runtime>::get(referendum_index).ok_or(
            RevertReason::custom("Referendum does not exist for index")
                .in_field("referendum_index"),
        )? {
            ReferendumInfo::Approved(moment, submission_deposit, decision_deposit) => Ok(
                get_closed_ref_info(1, moment, submission_deposit, decision_deposit),
            ),
            ReferendumInfo::Rejected(moment, submission_deposit, decision_deposit) => Ok(
                get_closed_ref_info(2, moment, submission_deposit, decision_deposit),
            ),
            ReferendumInfo::Cancelled(moment, submission_deposit, decision_deposit) => Ok(
                get_closed_ref_info(3, moment, submission_deposit, decision_deposit),
            ),
            ReferendumInfo::TimedOut(moment, submission_deposit, decision_deposit) => Ok(
                get_closed_ref_info(4, moment, submission_deposit, decision_deposit),
            ),
            _ => Err(RevertReason::custom("Referendum not closed").into()),
        }
    }

    #[precompile::public("killedReferendumBlock(uint32)")]
    #[precompile::view]
    fn killed_referendum_block(
        handle: &mut impl PrecompileHandle,
        referendum_index: u32,
    ) -> EvmResult<U256> {
        // ReferendumInfoFor: Blake2128(16) + 4 + ReferendumInfoOf::max_encoded_len
        handle.record_db_read::<Runtime>(
            20 + pallet_referenda::ReferendumInfoOf::<Runtime, ()>::max_encoded_len(),
        )?;

        let block = match ReferendumInfoFor::<Runtime>::get(referendum_index).ok_or(
            RevertReason::custom("Referendum does not exist for index")
                .in_field("referendum_index"),
        )? {
            ReferendumInfo::Killed(b) => b,
            _ => return Err(RevertReason::custom("Referendum not killed").into()),
        };

        Ok(block.into())
    }

    /// Propose a referendum on a privileged action.
    ///
    /// Parameters:
    /// * track_id: The trackId for the origin from which the proposal is to be dispatched.
    /// * proposal_hash: The proposed runtime call hash stored in the preimage pallet.
    /// * proposal_len: The proposed runtime call length.
    /// * block_number: Block number at which proposal is dispatched.
    #[precompile::public("submitAt(uint16,bytes32,uint32,uint32)")]
    fn submit_at(
        handle: &mut impl PrecompileHandle,
        track_id: u16,
        proposal_hash: H256,
        proposal_len: u32,
        block_number: u32,
    ) -> EvmResult<u32> {
        let proposal: BoundedCallOf<Runtime> = Bounded::Lookup {
            hash: proposal_hash.into(),
            len: proposal_len,
        };
        handle.record_log_costs_manual(2, 32 * 2)?;

        let referendum_index = Self::submit(
            handle,
            track_id,
            proposal,
            DispatchTime::At(block_number.into()),
        )?;
        let event = log2(
            handle.context().address,
            SELECTOR_LOG_SUBMITTED_AT,
            H256::from_low_u64_be(track_id as u64),
            solidity::encode_event_data((referendum_index, proposal_hash)),
        );
        event.record(handle)?;

        Ok(referendum_index)
    }

    /// Propose a referendum on a privileged action.
    ///
    /// Parameters:
    /// * track_id: The trackId for the origin from which the proposal is to be dispatched.
    /// * proposal_hash: The proposed runtime call hash stored in the preimage pallet.
    /// * proposal_len: The proposed runtime call length.
    /// * block_number: Block number after which proposal is dispatched.
    #[precompile::public("submitAfter(uint16,bytes32,uint32,uint32)")]
    fn submit_after(
        handle: &mut impl PrecompileHandle,
        track_id: u16,
        proposal_hash: H256,
        proposal_len: u32,
        block_number: u32,
    ) -> EvmResult<u32> {
        let proposal: BoundedCallOf<Runtime> = Bounded::Lookup {
            hash: proposal_hash.into(),
            len: proposal_len,
        };
        handle.record_log_costs_manual(2, 32 * 2)?;

        let referendum_index = Self::submit(
            handle,
            track_id,
            proposal,
            DispatchTime::After(block_number.into()),
        )?;
        let event = log2(
            handle.context().address,
            SELECTOR_LOG_SUBMITTED_AFTER,
            H256::from_low_u64_be(track_id as u64),
            solidity::encode_event_data((referendum_index, proposal_hash)),
        );

        event.record(handle)?;

        Ok(referendum_index)
    }

    /// Post the Decision Deposit for a referendum.
    ///
    /// Parameters:
    /// * index: The index of the submitted referendum whose Decision Deposit is yet to be posted.
    #[precompile::public("placeDecisionDeposit(uint32)")]
    fn place_decision_deposit(handle: &mut impl PrecompileHandle, index: u32) -> EvmResult {
        // ReferendumInfoFor: Blake2128(16) + 4 + ReferendumInfoOf::max_encoded_len
        handle.record_db_read::<Runtime>(
            20 + pallet_referenda::ReferendumInfoOf::<Runtime, ()>::max_encoded_len(),
        )?;
        handle.record_log_costs_manual(1, 32 * 3)?;

        let origin = Runtime::AddressMapping::into_account_id(handle.context().caller);

        let call = ReferendaCall::<Runtime>::place_decision_deposit { index }.into();

        <RuntimeHelper<Runtime>>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        // Once the deposit has been succesfully placed, it is available in the ReferendumStatus.
        let ongoing_referendum = Referenda::<Runtime>::ensure_ongoing(index).map_err(|_| {
            RevertReason::custom("Provided index is not an ongoing referendum").in_field("index")
        })?;
        let decision_deposit: U256 =
            if let Some(decision_deposit) = ongoing_referendum.decision_deposit {
                decision_deposit.amount.into()
            } else {
                U256::zero()
            };
        let event = log1(
            handle.context().address,
            SELECTOR_LOG_DECISION_DEPOSIT_PLACED,
            solidity::encode_event_data((
                index,
                Address(handle.context().caller),
                decision_deposit,
            )),
        );

        event.record(handle)?;
        Ok(())
    }

    /// Refund the Decision Deposit for a closed referendum back to the depositor.
    ///
    /// Parameters:
    /// * index: The index of a closed referendum whose Decision Deposit has not yet been refunded.
    #[precompile::public("refundDecisionDeposit(uint32)")]
    fn refund_decision_deposit(handle: &mut impl PrecompileHandle, index: u32) -> EvmResult {
        handle.record_log_costs_manual(1, 32 * 3)?;
        // ReferendumInfoFor: Blake2128(16) + 4 + ReferendumInfoOf::max_encoded_len
        handle.record_db_read::<Runtime>(
            20 + pallet_referenda::ReferendumInfoOf::<Runtime, ()>::max_encoded_len(),
        )?;
        let (who, refunded_deposit): (H160, U256) = match ReferendumInfoFor::<Runtime>::get(index)
            .ok_or(
            RevertReason::custom("Referendum index does not exist").in_field("index"),
        )? {
            ReferendumInfo::Approved(_, _, Some(d))
            | ReferendumInfo::Rejected(_, _, Some(d))
            | ReferendumInfo::TimedOut(_, _, Some(d))
            | ReferendumInfo::Cancelled(_, _, Some(d)) => (d.who.into(), d.amount.into()),
            // We let the pallet handle the RenferendumInfo validation logic on dispatch.
            _ => (H160::default(), U256::zero()),
        };

        let origin = Runtime::AddressMapping::into_account_id(handle.context().caller);

        let call = ReferendaCall::<Runtime>::refund_decision_deposit { index }.into();

        <RuntimeHelper<Runtime>>::try_dispatch(handle, Some(origin).into(), call, 0)?;
        let event = log1(
            handle.context().address,
            SELECTOR_LOG_DECISION_DEPOSIT_REFUNDED,
            solidity::encode_event_data((index, Address(who), refunded_deposit)),
        );

        event.record(handle)?;
        Ok(())
    }

    /// Refund the Submission Deposit for a closed referendum back to the depositor.
    ///
    /// Parameters:
    /// * index: The index of a closed referendum whose Submission Deposit has not yet been refunded.
    #[precompile::public("refundSubmissionDeposit(uint32)")]
    fn refund_submission_deposit(handle: &mut impl PrecompileHandle, index: u32) -> EvmResult {
        handle.record_log_costs_manual(1, 32 * 3)?;
        // ReferendumInfoFor: Blake2128(16) + 4 + ReferendumInfoOf::max_encoded_len
        handle.record_db_read::<Runtime>(
            20 + pallet_referenda::ReferendumInfoOf::<Runtime, ()>::max_encoded_len(),
        )?;
        let (who, refunded_deposit): (H160, U256) =
            match ReferendumInfoFor::<Runtime>::get(index)
                .ok_or(RevertReason::custom("Referendum index does not exist").in_field("index"))?
            {
                ReferendumInfo::Approved(_, Some(s), _)
                | ReferendumInfo::Cancelled(_, Some(s), _) => (s.who.into(), s.amount.into()),
                // We let the pallet handle the RenferendumInfo validation logic on dispatch.
                _ => (H160::default(), U256::zero()),
            };

        let origin = Runtime::AddressMapping::into_account_id(handle.context().caller);

        let call = ReferendaCall::<Runtime>::refund_submission_deposit { index }.into();

        <RuntimeHelper<Runtime>>::try_dispatch(handle, Some(origin).into(), call, 0)?;

        let event = log1(
            handle.context().address,
            SELECTOR_LOG_SUBMISSION_DEPOSIT_REFUNDED,
            solidity::encode_event_data((index, Address(who), refunded_deposit)),
        );

        event.record(handle)?;

        Ok(())
    }
}

// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

use codec::Encode;
use core::cell::RefCell;
use xcm::prelude::*;
use xcm_executor::{
    traits::{FeeManager, FeeReason, TransactAsset},
    AssetsInHolding,
};

thread_local! {
    pub static IS_WAIVED: RefCell<Vec<FeeReason>> = RefCell::new(vec![]);
    pub static SENDER_OVERRIDE: RefCell<Option<(
        fn(
            &mut Option<Location>,
            &mut Option<Xcm<()>>,
        ) -> Result<(Xcm<()>, Assets), SendError>,
        fn(
            Xcm<()>,
        ) -> Result<XcmHash, SendError>,
    )>> = RefCell::new(None);
    pub static CHARGE_FEES_OVERRIDE: RefCell<Option<
        fn(Location, Assets) -> xcm::latest::Result
    >> = RefCell::new(None);
}

#[allow(dead_code)]
pub fn set_fee_waiver(waived: Vec<FeeReason>) {
    IS_WAIVED.with(|l| l.replace(waived));
}

#[allow(dead_code)]
pub fn set_sender_override(
    validate: fn(&mut Option<Location>, &mut Option<Xcm<()>>) -> SendResult<Xcm<()>>,
    deliver: fn(Xcm<()>) -> Result<XcmHash, SendError>,
) {
    SENDER_OVERRIDE.with(|x| x.replace(Some((validate, deliver))));
}

#[allow(dead_code)]
pub fn clear_sender_override() {
    SENDER_OVERRIDE.with(|x| x.replace(None));
}

#[allow(dead_code)]
pub fn set_charge_fees_override(charge_fees: fn(Location, Assets) -> xcm::latest::Result) {
    CHARGE_FEES_OVERRIDE.with(|x| x.replace(Some(charge_fees)));
}

#[allow(dead_code)]
pub fn clear_charge_fees_override() {
    CHARGE_FEES_OVERRIDE.with(|x| x.replace(None));
}

/// Mock XCM sender with an overridable `validate` and `deliver` function.
pub struct MockXcmSender;

impl SendXcm for MockXcmSender {
    type Ticket = Xcm<()>;

    fn validate(
        dest: &mut Option<Location>,
        xcm: &mut Option<Xcm<()>>,
    ) -> SendResult<Self::Ticket> {
        let r: SendResult<Self::Ticket> = SENDER_OVERRIDE.with(|s| {
            if let Some((ref f, _)) = &*s.borrow() {
                f(dest, xcm)
            } else {
                Ok((xcm.take().unwrap(), Assets::default()))
            }
        });
        r
    }

    fn deliver(ticket: Self::Ticket) -> Result<XcmHash, SendError> {
        let r: Result<XcmHash, SendError> = SENDER_OVERRIDE.with(|s| {
            if let Some((_, ref f)) = &*s.borrow() {
                f(ticket)
            } else {
                let hash = ticket.using_encoded(sp_core::hashing::blake2_256);
                Ok(hash)
            }
        });
        r
    }
}

/// Mock XCM transactor that always succeeds
pub struct SuccessfulTransactor;
impl TransactAsset for SuccessfulTransactor {
    fn can_check_in(_origin: &Location, _what: &Asset, _context: &XcmContext) -> XcmResult {
        Ok(())
    }

    fn can_check_out(_dest: &Location, _what: &Asset, _context: &XcmContext) -> XcmResult {
        Ok(())
    }

    fn deposit_asset(_what: &Asset, _who: &Location, _context: Option<&XcmContext>) -> XcmResult {
        Ok(())
    }

    fn withdraw_asset(
        _what: &Asset,
        _who: &Location,
        _context: Option<&XcmContext>,
    ) -> Result<AssetsInHolding, XcmError> {
        Ok(AssetsInHolding::default())
    }

    fn internal_transfer_asset(
        _what: &Asset,
        _from: &Location,
        _to: &Location,
        _context: &XcmContext,
    ) -> Result<AssetsInHolding, XcmError> {
        Ok(AssetsInHolding::default())
    }
}

pub enum Weightless {}
impl PreparedMessage for Weightless {
    fn weight_of(&self) -> Weight {
        unreachable!();
    }
}

/// Mock the XCM executor with an overridable `charge_fees` function.
pub struct MockXcmExecutor;
impl<C> ExecuteXcm<C> for MockXcmExecutor {
    type Prepared = Weightless;
    fn prepare(_: Xcm<C>) -> Result<Self::Prepared, Xcm<C>> {
        unreachable!()
    }
    fn execute(_: impl Into<Location>, _: Self::Prepared, _: &mut XcmHash, _: Weight) -> Outcome {
        unreachable!()
    }
    fn charge_fees(location: impl Into<Location>, assets: Assets) -> xcm::latest::Result {
        let r: xcm::latest::Result = CHARGE_FEES_OVERRIDE.with(|s| {
            if let Some(ref f) = &*s.borrow() {
                f(location.into(), assets)
            } else {
                Ok(())
            }
        });
        r
    }
}

impl FeeManager for MockXcmExecutor {
    fn is_waived(_: Option<&Location>, r: FeeReason) -> bool {
        IS_WAIVED.with(|l| l.borrow().contains(&r))
    }

    fn handle_fee(_: Assets, _: Option<&XcmContext>, _: FeeReason) {}
}

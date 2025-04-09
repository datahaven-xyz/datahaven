// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
#![cfg_attr(not(feature = "std"), no_std)]
//! # Outbound
//!
//! Common traits and types
pub mod v1;
pub mod v2;

use codec::{Decode, DecodeWithMemTracking, Encode};
use frame_support::PalletError;
use scale_info::TypeInfo;
use sp_arithmetic::traits::{BaseArithmetic, Unsigned};
use sp_core::RuntimeDebug;

pub use snowbridge_verification_primitives::*;

/// The operating mode of Channels and Gateway contract on Ethereum.
#[derive(
	Copy, Clone, Encode, Decode, DecodeWithMemTracking, PartialEq, Eq, RuntimeDebug, TypeInfo,
)]
pub enum OperatingMode {
	/// Normal operations. Allow sending and receiving messages.
	Normal,
	/// Reject outbound messages. This allows receiving governance messages but does now allow
	/// enqueuing of new messages from the Ethereum side. This can be used to close off a
	/// deprecated channel or pause the bridge for upgrade operations.
	RejectingOutboundMessages,
}

/// A trait for getting the local costs associated with sending a message.
pub trait SendMessageFeeProvider {
	type Balance: BaseArithmetic + Unsigned + Copy;

	/// The local component of the message processing fees in native currency
	fn local_fee() -> Self::Balance;
}

/// Reasons why sending to Ethereum could not be initiated
#[derive(
	Copy,
	Clone,
	Encode,
	Decode,
	DecodeWithMemTracking,
	PartialEq,
	Eq,
	RuntimeDebug,
	PalletError,
	TypeInfo,
)]
pub enum SendError {
	/// Message is too large to be safely executed on Ethereum
	MessageTooLarge,
	/// The bridge has been halted for maintenance
	Halted,
	/// Invalid Channel
	InvalidChannel,
	/// Invalid Origin
	InvalidOrigin,
}

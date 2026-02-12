// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
extern crate alloc;

pub mod converter;
pub mod delivery_receipt;
pub mod exporter;
pub mod message;

pub use converter::*;
pub use delivery_receipt::*;
pub use message::*;

use alloc::vec::Vec;
use codec::{Decode, Encode};
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

/// The `XCM::Transact` payload for calling arbitrary smart contracts on Ethereum.
/// On Ethereum, this call will be dispatched by the agent contract acting as a proxy
/// for the XCM origin.
#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo)]
pub enum ContractCall {
    V1 {
        /// Target contract address
        target: [u8; 20],
        /// ABI-encoded calldata
        calldata: Vec<u8>,
        /// Include ether held by the agent contract
        value: u128,
        /// Maximum gas to forward to target contract
        gas: u64,
    },
}

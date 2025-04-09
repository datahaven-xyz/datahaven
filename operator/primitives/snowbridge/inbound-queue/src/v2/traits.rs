// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2025 Snowfork <hello@snowfork.com>
// SPDX-FileCopyrightText: 2021-2025 Parity Technologies (UK) Ltd.
use super::Message;
use sp_core::RuntimeDebug;
use xcm::latest::Xcm;

/// Converts an inbound message from Ethereum to an XCM message that can be
/// executed on a parachain.
pub trait ConvertMessage {
    fn convert(message: Message) -> Result<Xcm<()>, ConvertMessageError>;
}

/// Reason why a message conversion failed.
#[derive(Copy, Clone, RuntimeDebug, PartialEq)]
pub enum ConvertMessageError {
    /// Invalid foreign ERC-20 token ID
    InvalidAsset,
    /// Cannot reachor a foreign ERC-20 asset location.
    CannotReanchor,
    /// Invalid network specified (not from Ethereum)
    InvalidNetwork,
}

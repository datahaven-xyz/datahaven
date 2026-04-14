// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Converts messages from Ethereum to XCM messages
extern crate alloc;

use crate::{v2::IGatewayV2::Payload as GatewayV2Payload, Log};
use alloc::vec;
use alloc::vec::Vec;
use alloy_core::{
    primitives::B256,
    sol,
    sol_types::{SolEvent, SolType},
};
use codec::{Decode, Encode};
use scale_info::TypeInfo;
use sp_core::{RuntimeDebug, H160, H256};

sol! {
    interface IGatewayV2 {
        struct AsNativeTokenERC20 {
            address token_id;
            uint128 value;
        }
        struct AsForeignTokenERC20 {
            bytes32 token_id;
            uint128 value;
        }
        struct EthereumAsset {
            uint8 kind;
            bytes data;
        }
        struct Xcm {
            uint8 kind;
            bytes data;
        }
        struct XcmCreateAsset {
            address token;
            uint8 network;
        }
        struct Payload {
            address origin;
            EthereumAsset[] assets;
            Xcm xcm;
            bytes claimer;
            uint128 value;
            uint128 executionFee;
            uint128 relayerFee;
        }
        event OutboundMessageAccepted(uint64 nonce, Payload payload);
    }
}

impl core::fmt::Debug for IGatewayV2::Payload {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("Payload")
            .field("origin", &self.origin)
            .field("assets", &self.assets)
            .field("xcm", &self.xcm)
            .field("claimer", &self.claimer)
            .field("value", &self.value)
            .field("executionFee", &self.executionFee)
            .field("relayerFee", &self.relayerFee)
            .finish()
    }
}

impl core::fmt::Debug for IGatewayV2::EthereumAsset {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("EthereumAsset")
            .field("kind", &self.kind)
            .field("data", &self.data)
            .finish()
    }
}

impl core::fmt::Debug for IGatewayV2::Xcm {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("Xcm")
            .field("kind", &self.kind)
            .field("data", &self.data)
            .finish()
    }
}

#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo)]
pub enum Payload {
    /// Raw bytes payload. Commonly used to represent raw XCM bytes
    Raw(Vec<u8>),
    /// A token registration template
    CreateAsset { token: H160, network: Network },
}

/// Network enum for cross-chain message destination
#[derive(Clone, Copy, Debug, Eq, PartialEq, Encode, Decode, TypeInfo)]
pub enum Network {
    /// Polkadot network
    Polkadot,
}

/// The ethereum side sends messages which are transcoded into XCM on BH. These messages are
/// self-contained, in that they can be transcoded using only information in the message.
#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo)]
pub struct Message {
    /// The address of the outbound queue on Ethereum that emitted this message as an event log
    pub gateway: H160,
    /// A nonce for enforcing replay protection and ordering.
    pub nonce: u64,
    /// The address on Ethereum that initiated the message.
    pub origin: H160,
    /// The assets sent from Ethereum (ERC-20s).
    pub assets: Vec<EthereumAsset>,
    /// The command originating from the Gateway contract.
    pub xcm: Payload,
    /// The claimer in the case that funds get trapped. Expected to be an XCM::v5::Location.
    pub claimer: Option<Vec<u8>>,
    /// Native ether bridged over from Ethereum
    pub value: u128,
    /// Fee in eth to cover the xcm execution on AH.
    pub execution_fee: u128,
    /// Relayer reward in eth. Needs to cover all costs of sending a message.
    pub relayer_fee: u128,
}

/// An asset that will be transacted on AH. The asset will be reserved/withdrawn and placed into
/// the holding register. The user needs to provide additional xcm to deposit the asset
/// in a beneficiary account.
#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo)]
pub enum EthereumAsset {
    NativeTokenERC20 {
        /// The native token ID
        token_id: H160,
        /// The monetary value of the asset
        value: u128,
    },
    ForeignTokenERC20 {
        /// The foreign token ID
        token_id: H256,
        /// The monetary value of the asset
        value: u128,
    },
}

#[derive(Copy, Clone, RuntimeDebug)]
pub struct MessageDecodeError;

impl TryFrom<&Log> for Message {
    type Error = MessageDecodeError;

    fn try_from(log: &Log) -> Result<Self, Self::Error> {
        // Convert to B256 for Alloy decoding
        let topics: Vec<B256> = log
            .topics
            .iter()
            .map(|x| B256::from_slice(x.as_ref()))
            .collect();

        // Decode the Solidity event from raw logs
        let event = IGatewayV2::OutboundMessageAccepted::decode_raw_log(topics, &log.data, true)
            .map_err(|_| MessageDecodeError)?;

        let payload = event.payload;

        let substrate_assets = Self::extract_assets(&payload)?;

        let xcm = Payload::try_from(&payload)?;

        let mut claimer = None;
        if payload.claimer.len() > 0 {
            claimer = Some(payload.claimer.to_vec());
        }

        let message = Message {
            gateway: log.address,
            nonce: event.nonce,
            origin: H160::from(payload.origin.as_ref()),
            assets: substrate_assets,
            xcm,
            claimer,
            value: payload.value,
            execution_fee: payload.executionFee,
            relayer_fee: payload.relayerFee,
        };

        Ok(message)
    }
}

impl Message {
    fn extract_assets(
        payload: &IGatewayV2::Payload,
    ) -> Result<Vec<EthereumAsset>, MessageDecodeError> {
        let mut substrate_assets = vec![];
        for asset in &payload.assets {
            substrate_assets.push(EthereumAsset::try_from(asset)?);
        }
        Ok(substrate_assets)
    }
}

impl TryFrom<&IGatewayV2::Payload> for Payload {
    type Error = MessageDecodeError;

    fn try_from(payload: &GatewayV2Payload) -> Result<Self, Self::Error> {
        let xcm = match payload.xcm.kind {
            0 => Payload::Raw(payload.xcm.data.to_vec()),
            1 => {
                let create_asset = IGatewayV2::XcmCreateAsset::abi_decode(&payload.xcm.data, true)
                    .map_err(|_| MessageDecodeError)?;
                // Convert u8 network to Network enum
                let network = match create_asset.network {
                    0 => Network::Polkadot,
                    _ => return Err(MessageDecodeError),
                };
                Payload::CreateAsset {
                    token: H160::from(create_asset.token.as_ref()),
                    network,
                }
            }
            _ => return Err(MessageDecodeError),
        };
        Ok(xcm)
    }
}

impl TryFrom<&IGatewayV2::EthereumAsset> for EthereumAsset {
    type Error = MessageDecodeError;

    fn try_from(asset: &IGatewayV2::EthereumAsset) -> Result<EthereumAsset, Self::Error> {
        let asset = match asset.kind {
            0 => {
                let native_data = IGatewayV2::AsNativeTokenERC20::abi_decode(&asset.data, true)
                    .map_err(|_| MessageDecodeError)?;
                EthereumAsset::NativeTokenERC20 {
                    token_id: H160::from(native_data.token_id.as_ref()),
                    value: native_data.value,
                }
            }
            1 => {
                let foreign_data = IGatewayV2::AsForeignTokenERC20::abi_decode(&asset.data, true)
                    .map_err(|_| MessageDecodeError)?;
                EthereumAsset::ForeignTokenERC20 {
                    token_id: H256::from(foreign_data.token_id.as_ref()),
                    value: foreign_data.value,
                }
            }
            _ => return Err(MessageDecodeError),
        };
        Ok(asset)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use frame_support::assert_ok;
    use hex_literal::hex;
    use sp_core::H160;

    #[test]
    fn test_decode() {
        let log = Log{
			address: hex!("b1185ede04202fe62d38f5db72f71e38ff3e8305").into(),
			topics: vec![hex!("550e2067494b1736ea5573f2d19cdc0ac95b410fff161bf16f11c6229655ec9c").into()],
			data: hex!("00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b1185ede04202fe62d38f5db72f71e38ff3e830500000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000009184e72a0000000000000000000000000000000000000000000000000000000015d3ef798000000000000000000000000000000000000000000000000000000015d3ef798000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000040000000000000000000000000b8ea8cb425d85536b158d661da1ef0895bb92f1d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000").to_vec(),
		};

        let result = Message::try_from(&log);
        assert_ok!(result.clone());
        let message = result.unwrap();

        assert_eq!(
            H160::from(hex!("b1185ede04202fe62d38f5db72f71e38ff3e8305")),
            message.gateway
        );
        assert_eq!(
            H160::from(hex!("b1185ede04202fe62d38f5db72f71e38ff3e8305")),
            message.origin
        );
    }
}

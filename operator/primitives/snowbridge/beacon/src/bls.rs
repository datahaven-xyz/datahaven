// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use crate::{PublicKey, Signature};
use codec::{Decode, DecodeWithMemTracking, Encode};
use frame_support::{ensure, PalletError};
pub use milagro_bls::{
    AggregatePublicKey, AggregateSignature, PublicKey as PublicKeyPrepared,
    Signature as SignaturePrepared,
};
use scale_info::TypeInfo;
use sp_core::H256;
use sp_runtime::RuntimeDebug;
use sp_std::prelude::*;

#[derive(
    Copy,
    Clone,
    Encode,
    Decode,
    DecodeWithMemTracking,
    Eq,
    PartialEq,
    TypeInfo,
    RuntimeDebug,
    PalletError,
)]
pub enum BlsError {
    InvalidSignature,
    InvalidPublicKey,
    InvalidAggregatePublicKeys,
    SignatureVerificationFailed,
}

/// fast_aggregate_verify optimized with aggregate key subtracting absent ones.
pub fn fast_aggregate_verify(
    aggregate_pubkey: &PublicKeyPrepared,
    absent_pubkeys: &Vec<PublicKeyPrepared>,
    message: H256,
    signature: &Signature,
) -> Result<(), BlsError> {
    let agg_sig = prepare_aggregate_signature(signature)?;
    let agg_key = prepare_aggregate_pubkey_from_absent(aggregate_pubkey, absent_pubkeys)?;
    fast_aggregate_verify_pre_aggregated(agg_sig, agg_key, message)
}

/// Decompress one public key into a point in G1.
pub fn prepare_milagro_pubkey(pubkey: &PublicKey) -> Result<PublicKeyPrepared, BlsError> {
    PublicKeyPrepared::from_bytes_unchecked(&pubkey.0).map_err(|_| BlsError::InvalidPublicKey)
}

/// Prepare for G1 public keys.
pub fn prepare_g1_pubkeys(pubkeys: &[PublicKey]) -> Result<Vec<PublicKeyPrepared>, BlsError> {
    pubkeys
        .iter()
        // Deserialize one public key from compressed bytes
        .map(prepare_milagro_pubkey)
        .collect::<Result<Vec<PublicKeyPrepared>, BlsError>>()
}

/// Prepare for G1 AggregatePublicKey.
pub fn prepare_aggregate_pubkey(
    pubkeys: &[PublicKeyPrepared],
) -> Result<AggregatePublicKey, BlsError> {
    AggregatePublicKey::into_aggregate(pubkeys).map_err(|_| BlsError::InvalidPublicKey)
}

/// Prepare for G1 AggregatePublicKey.
pub fn prepare_aggregate_pubkey_from_absent(
    aggregate_key: &PublicKeyPrepared,
    absent_pubkeys: &Vec<PublicKeyPrepared>,
) -> Result<AggregatePublicKey, BlsError> {
    let mut aggregate_pubkey = AggregatePublicKey::from_public_key(aggregate_key);
    if !absent_pubkeys.is_empty() {
        let absent_aggregate_key = prepare_aggregate_pubkey(absent_pubkeys)?;
        aggregate_pubkey.point.sub(&absent_aggregate_key.point);
    }
    Ok(AggregatePublicKey {
        point: aggregate_pubkey.point,
    })
}

/// Prepare for G2 AggregateSignature, normally more expensive than G1 operation.
pub fn prepare_aggregate_signature(signature: &Signature) -> Result<AggregateSignature, BlsError> {
    Ok(AggregateSignature::from_signature(
        &SignaturePrepared::from_bytes(&signature.0).map_err(|_| BlsError::InvalidSignature)?,
    ))
}

/// fast_aggregate_verify_pre_aggregated which is the most expensive call in beacon light client.
pub fn fast_aggregate_verify_pre_aggregated(
    agg_sig: AggregateSignature,
    aggregate_key: AggregatePublicKey,
    message: H256,
) -> Result<(), BlsError> {
    ensure!(
        agg_sig.fast_aggregate_verify_pre_aggregated(&message[..], &aggregate_key),
        BlsError::SignatureVerificationFailed
    );
    Ok(())
}

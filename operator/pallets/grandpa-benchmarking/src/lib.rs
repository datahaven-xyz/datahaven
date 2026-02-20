#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

use sp_consensus_grandpa::AuthorityId as GrandpaId;

pub struct Pallet<T: Config>(pallet_grandpa::Pallet<T>);

/// Benchmarking configuration for `pallet-grandpa` in DataHaven.
///
/// This is a small wrapper crate (similar to `pallet-session-benchmarking`) so we can
/// provide benchmarks for GRANDPA extrinsics that upstream `pallet-grandpa` does not
/// expose in its own benchmarking suite.
pub trait Config:
    pallet_grandpa::Config<KeyOwnerProof = sp_session::MembershipProof>
    + pallet_session::Config
    + pallet_session::historical::Config
{
    /// Build the runtime's session keys type (`T::Keys`) using the provided GRANDPA authority id.
    ///
    /// The runtime should fill other key types (BABE/IM-ONLINE/BEEFY/etc) with deterministic
    /// values suitable for benchmarking.
    fn benchmark_session_keys(grandpa: GrandpaId) -> Self::Keys;
}

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

#[cfg(all(test, feature = "std"))]
mod tests {
    use codec::Encode;
    use sp_consensus_grandpa;
    use sp_core::{ed25519, Pair as PairTrait};
    use sp_runtime::traits::{BlakeTwo256, Hash as HashT};

    /// Run with: cargo test -p pallet-grandpa-benchmarking --features std -- test_generate_equivocation_blob --nocapture
    /// Then paste the printed bytes into PREENCODED_EQUIVOCATION_PROOF in benchmarking.rs.
    #[test]
    fn test_generate_equivocation_blob() {
        let seed = "0x9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
        let pair = ed25519::Pair::from_string(seed, None).expect("valid seed");
        let set_id: u64 = 0;
        let round: u64 = 1;

        let h1 = BlakeTwo256::hash_of(&1u32);
        let h2 = BlakeTwo256::hash_of(&2u32);
        let prevote1 = finality_grandpa::Prevote {
            target_hash: h1,
            target_number: 1u32,
        };
        let prevote2 = finality_grandpa::Prevote {
            target_hash: h2,
            target_number: 2u32,
        };

        let msg1 = finality_grandpa::Message::Prevote(prevote1.clone());
        let msg2 = finality_grandpa::Message::Prevote(prevote2.clone());
        let payload1 = sp_consensus_grandpa::localized_payload(round, set_id, &msg1);
        let payload2 = sp_consensus_grandpa::localized_payload(round, set_id, &msg2);

        let sig1 = pair.sign(&payload1);
        let sig2 = pair.sign(&payload2);

        let equivocation = finality_grandpa::Equivocation {
            round_number: round,
            identity: sp_consensus_grandpa::AuthorityId::from(pair.public()),
            first: (prevote1, sig1.into()),
            second: (prevote2, sig2.into()),
        };

        let proof = sp_consensus_grandpa::EquivocationProof::<sp_core::H256, u32>::new(
            set_id,
            equivocation.into(),
        );
        let encoded = proof.encode();
        println!(
            "PREENCODED_EQUIVOCATION_PROOF (len={}): {:?}",
            encoded.len(),
            encoded
        );
    }
}

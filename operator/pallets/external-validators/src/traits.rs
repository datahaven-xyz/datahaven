use parity_scale_codec::{Decode, Encode, MaxEncodedLen};
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;
use sp_std::vec::Vec;

/// Information regarding the active era (era in used in session).
#[derive(Clone, Encode, Decode, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct ActiveEraInfo {
    /// Index of era.
    pub index: EraIndex,
    /// Moment of start expressed as millisecond from `$UNIX_EPOCH`.
    ///
    /// Start can be none if start hasn't been set for the era yet,
    /// Start is set on the first on_finalize of the era to guarantee usage of `Time`.
    pub start: Option<u64>,
}

/// Counter for the number of eras that have passed.
pub type EraIndex = u32;

#[allow(dead_code)]
pub trait EraIndexProvider {
    fn active_era() -> ActiveEraInfo;
    fn era_to_session_start(era_index: EraIndex) -> Option<u32>;
}

#[allow(dead_code)]
pub trait ValidatorProvider<ValidatorId> {
    fn validators() -> Vec<ValidatorId>;
}

#[allow(dead_code)]
pub trait InvulnerablesProvider<ValidatorId> {
    fn invulnerables() -> Vec<ValidatorId>;
}

pub trait OnEraStart {
    fn on_era_start(_era_index: EraIndex, _session_start: u32, _external_idx: u64) {}
}

#[impl_trait_for_tuples::impl_for_tuples(5)]
impl OnEraStart for Tuple {
    fn on_era_start(era_index: EraIndex, session_start: u32, external_idx: u64) {
        for_tuples!( #( Tuple::on_era_start(era_index, session_start, external_idx); )* );
    }
}

pub trait OnEraEnd {
    fn on_era_end(_era_index: EraIndex) {}
}

#[impl_trait_for_tuples::impl_for_tuples(5)]
impl OnEraEnd for Tuple {
    fn on_era_end(era_index: EraIndex) {
        for_tuples!( #( Tuple::on_era_end(era_index); )* );
    }
}

// A trait to retrieve the external index provider identifying some set of data
// In starlight, used to retrieve the external index associated to validators
#[allow(dead_code)]
pub trait ExternalIndexProvider {
    fn get_external_index() -> u64;
}

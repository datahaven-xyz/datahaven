//! Custom governance origins for DataHaven Testnet Runtime
//!
//! This module defines custom origins that can be used in governance,
//! similar to Moonbeam's approach with different privilege levels and capabilities.

//! Custom origins for governance interventions.
pub use custom_origins::*;

#[frame_support::pallet]
pub mod custom_origins {
    use frame_support::pallet_prelude::*;
    use strum_macros::EnumString;

    #[pallet::config]
    pub trait Config: frame_system::Config {}

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[derive(
        PartialEq, Eq, Clone, MaxEncodedLen, Encode, Decode, TypeInfo, RuntimeDebug, EnumString,
    )]
    #[strum(serialize_all = "snake_case")]
    #[pallet::origin]
    pub enum Origin {
        /// Origin able to dispatch a whitelisted call.
        WhitelistedCaller,
        /// General admin
        GeneralAdmin,
        /// Origin able to cancel referenda.
        ReferendumCanceller,
        /// Origin able to kill referenda.
        ReferendumKiller,
        /// Fast General Admin
        FastGeneralAdmin,
    }

    macro_rules! decl_unit_ensures {
		( $name:ident: $success_type:ty = $success:expr ) => {
			pub struct $name;
			impl<O: Into<Result<Origin, O>> + From<Origin>>
				EnsureOrigin<O> for $name
			{
				type Success = $success_type;
				fn try_origin(o: O) -> Result<Self::Success, O> {
					o.into().and_then(|o| match o {
						Origin::$name => Ok($success),
						r => Err(O::from(r)),
					})
				}
				#[cfg(feature = "runtime-benchmarks")]
				fn try_successful_origin() -> Result<O, ()> {
					Ok(O::from(Origin::$name))
				}
			}
		};
		( $name:ident ) => { decl_unit_ensures! { $name : () = () } };
		( $name:ident: $success_type:ty = $success:expr, $( $rest:tt )* ) => {
			decl_unit_ensures! { $name: $success_type = $success }
			decl_unit_ensures! { $( $rest )* }
		};
		( $name:ident, $( $rest:tt )* ) => {
			decl_unit_ensures! { $name }
			decl_unit_ensures! { $( $rest )* }
		};
		() => {}
	}
    decl_unit_ensures!(
        ReferendumCanceller,
        ReferendumKiller,
        WhitelistedCaller,
        GeneralAdmin,
        FastGeneralAdmin,
    );
}

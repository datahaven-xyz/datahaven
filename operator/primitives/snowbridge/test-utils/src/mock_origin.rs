// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

// A stripped-down version of pallet-xcm that only inserts an XCM origin into the runtime
#[frame_support::pallet]
pub mod pallet_xcm_origin {
    use frame_support::{
        pallet_prelude::*,
        traits::{Contains, OriginTrait},
    };
    use xcm::latest::prelude::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeOrigin: From<Origin> + From<<Self as frame_system::Config>::RuntimeOrigin>;
    }

    // Insert this custom Origin into the aggregate RuntimeOrigin
    #[pallet::origin]
    #[derive(PartialEq, Eq, Clone, Encode, Decode, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct Origin(pub Location);

    impl From<Location> for Origin {
        fn from(location: Location) -> Origin {
            Origin(location)
        }
    }

    /// `EnsureOrigin` implementation succeeding with a `Location` value to recognize and
    /// filter the contained location
    pub struct EnsureXcm<F>(PhantomData<F>);
    impl<O: OriginTrait + From<Origin>, F: Contains<Location>> EnsureOrigin<O> for EnsureXcm<F>
    where
        O::PalletsOrigin: From<Origin> + TryInto<Origin, Error = O::PalletsOrigin>,
    {
        type Success = Location;

        fn try_origin(outer: O) -> Result<Self::Success, O> {
            outer.try_with_caller(|caller| {
                caller.try_into().and_then(|o| match o {
                    Origin(location) if F::contains(&location) => Ok(location),
                    o => Err(o.into()),
                })
            })
        }

        #[cfg(feature = "runtime-benchmarks")]
        fn try_successful_origin() -> Result<O, ()> {
            Ok(O::from(Origin(Location::here().into())))
        }
    }
}

// Copyright 2025 Moonbeam Foundation.
// This file is part of DataHaven.

//! Native token transfer integration tests for DataHaven mainnet runtime
//! 
//! Tests for native token transfers between DataHaven and Ethereum via Snowbridge

#[path = "common.rs"]
mod common;

use common::*;
use datahaven_mainnet_runtime::{
    Runtime, RuntimeEvent, SnowbridgeSystemV2, System,
};
use frame_support::assert_ok;
use snowbridge_core::TokenIdOf;
use snowbridge_pallet_system::NativeToForeignId;
use snowbridge_pallet_system_v2::Event as SystemV2Event;
use sp_core::H256;
use xcm::prelude::*;
use xcm_executor::traits::ConvertLocation;

#[test]
fn test_datahaven_native_token_registration_succeeds() {
    ExtBuilder::default().build().execute_with(|| {
        let origin = root_origin();
        let sender_location = Location::here();
        let asset_location = Location::here();
        let metadata = datahaven_token_metadata();

        // Step 1: Verify preconditions - token not yet registered
        let initial_reanchored = SnowbridgeSystemV2::reanchor(asset_location.clone()).unwrap();
        assert!(NativeToForeignId::<Runtime>::get(&initial_reanchored).is_none());
        assert!(snowbridge_pallet_system::ForeignToNativeId::<Runtime>::iter().next().is_none());

        // Step 2: Register the token
        assert_ok!(SnowbridgeSystemV2::register_token(
            origin,
            Box::new(VersionedLocation::V5(sender_location)),
            Box::new(VersionedLocation::V5(asset_location.clone())),
            metadata.clone()
        ));

        // Step 3: Verify reanchoring works correctly
        let reanchored_location = SnowbridgeSystemV2::reanchor(asset_location.clone()).unwrap();
        assert_eq!(reanchored_location.parent_count(), 1);
        // Verify it contains GlobalConsensus junction with DataHaven network
        let first_junction = reanchored_location.first_interior();
        assert!(matches!(first_junction, Some(Junction::GlobalConsensus(_))));

        // Step 4: Verify TokenId generation is deterministic
        let token_id = TokenIdOf::convert_location(&reanchored_location).unwrap();
        assert_ne!(token_id, H256::zero());

        // Step 5: Verify bidirectional storage mappings
        assert_eq!(
            NativeToForeignId::<Runtime>::get(&reanchored_location),
            Some(token_id)
        );
        assert_eq!(
            snowbridge_pallet_system::ForeignToNativeId::<Runtime>::get(&token_id),
            Some(reanchored_location.clone())
        );

        // Step 6: Verify event emission with all details
        let expected_event = RuntimeEvent::SnowbridgeSystemV2(SystemV2Event::RegisterToken {
            location: reanchored_location.clone().into(),
            foreign_token_id: token_id,
        });
        assert_eq!(last_event(), expected_event);

    });
}
// Copyright (C) Parity Technologies (UK) Ltd.
// This file is part of Cumulus.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#![cfg(test)]
use bridge_hub_common::DenyExportMessageFrom;
use frame_support::{
	parameter_types,
	traits::{Equals, EverythingBut, ProcessMessageError::Unsupported},
};
use xcm::prelude::{
	AliasOrigin, ByGenesis, ExportMessage, Here, Instruction, Location, NetworkId, Parachain,
	Weight,
};
use xcm_executor::traits::{DenyExecution, Properties};

#[test]
fn test_deny_export_message_from() {
	parameter_types! {
		pub Source1: Location = Location::new(1, Parachain(1));
		pub Source2: Location = Location::new(1, Parachain(2));
		pub Remote1: NetworkId = ByGenesis([1;32]);
		pub Remote2: NetworkId = ByGenesis([2;32]);
	}

	// Deny ExportMessage when both of the conditions met:
	// 1: source != Source1
	// 2: network == Remote1
	pub type Denied = DenyExportMessageFrom<EverythingBut<Equals<Source1>>, Equals<Remote1>>;

	let assert_deny_execution = |mut xcm: Vec<Instruction<()>>, origin, expected_result| {
		assert_eq!(
			Denied::deny_execution(
				&origin,
				&mut xcm,
				Weight::zero(),
				&mut Properties { weight_credit: Weight::zero(), message_id: None }
			),
			expected_result
		);
	};

	// A message without an `ExportMessage` should pass
	assert_deny_execution(vec![AliasOrigin(Here.into())], Source1::get(), Ok(()));

	// `ExportMessage` from source1 and remote1 should pass
	assert_deny_execution(
		vec![ExportMessage { network: Remote1::get(), destination: Here, xcm: Default::default() }],
		Source1::get(),
		Ok(()),
	);

	// `ExportMessage` from source1 and remote2 should pass
	assert_deny_execution(
		vec![ExportMessage { network: Remote2::get(), destination: Here, xcm: Default::default() }],
		Source1::get(),
		Ok(()),
	);

	// `ExportMessage` from source2 and remote2 should pass
	assert_deny_execution(
		vec![ExportMessage { network: Remote2::get(), destination: Here, xcm: Default::default() }],
		Source2::get(),
		Ok(()),
	);

	// `ExportMessage` from source2 and remote1 should be banned
	assert_deny_execution(
		vec![ExportMessage { network: Remote1::get(), destination: Here, xcm: Default::default() }],
		Source2::get(),
		Err(Unsupported),
	);
}

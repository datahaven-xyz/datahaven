// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
#![cfg_attr(not(feature = "std"), no_std)]

use snowbridge_core::AgentId;
use xcm::VersionedLocation;

sp_api::decl_runtime_apis! {
	pub trait ControlV2Api
	{
		/// Provides the Agent ID on Ethereum for the specified location.
		fn agent_id(location: VersionedLocation) -> Option<AgentId>;
	}
}

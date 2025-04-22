// Copyright (C) Parity Technologies (UK) Ltd.
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

//! Custom XCM implementation.

use frame_support::traits::Get;
use xcm::{
	latest::prelude::*,
	prelude::{GetVersion, XcmVersion},
};

/// Adapter for the implementation of `GetVersion`, which attempts to find the minimal
/// configured XCM version between the destination `dest` and the bridge hub location provided as
/// `Get<Location>`.
pub struct XcmVersionOfDestAndRemoteBridge<Version, RemoteBridge>(
	sp_std::marker::PhantomData<(Version, RemoteBridge)>,
);
impl<Version: GetVersion, RemoteBridge: Get<Location>> GetVersion
	for XcmVersionOfDestAndRemoteBridge<Version, RemoteBridge>
{
	fn get_version_for(dest: &Location) -> Option<XcmVersion> {
		let dest_version = Version::get_version_for(dest);
		let bridge_hub_version = Version::get_version_for(&RemoteBridge::get());

		match (dest_version, bridge_hub_version) {
			(Some(dv), Some(bhv)) => Some(sp_std::cmp::min(dv, bhv)),
			(Some(dv), None) => Some(dv),
			(None, Some(bhv)) => Some(bhv),
			(None, None) => None,
		}
	}
}

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
//! Custom digest items

use codec::{Decode, Encode};
use sp_core::{RuntimeDebug, H256};
use sp_runtime::generic::DigestItem;

/// Custom header digest items, inserted as DigestItem::Other
#[derive(Encode, Decode, Copy, Clone, Eq, PartialEq, RuntimeDebug)]
pub enum CustomDigestItem {
	#[codec(index = 0)]
	/// Merkle root of outbound Snowbridge messages.
	Snowbridge(H256),
	#[codec(index = 1)]
	/// Merkle root of outbound Snowbridge V2 messages.
	SnowbridgeV2(H256),
}

/// Convert custom application digest item into a concrete digest item
impl From<CustomDigestItem> for DigestItem {
	fn from(val: CustomDigestItem) -> Self {
		DigestItem::Other(val.encode())
	}
}

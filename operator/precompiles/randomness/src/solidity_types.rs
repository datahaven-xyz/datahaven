// Copyright 2019-2025 PureStake Inc.
// This file is part of Moonbeam.

// Moonbeam is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Moonbeam is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Moonbeam.  If not, see <http://www.gnu.org/licenses/>.

//! Solidity types for randomness precompile.
use precompile_utils::{
	prelude::*,
	solidity::codec::{Reader, Writer},
};

pub enum RequestStatus {
	DoesNotExist,
	Pending,
	Ready,
	Expired,
}

pub enum RandomnessSource {
	LocalVRF,
	RelayBabeEpoch,
}

impl solidity::Codec for RequestStatus {
	fn read(reader: &mut Reader) -> MayRevert<Self> {
		match reader.read().in_field("variant")? {
			0u8 => Ok(RequestStatus::DoesNotExist),
			1u8 => Ok(RequestStatus::Pending),
			2u8 => Ok(RequestStatus::Ready),
			3u8 => Ok(RequestStatus::Expired),
			_ => Err(RevertReason::custom("Unknown RequestStatus variant").into()),
		}
	}

	fn write(writer: &mut Writer, value: Self) {
		let encoded: u8 = match value {
			RequestStatus::DoesNotExist => 0u8,
			RequestStatus::Pending => 1u8,
			RequestStatus::Ready => 2u8,
			RequestStatus::Expired => 3u8,
		};
		solidity::Codec::write(writer, encoded);
	}

	fn has_static_size() -> bool {
		true
	}

	fn signature() -> String {
		u8::signature()
	}
}

impl solidity::Codec for RandomnessSource {
	fn read(reader: &mut Reader) -> MayRevert<Self> {
		match reader.read().in_field("variant")? {
			0u8 => Ok(RandomnessSource::LocalVRF),
			1u8 => Ok(RandomnessSource::RelayBabeEpoch),
			_ => Err(RevertReason::custom("Unknown RandomnessSource variant").into()),
		}
	}

	fn write(writer: &mut Writer, value: Self) {
		let encoded: u8 = match value {
			RandomnessSource::LocalVRF => 0u8,
			RandomnessSource::RelayBabeEpoch => 1u8,
		};
		solidity::Codec::write(writer, encoded);
	}

	fn has_static_size() -> bool {
		true
	}

	fn signature() -> String {
		u8::signature()
	}
}

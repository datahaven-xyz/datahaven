// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use sp_core::U256;

use core::fmt::Formatter;
use serde::{Deserialize, Deserializer};

// helper to deserialize arbitrary arrays like [T; N]
pub mod arrays {
	use std::marker::PhantomData;

	use serde::{
		de::{SeqAccess, Visitor},
		ser::SerializeTuple,
		Deserialize, Deserializer, Serialize, Serializer,
	};

	pub fn serialize<S: Serializer, T: Serialize, const N: usize>(
		data: &[T; N],
		ser: S,
	) -> Result<S::Ok, S::Error> {
		let mut s = ser.serialize_tuple(N)?;
		for item in data {
			s.serialize_element(item)?;
		}
		s.end()
	}

	struct ArrayVisitor<T, const N: usize>(PhantomData<T>);

	impl<'de, T, const N: usize> Visitor<'de> for ArrayVisitor<T, N>
	where
		T: Deserialize<'de>,
	{
		type Value = [T; N];

		fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
			formatter.write_str(&format!("an array of length {}", N))
		}

		#[inline]
		fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
		where
			A: SeqAccess<'de>,
		{
			// can be optimized using MaybeUninit
			let mut data = Vec::with_capacity(N);
			for _ in 0..N {
				match (seq.next_element())? {
					Some(val) => data.push(val),
					None => return Err(serde::de::Error::invalid_length(N, &self)),
				}
			}
			match data.try_into() {
				Ok(arr) => Ok(arr),
				Err(_) => unreachable!(),
			}
		}
	}

	pub fn deserialize<'de, D, T, const N: usize>(deserializer: D) -> Result<[T; N], D::Error>
	where
		D: Deserializer<'de>,
		T: Deserialize<'de>,
	{
		deserializer.deserialize_tuple(N, ArrayVisitor::<T, N>(PhantomData))
	}
}

pub(crate) fn from_hex_to_bytes<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
where
	D: Deserializer<'de>,
{
	let s = String::deserialize(deserializer)?;

	let str_without_0x = match s.strip_prefix("0x") {
		Some(val) => val,
		None => &s,
	};

	let hex_bytes = match hex::decode(str_without_0x) {
		Ok(bytes) => bytes,
		Err(e) => return Err(serde::de::Error::custom(e.to_string())),
	};

	Ok(hex_bytes)
}

pub(crate) fn from_int_to_u256<'de, D>(deserializer: D) -> Result<U256, D::Error>
where
	D: Deserializer<'de>,
{
	let number = u128::deserialize(deserializer)?;

	Ok(U256::from(number))
}

pub struct HexVisitor<const LENGTH: usize>();

impl<'de, const LENGTH: usize> serde::de::Visitor<'de> for HexVisitor<LENGTH> {
	type Value = [u8; LENGTH];

	fn expecting(&self, formatter: &mut Formatter) -> sp_std::fmt::Result {
		formatter.write_str("a hex string with an '0x' prefix")
	}

	fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
	where
		E: serde::de::Error,
	{
		let stripped = match v.strip_prefix("0x") {
			Some(stripped) => stripped,
			None => v,
		};

		let decoded = match hex::decode(stripped) {
			Ok(decoded) => decoded,
			Err(e) => return Err(serde::de::Error::custom(e.to_string())),
		};
		if decoded.len() != LENGTH {
			return Err(serde::de::Error::custom("publickey expected to be 48 characters"))
		}

		let data: Self::Value = decoded
			.try_into()
			.map_err(|_e| serde::de::Error::custom("hex data has unexpected length"))?;

		Ok(data)
	}
}

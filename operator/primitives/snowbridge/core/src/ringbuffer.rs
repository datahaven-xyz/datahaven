// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use codec::FullCodec;
use core::{cmp::Ord, marker::PhantomData, ops::Add};
use frame_support::storage::{types::QueryKindTrait, StorageMap, StorageValue};
use sp_core::{Get, GetDefault};
use sp_runtime::traits::{One, Zero};

/// Trait object presenting the ringbuffer interface.
pub trait RingBufferMap<Key, Value, QueryKind>
where
	Key: FullCodec,
	Value: FullCodec,
	QueryKind: QueryKindTrait<Value, GetDefault>,
{
	/// Insert a map entry.
	fn insert(k: Key, v: Value);

	/// Check if map contains a key
	fn contains_key(k: Key) -> bool;

	/// Get the value of the key
	fn get(k: Key) -> QueryKind::Query;
}

pub struct RingBufferMapImpl<Index, B, CurrentIndex, Intermediate, M, QueryKind>(
	PhantomData<(Index, B, CurrentIndex, Intermediate, M, QueryKind)>,
);

/// Ringbuffer implementation based on `RingBufferTransient`
impl<Key, Value, Index, B, CurrentIndex, Intermediate, M, QueryKind>
	RingBufferMap<Key, Value, QueryKind>
	for RingBufferMapImpl<Index, B, CurrentIndex, Intermediate, M, QueryKind>
where
	Key: FullCodec + Clone,
	Value: FullCodec,
	Index: Ord + One + Zero + Add<Output = Index> + Copy + FullCodec + Eq,
	B: Get<Index>,
	CurrentIndex: StorageValue<Index, Query = Index>,
	Intermediate: StorageMap<Index, Key, Query = Key>,
	M: StorageMap<Key, Value, Query = QueryKind::Query>,
	QueryKind: QueryKindTrait<Value, GetDefault>,
{
	/// Insert a map entry.
	fn insert(k: Key, v: Value) {
		let bound = B::get();
		let mut current_index = CurrentIndex::get();

		// Adding one here as bound denotes number of items but our index starts with zero.
		if (current_index + Index::one()) >= bound {
			current_index = Index::zero();
		} else {
			current_index = current_index + Index::one();
		}

		// Deleting earlier entry if it exists
		if Intermediate::contains_key(current_index) {
			let older_key = Intermediate::get(current_index);
			M::remove(older_key);
		}

		Intermediate::insert(current_index, k.clone());
		CurrentIndex::set(current_index);
		M::insert(k, v);
	}

	/// Check if map contains a key
	fn contains_key(k: Key) -> bool {
		M::contains_key(k)
	}

	/// Get the value associated with key
	fn get(k: Key) -> M::Query {
		M::get(k)
	}
}

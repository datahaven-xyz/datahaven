// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
use frame_support::storage::StorageMap;
use sp_std::marker::PhantomData;

/// Sparse bitmap interface.
pub trait SparseBitmap<BitMap>
where
	BitMap: StorageMap<u128, u128, Query = u128>,
{
	fn get(index: u128) -> bool;
	fn set(index: u128);
}

/// Sparse bitmap implementation.
pub struct SparseBitmapImpl<BitMap>(PhantomData<BitMap>);

impl<BitMap> SparseBitmapImpl<BitMap>
where
	BitMap: StorageMap<u128, u128, Query = u128>,
{
	/// Computes the bucket index and the bit mask for a given bit index.
	/// Each bucket contains 128 bits.
	fn compute_bucket_and_mask(index: u128) -> (u128, u128) {
		(index >> 7, 1u128 << (index & 127))
	}
}

impl<BitMap> SparseBitmap<BitMap> for SparseBitmapImpl<BitMap>
where
	BitMap: StorageMap<u128, u128, Query = u128>,
{
	fn get(index: u128) -> bool {
		// Calculate bucket and mask
		let (bucket, mask) = Self::compute_bucket_and_mask(index);

		// Retrieve bucket and check bit
		let bucket_value = BitMap::get(bucket);
		bucket_value & mask != 0
	}

	fn set(index: u128) {
		// Calculate bucket and mask
		let (bucket, mask) = Self::compute_bucket_and_mask(index);

		// Mutate the storage to set the bit
		BitMap::mutate(bucket, |value| {
			*value |= mask; // Set the bit in the bucket
		});
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use frame_support::{
		storage::{generator::StorageMap as StorageMapHelper, storage_prefix},
		Twox64Concat,
	};
	use sp_io::TestExternalities;
	pub struct MockStorageMap;

	impl StorageMapHelper<u128, u128> for MockStorageMap {
		type Query = u128;
		type Hasher = Twox64Concat;
		fn pallet_prefix() -> &'static [u8] {
			b"MyModule"
		}

		fn storage_prefix() -> &'static [u8] {
			b"MyStorageMap"
		}

		fn prefix_hash() -> [u8; 32] {
			storage_prefix(Self::pallet_prefix(), Self::storage_prefix())
		}

		fn from_optional_value_to_query(v: Option<u128>) -> Self::Query {
			v.unwrap_or_default()
		}

		fn from_query_to_optional_value(v: Self::Query) -> Option<u128> {
			Some(v)
		}
	}

	type TestSparseBitmap = SparseBitmapImpl<MockStorageMap>;

	#[test]
	fn test_sparse_bitmap_set_and_get() {
		TestExternalities::default().execute_with(|| {
			let index = 300;
			let (bucket, mask) = TestSparseBitmap::compute_bucket_and_mask(index);

			// Test initial state
			assert_eq!(MockStorageMap::get(bucket), 0);
			assert!(!TestSparseBitmap::get(index));

			// Set the bit
			TestSparseBitmap::set(index);

			// Test after setting
			assert_eq!(MockStorageMap::get(bucket), mask);
			assert!(TestSparseBitmap::get(index));
		});
	}

	#[test]
	fn test_sparse_bitmap_multiple_sets() {
		TestExternalities::default().execute_with(|| {
			let index1 = 300;
			let index2 = 305; // Same bucket, different bit
			let (bucket, _) = TestSparseBitmap::compute_bucket_and_mask(index1);

			let (_, mask1) = TestSparseBitmap::compute_bucket_and_mask(index1);
			let (_, mask2) = TestSparseBitmap::compute_bucket_and_mask(index2);

			// Test initial state
			assert_eq!(MockStorageMap::get(bucket), 0);
			assert!(!TestSparseBitmap::get(index1));
			assert!(!TestSparseBitmap::get(index2));

			// Set the first bit
			TestSparseBitmap::set(index1);

			// Test after first set
			assert_eq!(MockStorageMap::get(bucket), mask1);
			assert!(TestSparseBitmap::get(index1));
			assert!(!TestSparseBitmap::get(index2));

			// Set the second bit
			TestSparseBitmap::set(index2);

			// Test after second set
			assert_eq!(MockStorageMap::get(bucket), mask1 | mask2); // Bucket should contain both masks
			assert!(TestSparseBitmap::get(index1));
			assert!(TestSparseBitmap::get(index2));
		})
	}

	#[test]
	fn test_sparse_bitmap_different_buckets() {
		TestExternalities::default().execute_with(|| {
			let index1 = 300; // Bucket 1
			let index2 = 300 + (1 << 7); // Bucket 2 (128 bits apart)

			let (bucket1, _) = TestSparseBitmap::compute_bucket_and_mask(index1);
			let (bucket2, _) = TestSparseBitmap::compute_bucket_and_mask(index2);

			let (_, mask1) = TestSparseBitmap::compute_bucket_and_mask(index1);
			let (_, mask2) = TestSparseBitmap::compute_bucket_and_mask(index2);

			// Test initial state
			assert_eq!(MockStorageMap::get(bucket1), 0);
			assert_eq!(MockStorageMap::get(bucket2), 0);

			// Set bits in different buckets
			TestSparseBitmap::set(index1);
			TestSparseBitmap::set(index2);

			// Test after setting
			assert_eq!(MockStorageMap::get(bucket1), mask1); // Bucket 1 should contain mask1
			assert_eq!(MockStorageMap::get(bucket2), mask2); // Bucket 2 should contain mask2

			assert!(TestSparseBitmap::get(index1));
			assert!(TestSparseBitmap::get(index2));
		})
	}
}

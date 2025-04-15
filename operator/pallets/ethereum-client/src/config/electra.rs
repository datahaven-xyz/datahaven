// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>

/// Generalized Indices
/// related to Merkle proofs
/// get_generalized_index(BeaconState, 'block_roots')
pub const BLOCK_ROOTS_INDEX: usize = 69;
/// get_generalized_index(BeaconState, 'finalized_checkpoint', 'root')
pub const FINALIZED_ROOT_INDEX: usize = 169;
/// get_generalized_index(BeaconState, 'current_sync_committee')
pub const CURRENT_SYNC_COMMITTEE_INDEX: usize = 86;
/// get_generalized_index(BeaconState, 'next_sync_committee')
pub const NEXT_SYNC_COMMITTEE_INDEX: usize = 87;

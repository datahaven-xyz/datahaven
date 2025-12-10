// Copyright 2025 DataHaven
// This file is part of DataHaven.

// DataHaven is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// DataHaven is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with DataHaven.  If not, see <http://www.gnu.org/licenses/>.

//! EigenLayer rewards utilities for ABI encoding and operator amount calculations.

use sp_core::H160;
use sp_std::vec::Vec;

/// Function selector for submitRewards(OperatorDirectedRewardsSubmission).
/// cast sig "submitRewards(((address,uint96)[],address,(address,uint256)[],uint32,uint32,string))" = 0x83821e8e
pub const SUBMIT_REWARDS_SELECTOR: [u8; 4] = [0x83, 0x82, 0x1e, 0x8e];

/// Default description for rewards submissions.
pub const REWARDS_DESCRIPTION: &[u8] = b"DataHaven validator rewards";

/// Gas limit for the submitRewards call on Ethereum.
pub const SUBMIT_REWARDS_GAS_LIMIT: u64 = 2_000_000;

/// Calculate operator reward amounts from points and total inflation.
/// Returns a sorted list of (operator_address, amount) tuples.
///
/// # Arguments
/// * `individual_points` - List of (operator, points) tuples
/// * `total_points` - Sum of all points
/// * `inflation_amount` - Total tokens to distribute
pub fn calculate_operator_amounts(
    individual_points: &[(H160, u32)],
    total_points: u128,
    inflation_amount: u128,
) -> Vec<(H160, u128)> {
    let mut operator_rewards: Vec<(H160, u128)> = individual_points
        .iter()
        .filter_map(|(op, pts)| {
            if total_points == 0 || *pts == 0 {
                return None;
            }
            let amount = (*pts as u128)
                .saturating_mul(inflation_amount)
                .saturating_div(total_points);
            if amount > 0 {
                Some((*op, amount))
            } else {
                None
            }
        })
        .collect();

    // Sort by operator address (required by EigenLayer)
    operator_rewards.sort_by_key(|(addr, _)| *addr);
    operator_rewards
}

/// ABI-encode the submitRewards calldata for EigenLayer's RewardsCoordinator.
///
/// # Format
/// selector + ABI-encoded OperatorDirectedRewardsSubmission tuple:
/// `((address,uint96)[], address, (address,uint256)[], uint32, uint32, string)`
///
/// # Arguments
/// * `selector` - 4-byte function selector
/// * `token` - ERC20 reward token address
/// * `operator_rewards` - Sorted list of (operator, amount) tuples
/// * `start_timestamp` - Period start timestamp (aligned to duration)
/// * `duration` - Reward period duration in seconds
/// * `description` - Human-readable description
pub fn encode_submit_rewards_calldata(
    selector: &[u8],
    token: H160,
    operator_rewards: &[(H160, u128)],
    start_timestamp: u32,
    duration: u32,
    description: &[u8],
) -> Vec<u8> {
    // Empty strategies array (DataHaven focuses on operator rewards)
    let strategies: &[(H160, u128)] = &[];

    let mut calldata = selector.to_vec();

    // Offset to the main tuple data (starts at 32 bytes from selector)
    calldata.extend_from_slice(&encode_u256(32));

    // Calculate offsets (6 head slots * 32 bytes = 192 bytes to first dynamic data)
    let head_size: u128 = 6 * 32;
    let strategies_offset: u128 = head_size;
    let strategies_data_size: u128 = 32 + (strategies.len() as u128) * 64;
    let operator_rewards_offset: u128 = strategies_offset + strategies_data_size;
    let operator_rewards_data_size: u128 = 32 + (operator_rewards.len() as u128) * 64;
    let description_offset: u128 = operator_rewards_offset + operator_rewards_data_size;

    // Head section
    calldata.extend_from_slice(&encode_u256(strategies_offset));
    calldata.extend_from_slice(&encode_address(token));
    calldata.extend_from_slice(&encode_u256(operator_rewards_offset));
    calldata.extend_from_slice(&encode_u256(start_timestamp as u128));
    calldata.extend_from_slice(&encode_u256(duration as u128));
    calldata.extend_from_slice(&encode_u256(description_offset));

    // Tail section: dynamic data

    // 1. strategiesAndMultipliers array
    calldata.extend_from_slice(&encode_u256(strategies.len() as u128));
    for (strategy, multiplier) in strategies {
        calldata.extend_from_slice(&encode_address(*strategy));
        calldata.extend_from_slice(&encode_u256(*multiplier));
    }

    // 2. operatorRewards array
    calldata.extend_from_slice(&encode_u256(operator_rewards.len() as u128));
    for (operator, amount) in operator_rewards {
        calldata.extend_from_slice(&encode_address(*operator));
        calldata.extend_from_slice(&encode_u256(*amount));
    }

    // 3. description string
    calldata.extend_from_slice(&encode_u256(description.len() as u128));
    calldata.extend_from_slice(description);
    let padding_needed = (32 - (description.len() % 32)) % 32;
    calldata.extend(core::iter::repeat(0u8).take(padding_needed));

    calldata
}

/// Encode a u128 value as a 32-byte big-endian ABI-encoded uint256.
#[inline]
pub fn encode_u256(value: u128) -> [u8; 32] {
    let mut result = [0u8; 32];
    result[16..32].copy_from_slice(&value.to_be_bytes());
    result
}

/// Encode an H160 address as a 32-byte ABI-encoded address (left-padded with zeros).
#[inline]
pub fn encode_address(addr: H160) -> [u8; 32] {
    let mut result = [0u8; 32];
    result[12..32].copy_from_slice(addr.as_bytes());
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_operator_amounts_basic() {
        let points = vec![
            (H160::from_low_u64_be(1), 600),
            (H160::from_low_u64_be(2), 400),
        ];
        let result = calculate_operator_amounts(&points, 1000, 1_000_000);

        assert_eq!(result.len(), 2);
        assert_eq!(result[0].1, 600_000); // 60%
        assert_eq!(result[1].1, 400_000); // 40%
    }

    #[test]
    fn test_calculate_operator_amounts_sorted() {
        let points = vec![
            (H160::from_low_u64_be(100), 500),
            (H160::from_low_u64_be(1), 500),
        ];
        let result = calculate_operator_amounts(&points, 1000, 1_000_000);

        // Should be sorted by address
        assert!(result[0].0 < result[1].0);
    }

    #[test]
    fn test_calculate_operator_amounts_zero_points() {
        let points = vec![
            (H160::from_low_u64_be(1), 0),
            (H160::from_low_u64_be(2), 100),
        ];
        let result = calculate_operator_amounts(&points, 100, 1_000_000);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].0, H160::from_low_u64_be(2));
    }

    #[test]
    fn test_encode_u256() {
        let result = encode_u256(42);
        assert_eq!(result[31], 42);
        assert_eq!(result[..31], [0u8; 31]);
    }

    #[test]
    fn test_encode_address() {
        let addr = H160::from_low_u64_be(0xdeadbeef);
        let result = encode_address(addr);
        assert_eq!(&result[12..32], addr.as_bytes());
        assert_eq!(result[..12], [0u8; 12]);
    }
}


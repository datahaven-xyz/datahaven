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

use snowbridge_outbound_queue_primitives::v2::{Command, Message as OutboundMessage};
use sp_core::{H160, H256};
use sp_std::vec;
use sp_std::vec::Vec;

/// Function selector for submitRewards(OperatorDirectedRewardsSubmission).
/// cast sig "submitRewards(((address,uint96)[],address,(address,uint256)[],uint32,uint32,string))" = 0x83821e8e
pub const SUBMIT_REWARDS_SELECTOR: [u8; 4] = [0x83, 0x82, 0x1e, 0x8e];

/// Default description for rewards submissions.
pub const REWARDS_DESCRIPTION: &[u8] = b"DataHaven validator rewards";

/// Gas limit for the submitRewards call on Ethereum.
pub const SUBMIT_REWARDS_GAS_LIMIT: u64 = 2_000_000;

/// Configuration for building rewards messages.
pub struct RewardsMessageConfig {
    /// The DataHaven ServiceManager contract address on Ethereum.
    pub service_manager: H160,
    /// The wHAVE token ID registered in Snowbridge.
    pub whave_token_id: H256,
    /// The wHAVE ERC20 token address on Ethereum.
    pub whave_token_address: H160,
    /// The agent origin for the outbound message.
    pub rewards_agent_origin: H256,
    /// EigenLayer-aligned genesis timestamp.
    pub rewards_genesis_timestamp: u32,
    /// Rewards duration in seconds (typically 86400 = 1 day).
    pub rewards_duration: u32,
    /// Current timestamp in seconds.
    pub current_timestamp_secs: u32,
}

/// Input data for building rewards message.
pub struct RewardsData<'a> {
    /// Individual validator points as (address, points) tuples.
    pub individual_points: &'a [(H160, u32)],
    /// Total points across all validators.
    pub total_points: u128,
    /// Total inflation amount to distribute.
    pub inflation_amount: u128,
    /// Merkle root for message ID generation.
    pub merkle_root: H256,
}

/// EigenLayer's fixed calculation interval (1 day in seconds).
/// This is hardcoded in EigenLayer's RewardsCoordinator and cannot be changed.
/// See: CALCULATION_INTERVAL_SECONDS in RewardsCoordinator.sol
pub const EIGENLAYER_CALCULATION_INTERVAL: u32 = 86400;

/// Calculate aligned start timestamp for rewards submission.
///
/// EigenLayer requires `startTimestamp` to be aligned to `CALCULATION_INTERVAL_SECONDS` (86400).
/// This alignment is independent of the reward `duration` - the duration determines how long
/// rewards are distributed, but alignment is always to day boundaries.
///
/// # Arguments
/// * `genesis` - The rewards genesis timestamp (should be aligned to 86400)
/// * `now_secs` - Current timestamp in seconds
///
/// # Returns
/// The start of the most recently completed day-aligned period, or genesis if we're
/// still in the first period.
pub fn calculate_aligned_start_timestamp(genesis: u32, now_secs: u32) -> u32 {
    if genesis > now_secs {
        return genesis;
    }
    let elapsed = now_secs.saturating_sub(genesis);
    let period = elapsed / EIGENLAYER_CALCULATION_INTERVAL;
    if period == 0 {
        // Still in the first period, return genesis
        return genesis;
    }
    // Return start of the period that just ended (period N-1)
    genesis + (period - 1) * EIGENLAYER_CALCULATION_INTERVAL
}

/// Build the complete rewards outbound message.
///
/// Returns `None` if validation fails or no rewards to distribute.
pub fn build_rewards_message<F>(
    config: &RewardsMessageConfig,
    data: &RewardsData,
    unique_id: F,
) -> Option<OutboundMessage>
where
    F: FnOnce(H256) -> H256,
{
    // Validate config
    if config.service_manager == H160::zero() {
        log::warn!(
            target: "rewards_send_adapter",
            "Skipping rewards message: ServiceManagerAddress is zero"
        );
        return None;
    }

    if config.whave_token_address == H160::zero() {
        log::warn!(
            target: "rewards_send_adapter",
            "Skipping rewards message: WHAVETokenAddress is zero"
        );
        return None;
    }

    // Calculate operator amounts from points
    let operator_rewards = calculate_operator_amounts(
        data.individual_points,
        data.total_points,
        data.inflation_amount,
    );

    if operator_rewards.is_empty() {
        log::warn!(
            target: "rewards_send_adapter",
            "Skipping rewards message: no operators with rewards"
        );
        return None;
    }

    // Calculate total amount for minting
    let total_amount: u128 = operator_rewards.iter().map(|(_, a)| *a).sum();

    if total_amount == 0 {
        log::warn!(
            target: "rewards_send_adapter",
            "Skipping rewards message: total amount is zero"
        );
        return None;
    }

    let start_timestamp = calculate_aligned_start_timestamp(
        config.rewards_genesis_timestamp,
        config.current_timestamp_secs,
    );

    // Build the ABI-encoded calldata
    let calldata = encode_submit_rewards_calldata(
        &SUBMIT_REWARDS_SELECTOR,
        config.whave_token_address,
        &operator_rewards,
        start_timestamp,
        config.rewards_duration,
        REWARDS_DESCRIPTION,
    );

    // Build the two commands: MintForeignToken + CallContract
    let commands = vec![
        Command::MintForeignToken {
            token_id: config.whave_token_id,
            recipient: config.service_manager,
            amount: total_amount,
        },
        Command::CallContract {
            target: config.service_manager,
            calldata,
            gas: SUBMIT_REWARDS_GAS_LIMIT,
            value: 0,
        },
    ]
    .try_into()
    .ok()?;

    Some(OutboundMessage {
        origin: config.rewards_agent_origin,
        id: unique_id(data.merkle_root).into(),
        fee: 0,
        commands,
    })
}

/// Calculate operator reward amounts from points and total inflation.
/// Returns a sorted list of (operator_address, amount) tuples.
///
/// The function ensures that the sum of all operator amounts equals `inflation_amount`
/// by adding any rounding remainder to the last operator. This prevents tokens from
/// being permanently locked in the sovereign account due to integer division truncation.
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
    if total_points == 0 || inflation_amount == 0 {
        return Vec::new();
    }

    let mut operator_rewards: Vec<(H160, u128)> = individual_points
        .iter()
        .filter_map(|(op, pts)| {
            if *pts == 0 {
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

    // Add rounding remainder to the last operator to ensure full distribution.
    // This prevents tokens from being permanently locked due to integer division truncation.
    if !operator_rewards.is_empty() {
        let distributed: u128 = operator_rewards.iter().map(|(_, a)| *a).sum();
        let remainder = inflation_amount.saturating_sub(distributed);
        if remainder > 0 {
            if let Some((_, last_amount)) = operator_rewards.last_mut() {
                *last_amount = last_amount.saturating_add(remainder);
            }
        }
    }

    operator_rewards
}

/// Maximum value for uint96 (2^96 - 1).
pub const MAX_UINT96: u128 = (1u128 << 96) - 1;

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
    // Empty strategies array (DataHaven focuses on operator rewards).
    // Type: (address strategy, uint96 multiplier)[]
    // Note: If this is ever populated, multiplier values must not exceed MAX_UINT96.
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

    // 1. strategiesAndMultipliers array: (address, uint96)[]
    calldata.extend_from_slice(&encode_u256(strategies.len() as u128));
    for (strategy, multiplier) in strategies {
        calldata.extend_from_slice(&encode_address(*strategy));
        // Note: multiplier is uint96 in EigenLayer's StrategyAndMultiplier struct.
        // ABI encoding is identical to uint256 (padded to 32 bytes), but value must fit in uint96.
        debug_assert!(
            *multiplier <= MAX_UINT96,
            "Strategy multiplier exceeds uint96 max value"
        );
        calldata.extend_from_slice(&encode_u256(*multiplier));
    }

    // 2. operatorRewards array: (address, uint256)[]
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
    fn test_calculate_operator_amounts_rounding_remainder() {
        // Test case: 2 operators with 1 point each, 1001 tokens to distribute
        // Without fix: each gets 500, losing 1 token
        // With fix: one gets 500, other gets 501 (remainder added to last)
        let points = vec![(H160::from_low_u64_be(1), 1), (H160::from_low_u64_be(2), 1)];
        let result = calculate_operator_amounts(&points, 2, 1001);

        assert_eq!(result.len(), 2);
        let total: u128 = result.iter().map(|(_, a)| *a).sum();
        assert_eq!(
            total, 1001,
            "Total distributed should equal inflation_amount"
        );

        // First gets 500, last gets 501 (500 + 1 remainder)
        assert_eq!(result[0].1, 500);
        assert_eq!(result[1].1, 501);
    }

    #[test]
    fn test_calculate_operator_amounts_no_remainder_loss() {
        // Test with various scenarios that would cause rounding loss
        let test_cases = vec![
            // (points, total_points, inflation, expected_total)
            (
                vec![
                    (H160::from_low_u64_be(1), 1),
                    (H160::from_low_u64_be(2), 1),
                    (H160::from_low_u64_be(3), 1),
                ],
                3u128,
                100u128,
            ),
            (
                vec![
                    (H160::from_low_u64_be(1), 7),
                    (H160::from_low_u64_be(2), 11),
                ],
                18u128,
                1000u128,
            ),
            (
                vec![
                    (H160::from_low_u64_be(1), 1),
                    (H160::from_low_u64_be(2), 2),
                    (H160::from_low_u64_be(3), 3),
                ],
                6u128,
                1000000u128,
            ),
        ];

        for (points, total_points, inflation) in test_cases {
            let result = calculate_operator_amounts(&points, total_points, inflation);
            let total: u128 = result.iter().map(|(_, a)| *a).sum();
            assert_eq!(
                total, inflation,
                "Total distributed should equal inflation_amount. Points: {:?}, Total: {}, Inflation: {}",
                points.iter().map(|(_, p)| p).collect::<Vec<_>>(), total_points, inflation
            );
        }
    }

    #[test]
    fn test_calculate_operator_amounts_large_remainder() {
        // Test with many operators where remainder could be significant
        let points: Vec<_> = (1..=10).map(|i| (H160::from_low_u64_be(i), 1u32)).collect();
        let result = calculate_operator_amounts(&points, 10, 1009);

        let total: u128 = result.iter().map(|(_, a)| *a).sum();
        assert_eq!(
            total, 1009,
            "Should distribute all tokens including remainder of 9"
        );

        // First 9 operators get 100 each, last gets 109 (100 + 9 remainder)
        for (i, (_, amount)) in result.iter().enumerate() {
            if i < 9 {
                assert_eq!(*amount, 100);
            } else {
                assert_eq!(*amount, 109);
            }
        }
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

    #[test]
    fn test_calculate_aligned_start_timestamp() {
        // Genesis should be aligned to EIGENLAYER_CALCULATION_INTERVAL (86400)
        // For testing, we use a genesis that's a multiple of 86400
        let genesis = 86400; // Day 1 start

        // At genesis, return genesis (still in first period)
        assert_eq!(calculate_aligned_start_timestamp(genesis, genesis), genesis);

        // Before genesis, return genesis
        assert_eq!(calculate_aligned_start_timestamp(genesis, 500), genesis);

        // Mid-first period returns genesis (period 0)
        assert_eq!(
            calculate_aligned_start_timestamp(genesis, genesis + 43200),
            genesis
        );

        // Second period (day 2) returns start of first period (genesis)
        assert_eq!(
            calculate_aligned_start_timestamp(genesis, genesis + 86400 + 1000),
            genesis
        );

        // Third period (day 3) returns start of second period (day 2)
        assert_eq!(
            calculate_aligned_start_timestamp(genesis, genesis + 2 * 86400 + 1000),
            genesis + 86400
        );

        // Fourth period (day 4) returns start of third period (day 3)
        assert_eq!(
            calculate_aligned_start_timestamp(genesis, genesis + 3 * 86400 + 1000),
            genesis + 2 * 86400
        );
    }

    #[test]
    fn test_eigenlayer_calculation_interval_constant() {
        // Verify the constant matches EigenLayer's hardcoded value
        assert_eq!(EIGENLAYER_CALCULATION_INTERVAL, 86400);
    }
}

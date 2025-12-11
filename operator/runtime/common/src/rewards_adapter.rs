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

//! EigenLayer rewards submission adapter.
//!
//! Provides a generic adapter for submitting validator rewards to EigenLayer
//! via Snowbridge. The adapter is configurable through the [`RewardsSubmissionConfig`]
//! trait, allowing runtimes to provide environment-specific values.

use alloy_core::{
    primitives::{Address, U256},
    sol,
    sol_types::SolCall,
};
use pallet_external_validators_rewards::types::{EraRewardsUtils, SendMessage};
use snowbridge_outbound_queue_primitives::v2::{
    Command, Message as OutboundMessage, SendMessage as SnowbridgeSendMessage,
};
use snowbridge_outbound_queue_primitives::SendError;
use sp_core::{H160, H256};
use sp_std::vec;
use sp_std::vec::Vec;

// ============================================================================
// SOLIDITY ABI DEFINITIONS
// ============================================================================

sol! {
    /// EigenLayer strategy and multiplier tuple.
    /// Maps to `IRewardsCoordinatorTypes.StrategyAndMultiplier`.
    struct StrategyAndMultiplier {
        address strategy;
        uint96 multiplier;
    }

    /// EigenLayer operator reward tuple.
    /// Maps to `IRewardsCoordinatorTypes.OperatorReward`.
    struct OperatorReward {
        address operator;
        uint256 amount;
    }

    /// EigenLayer operator-directed rewards submission.
    /// Maps to `IRewardsCoordinatorTypes.OperatorDirectedRewardsSubmission`.
    struct OperatorDirectedRewardsSubmission {
        StrategyAndMultiplier[] strategiesAndMultipliers;
        address token;
        OperatorReward[] operatorRewards;
        uint32 startTimestamp;
        uint32 duration;
        string description;
    }

    /// The submitRewards function on DataHavenServiceManager.
    function submitRewards(OperatorDirectedRewardsSubmission submission);
}

// ============================================================================
// CONFIGURATION TRAIT
// ============================================================================

/// Configuration for rewards submission.
///
/// Runtimes implement this trait to provide environment-specific values
/// such as contract addresses, timestamps, and the outbound queue.
pub trait RewardsSubmissionConfig {
    /// The Snowbridge outbound queue pallet type for message validation and delivery.
    type OutboundQueue: snowbridge_outbound_queue_primitives::v2::SendMessage<
        Ticket = OutboundMessage,
    >;

    /// Get the current Unix timestamp in seconds.
    fn current_timestamp_secs() -> u32;

    /// Get the rewards genesis timestamp (should be aligned to 86400).
    fn rewards_genesis_timestamp() -> u32;

    /// Get the rewards duration in seconds (typically 86400 = 1 day).
    fn rewards_duration() -> u32;

    /// Get the wHAVE token ID registered in Snowbridge.
    /// Returns `None` if the token is not registered.
    fn whave_token_id() -> Option<H256>;

    /// Get the wHAVE ERC20 token address on Ethereum.
    fn whave_token_address() -> H160;

    /// Get the DataHaven ServiceManager contract address on Ethereum.
    fn service_manager_address() -> H160;

    /// Get the agent origin for outbound messages.
    fn rewards_agent_origin() -> H256;

    /// Generate a unique message ID from the merkle root.
    fn generate_message_id(merkle_root: H256) -> H256;
}

// ============================================================================
// ADAPTER
// ============================================================================

/// Generic rewards submission adapter.
///
/// This adapter implements [`SendMessage`] and uses the configuration provided
/// by [`RewardsSubmissionConfig`] to build, validate, and deliver rewards
/// messages to EigenLayer via Snowbridge.
pub struct RewardsSubmissionAdapter<C>(core::marker::PhantomData<C>);

impl<C: RewardsSubmissionConfig> SendMessage for RewardsSubmissionAdapter<C> {
    type Message = OutboundMessage;
    type Ticket = OutboundMessage;

    fn build(rewards_utils: &EraRewardsUtils) -> Option<Self::Message> {
        build_rewards_message::<C>(rewards_utils)
    }

    fn validate(message: Self::Message) -> Result<Self::Ticket, SendError> {
        C::OutboundQueue::validate(&message)
    }

    fn deliver(ticket: Self::Ticket) -> Result<H256, SendError> {
        C::OutboundQueue::deliver(ticket)
    }
}

// ============================================================================
// CONSTANTS
// ============================================================================

/// Default description for rewards submissions.
pub const REWARDS_DESCRIPTION: &str = "DataHaven validator rewards";

/// Gas limit for the submitRewards call on Ethereum.
pub const SUBMIT_REWARDS_GAS_LIMIT: u64 = 2_000_000;

/// EigenLayer's fixed calculation interval (1 day in seconds).
/// This is hardcoded in EigenLayer's RewardsCoordinator and cannot be changed.
/// See: CALCULATION_INTERVAL_SECONDS in RewardsCoordinator.sol
pub const EIGENLAYER_CALCULATION_INTERVAL: u32 = 86400;

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

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

// ============================================================================
// MESSAGE BUILDING
// ============================================================================

/// Build the complete rewards outbound message using configuration from `C`.
///
/// Returns `None` if validation fails or no rewards to distribute.
fn build_rewards_message<C: RewardsSubmissionConfig>(
    rewards_utils: &EraRewardsUtils,
) -> Option<OutboundMessage> {
    let whave_token_id = C::whave_token_id().or_else(|| {
        log::warn!(
            target: "rewards_adapter",
            "Skipping rewards message: wHAVE token not registered in Snowbridge"
        );
        None
    })?;

    let service_manager = C::service_manager_address();
    let whave_token_address = C::whave_token_address();

    if service_manager == H160::zero() {
        log::warn!(
            target: "rewards_adapter",
            "Skipping rewards message: ServiceManagerAddress is zero"
        );
        return None;
    }

    if whave_token_address == H160::zero() {
        log::warn!(
            target: "rewards_adapter",
            "Skipping rewards message: WHAVETokenAddress is zero"
        );
        return None;
    }

    // Calculate operator amounts from points
    let (operator_rewards, remainder) = calculate_operator_amounts(
        &rewards_utils.individual_points,
        rewards_utils.total_points,
        rewards_utils.inflation_amount,
    );

    if operator_rewards.is_empty() {
        log::warn!(
            target: "rewards_adapter",
            "Skipping rewards message: no operators with rewards"
        );
        return None;
    }

    if remainder > 0 {
        log::debug!(
            target: "rewards_adapter",
            "Reward distribution remainder (dust): {} tokens",
            remainder
        );
    }

    // Calculate total amount for minting (excludes remainder/dust)
    let total_amount: u128 = operator_rewards.iter().map(|(_, amount)| amount).sum();

    if total_amount == 0 {
        log::warn!(
            target: "rewards_adapter",
            "Skipping rewards message: total amount is zero"
        );
        return None;
    }

    let start_timestamp = calculate_aligned_start_timestamp(
        C::rewards_genesis_timestamp(),
        C::current_timestamp_secs(),
    );

    // Build the ABI-encoded calldata using alloy's type-safe encoding
    let calldata = encode_submit_rewards_calldata(
        whave_token_address,
        &operator_rewards,
        start_timestamp,
        C::rewards_duration(),
        REWARDS_DESCRIPTION,
    );

    // Build the two commands: MintForeignToken + CallContract
    let commands = vec![
        Command::MintForeignToken {
            token_id: whave_token_id,
            recipient: service_manager,
            amount: total_amount,
        },
        Command::CallContract {
            target: service_manager,
            calldata,
            gas: SUBMIT_REWARDS_GAS_LIMIT,
            value: 0,
        },
    ]
    .try_into()
    .ok()?;

    Some(OutboundMessage {
        origin: C::rewards_agent_origin(),
        id: C::generate_message_id(rewards_utils.rewards_merkle_root).into(),
        fee: 0,
        commands,
    })
}

/// Calculate operator reward amounts from points and total inflation.
/// Returns a sorted list of (operator_address, amount) tuples and the remainder (dust).
///
/// The remainder is the amount left over due to integer division truncation.
/// Callers can decide how to handle it (e.g., send to treasury, burn, etc.).
///
/// # Arguments
/// * `individual_points` - List of (operator, points) tuples
/// * `total_points` - Sum of all points
/// * `inflation_amount` - Total tokens to distribute
///
/// # Returns
/// A tuple of (operator_rewards, remainder) where:
/// * `operator_rewards` - Sorted list of (operator_address, amount) tuples
/// * `remainder` - Dust amount from integer division truncation
pub fn calculate_operator_amounts(
    individual_points: &[(H160, u32)],
    total_points: u128,
    inflation_amount: u128,
) -> (Vec<(H160, u128)>, u128) {
    if total_points == 0 || inflation_amount == 0 {
        return (Vec::new(), 0);
    }

    let calculate_reward = |points: u32| -> u128 {
        (points as u128)
            .saturating_mul(inflation_amount)
            .saturating_div(total_points)
    };

    let mut rewards: Vec<_> = individual_points
        .iter()
        .filter_map(|(operator, points)| {
            let amount = calculate_reward(*points);
            (amount > 0).then_some((*operator, amount))
        })
        .collect();

    // Sort by operator address (required by EigenLayer)
    rewards.sort_by_key(|(operator, _)| *operator);

    let distributed: u128 = rewards.iter().map(|(_, amount)| amount).sum();
    let remainder = inflation_amount.saturating_sub(distributed);

    (rewards, remainder)
}

/// ABI-encode the submitRewards calldata for DataHavenServiceManager.
///
/// Uses alloy's type-safe ABI encoding to generate the calldata for
/// `submitRewards(OperatorDirectedRewardsSubmission)`.
///
/// # Arguments
/// * `token` - ERC20 reward token address
/// * `operator_rewards` - Sorted list of (operator, amount) tuples
/// * `start_timestamp` - Period start timestamp (aligned to duration)
/// * `duration` - Reward period duration in seconds
/// * `description` - Human-readable description
pub fn encode_submit_rewards_calldata(
    token: H160,
    operator_rewards: &[(H160, u128)],
    start_timestamp: u32,
    duration: u32,
    description: &str,
) -> Vec<u8> {
    // Convert operator rewards to alloy types
    let operator_rewards_alloy: Vec<OperatorReward> = operator_rewards
        .iter()
        .map(|(op, amount)| OperatorReward {
            operator: Address::from(op.as_fixed_bytes()),
            amount: U256::from(*amount),
        })
        .collect();

    // Build the submission struct
    let submission = OperatorDirectedRewardsSubmission {
        // Empty strategies array (DataHaven focuses on operator rewards)
        strategiesAndMultipliers: vec![],
        token: Address::from(token.as_fixed_bytes()),
        operatorRewards: operator_rewards_alloy,
        startTimestamp: start_timestamp,
        duration,
        description: description.into(),
    };

    // Use alloy's type-safe encoding
    submitRewardsCall { submission }.abi_encode()
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
        let (rewards, remainder) = calculate_operator_amounts(&points, 1000, 1_000_000);

        assert_eq!(rewards.len(), 2);
        assert_eq!(rewards[0].1, 600_000); // 60%
        assert_eq!(rewards[1].1, 400_000); // 40%
        assert_eq!(remainder, 0); // No remainder when evenly divisible
    }

    #[test]
    fn test_calculate_operator_amounts_sorted() {
        let points = vec![
            (H160::from_low_u64_be(100), 500),
            (H160::from_low_u64_be(1), 500),
        ];
        let (rewards, _) = calculate_operator_amounts(&points, 1000, 1_000_000);

        // Should be sorted by address
        assert!(rewards[0].0 < rewards[1].0);
    }

    #[test]
    fn test_calculate_operator_amounts_zero_points() {
        let points = vec![
            (H160::from_low_u64_be(1), 0),
            (H160::from_low_u64_be(2), 100),
        ];
        let (rewards, remainder) = calculate_operator_amounts(&points, 100, 1_000_000);

        assert_eq!(rewards.len(), 1);
        assert_eq!(rewards[0].0, H160::from_low_u64_be(2));
        assert_eq!(remainder, 0);
    }

    #[test]
    fn test_calculate_operator_amounts_rounding_remainder() {
        // Test case: 2 operators with 1 point each, 1001 tokens to distribute
        // Each gets 500, remainder of 1 is returned separately
        let points = vec![(H160::from_low_u64_be(1), 1), (H160::from_low_u64_be(2), 1)];
        let (rewards, remainder) = calculate_operator_amounts(&points, 2, 1001);

        assert_eq!(rewards.len(), 2);
        assert_eq!(rewards[0].1, 500);
        assert_eq!(rewards[1].1, 500);
        assert_eq!(remainder, 1, "Remainder should be 1 token");

        // Verify distributed + remainder equals total
        let distributed: u128 = rewards.iter().map(|(_, a)| a).sum();
        assert_eq!(distributed + remainder, 1001);
    }

    #[test]
    fn test_calculate_operator_amounts_remainder_consistency() {
        // Test with various scenarios that would cause rounding
        let test_cases = vec![
            // (points, total_points, inflation, expected_remainder)
            (
                vec![
                    (H160::from_low_u64_be(1), 1),
                    (H160::from_low_u64_be(2), 1),
                    (H160::from_low_u64_be(3), 1),
                ],
                3u128,
                100u128,
                1u128, // 100 / 3 = 33 each, remainder 1
            ),
            (
                vec![
                    (H160::from_low_u64_be(1), 7),
                    (H160::from_low_u64_be(2), 11),
                ],
                18u128,
                1000u128,
                1u128, // 7*1000/18=388, 11*1000/18=611, total=999, remainder=1
            ),
            (
                vec![
                    (H160::from_low_u64_be(1), 1),
                    (H160::from_low_u64_be(2), 2),
                    (H160::from_low_u64_be(3), 3),
                ],
                6u128,
                1000000u128,
                // 1*1000000/6=166666, 2*1000000/6=333333, 3*1000000/6=500000
                // total=999999, remainder=1
                1u128,
            ),
        ];

        for (points, total_points, inflation, expected_remainder) in test_cases {
            let (rewards, remainder) = calculate_operator_amounts(&points, total_points, inflation);
            let distributed: u128 = rewards.iter().map(|(_, a)| a).sum();

            // Verify distributed + remainder equals inflation
            assert_eq!(
                distributed + remainder,
                inflation,
                "distributed + remainder should equal inflation. Points: {:?}",
                points.iter().map(|(_, p)| p).collect::<Vec<_>>()
            );
            assert_eq!(
                remainder,
                expected_remainder,
                "Unexpected remainder for points: {:?}",
                points.iter().map(|(_, p)| p).collect::<Vec<_>>()
            );
        }
    }

    #[test]
    fn test_calculate_operator_amounts_large_remainder() {
        // Test with many operators where remainder could be significant
        let points: Vec<_> = (1..=10).map(|i| (H160::from_low_u64_be(i), 1u32)).collect();
        let (rewards, remainder) = calculate_operator_amounts(&points, 10, 1009);

        // Each operator gets 100, remainder is 9
        for (_, amount) in rewards.iter() {
            assert_eq!(*amount, 100);
        }
        assert_eq!(remainder, 9, "Remainder should be 9 tokens");

        // Verify distributed + remainder equals total
        let distributed: u128 = rewards.iter().map(|(_, a)| a).sum();
        assert_eq!(distributed + remainder, 1009);
    }

    #[test]
    fn test_encode_submit_rewards_calldata_selector() {
        // Verify the function selector matches the expected value
        // cast sig "submitRewards(((address,uint96)[],address,(address,uint256)[],uint32,uint32,string))" = 0x83821e8e
        let calldata = encode_submit_rewards_calldata(
            H160::from_low_u64_be(0x1234),
            &[(H160::from_low_u64_be(0x5678), 1000)],
            86400,
            86400,
            "test",
        );

        // Check the function selector (first 4 bytes)
        assert_eq!(&calldata[0..4], &[0x83, 0x82, 0x1e, 0x8e]);
    }

    #[test]
    fn test_encode_submit_rewards_calldata_structure() {
        let token = H160::from_low_u64_be(0x1234);
        let operator = H160::from_low_u64_be(0x5678);
        let amount = 1000u128;
        let start_timestamp = 86400u32;
        let duration = 86400u32;

        let calldata = encode_submit_rewards_calldata(
            token,
            &[(operator, amount)],
            start_timestamp,
            duration,
            REWARDS_DESCRIPTION,
        );

        // Basic sanity checks on the calldata
        // 4 bytes selector + at least the encoded struct
        assert!(calldata.len() > 4);

        // The calldata should be a multiple of 32 bytes (plus 4 byte selector)
        assert_eq!((calldata.len() - 4) % 32, 0);
    }

    #[test]
    fn test_encode_submit_rewards_calldata_empty_operators() {
        let calldata = encode_submit_rewards_calldata(
            H160::from_low_u64_be(0x1234),
            &[],
            86400,
            86400,
            "empty",
        );

        // Should still produce valid calldata
        assert_eq!(&calldata[0..4], &[0x83, 0x82, 0x1e, 0x8e]);
        assert!(calldata.len() > 4);
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

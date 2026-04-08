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

use alloc::vec;
use alloc::vec::Vec;
use alloy_core::{
    primitives::{Address, Uint, U256},
    sol,
    sol_types::SolCall,
};
use pallet_external_validators_rewards::types::{EraRewardsUtils, SendMessage};
use snowbridge_outbound_queue_primitives::v2::{
    Command, Message as OutboundMessage, SendMessage as SnowbridgeSendMessage,
};
use snowbridge_outbound_queue_primitives::SendError;
use sp_core::{H160, H256};

/// Default description for rewards submissions.
pub const REWARDS_DESCRIPTION: &str = "DataHaven validator rewards";

/// Log target for rewards adapter messages.
const LOG_TARGET: &str = "rewards_adapter";

/// Gas limit for the submitRewards call on Ethereum.
pub const SUBMIT_REWARDS_GAS_LIMIT: u64 = 2_000_000;

/// Error type for rewards adapter operations.
#[derive(Debug, PartialEq, Eq)]
pub enum RewardsAdapterError {
    /// A strategy multiplier exceeds the maximum value for uint96.
    InvalidMultiplier,
    /// An arithmetic multiplication overflowed.
    MultiplicationOverflow,
    /// An arithmetic division by zero.
    DivisionByZero,
}

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

/// Configuration for rewards submission.
///
/// Runtimes implement this trait to provide environment-specific values
/// such as contract addresses and the outbound queue.
pub trait RewardsSubmissionConfig {
    /// The Snowbridge outbound queue pallet type for message validation and delivery.
    type OutboundQueue: snowbridge_outbound_queue_primitives::v2::SendMessage<
        Ticket = OutboundMessage,
    >;

    /// Strategies and multipliers to include in the rewards submission.
    ///
    /// EigenLayer requires `strategiesAndMultipliers` to be sorted by strategy address (ascending)
    /// with no duplicates. Multipliers must fit in `uint96`.
    ///
    /// Defaults to an empty set.
    fn strategies_and_multipliers() -> Vec<(H160, u128)> {
        Vec::new()
    }

    /// Get the rewards duration in seconds (typically 86400 = 1 day).
    fn rewards_duration() -> u32;

    /// Get the wHAVE ERC20 token address on Ethereum.
    fn whave_token_address() -> H160;

    /// Get the DataHaven ServiceManager contract address on Ethereum.
    fn service_manager_address() -> H160;

    /// Get the agent origin for outbound messages.
    fn rewards_agent_origin() -> H256;

    /// Handle the remainder (dust) from reward distribution.
    ///
    /// Called when there is a non-zero remainder after distributing rewards
    /// proportionally to operators. Implementations can transfer to treasury, burn, etc.
    fn handle_remainder(remainder: u128);
}

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

/// Build the complete rewards outbound message using configuration from `C`.
///
/// Returns `None` if validation fails or no rewards to distribute.
fn build_rewards_message<C: RewardsSubmissionConfig>(
    rewards_utils: &EraRewardsUtils,
) -> Option<OutboundMessage> {
    let service_manager = C::service_manager_address();
    let whave_token_address = C::whave_token_address();

    if service_manager == H160::zero() {
        log::warn!(target: LOG_TARGET, "Skipping: DatahavenServiceManagerAddress is zero");
        return None;
    }

    if whave_token_address == H160::zero() {
        log::warn!(target: LOG_TARGET, "Skipping: WHAVETokenAddress is zero");
        return None;
    }

    let (operator_rewards, remainder) = points_to_rewards(
        &rewards_utils.individual_points,
        rewards_utils.total_points,
        rewards_utils.inflation_amount,
    )
    .map_err(|e| log::warn!(target: LOG_TARGET, "Skipping: {:?}", e))
    .ok()?;

    if operator_rewards.is_empty() {
        log::warn!(target: LOG_TARGET, "Skipping: no operators with rewards");
        return None;
    }

    if remainder > 0 {
        log::debug!(target: LOG_TARGET, "Reward distribution remainder (dust): {} tokens", remainder);
        C::handle_remainder(remainder);
    }

    // Sort strategies by address (required by EigenLayer)
    let mut strategies_and_multipliers = C::strategies_and_multipliers();
    strategies_and_multipliers.sort_by_key(|(strategy, _)| *strategy);

    let calldata = encode_rewards_calldata(
        whave_token_address,
        &strategies_and_multipliers,
        &operator_rewards,
        rewards_utils.era_start_timestamp,
        C::rewards_duration(),
        REWARDS_DESCRIPTION,
    )
    .map_err(|e| log::warn!(target: LOG_TARGET, "Skipping: {:?}", e))
    .ok()?;

    let commands = vec![Command::CallContract {
        target: service_manager,
        calldata,
        gas: SUBMIT_REWARDS_GAS_LIMIT,
        value: 0,
    }]
    .try_into()
    .ok()?;

    Some(OutboundMessage {
        origin: C::rewards_agent_origin(),
        id: H256::from_low_u64_be(rewards_utils.era_index as u64).into(),
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
/// * `points` - List of (operator, points) tuples
/// * `total_points` - Sum of all points
/// * `inflation` - Total tokens to distribute
///
/// # Returns
/// `Ok((operator_rewards, remainder))` where:
/// * `operator_rewards` - Sorted list of (operator_address, amount) tuples
/// * `remainder` - Dust amount from integer division truncation
///
/// # Errors
/// Returns `Err(RewardsAdapterError::MultiplicationOverflow)` if `points * inflation`
/// exceeds u128::MAX, or `Err(RewardsAdapterError::DivisionByZero)` if `total_points` is zero.
pub fn points_to_rewards(
    points: &[(H160, u32)],
    total_points: u128,
    inflation: u128,
) -> Result<(Vec<(H160, u128)>, u128), RewardsAdapterError> {
    let mut rewards = Vec::with_capacity(points.len());
    let mut distributed = 0u128;

    for &(operator, points) in points {
        // Use checked_mul to detect overflow in points * inflation.
        let product = (points as u128)
            .checked_mul(inflation)
            .ok_or(RewardsAdapterError::MultiplicationOverflow)?;

        let amount = product
            .checked_div(total_points)
            .ok_or(RewardsAdapterError::DivisionByZero)?;

        if amount > 0 {
            rewards.push((operator, amount));
            distributed = distributed.saturating_add(amount);
        }
    }

    // Sort by operator address (required by EigenLayer)
    rewards.sort_by_key(|(operator, _)| *operator);

    let remainder = inflation.saturating_sub(distributed);
    Ok((rewards, remainder))
}

/// ABI-encode the submitRewards calldata for DataHavenServiceManager.
///
/// Uses alloy's type-safe ABI encoding to generate the calldata for
/// `submitRewards(OperatorDirectedRewardsSubmission)`.
///
/// # Arguments
/// * `token` - ERC20 reward token address
/// * `strategies_and_multipliers` - List of (strategy, multiplier) tuples
/// * `operator_rewards` - Sorted list of (operator, amount) tuples
/// * `start_timestamp` - Period start timestamp (aligned to duration)
/// * `duration` - Reward period duration in seconds
/// * `description` - Human-readable description
///
/// # Returns
/// `Ok(Vec<u8>)` with the ABI-encoded calldata, or `Err` if encoding fails
/// (e.g., multiplier exceeds uint96 max).
pub fn encode_rewards_calldata(
    token: H160,
    strategies_and_multipliers: &[(H160, u128)],
    operator_rewards: &[(H160, u128)],
    start_timestamp: u32,
    duration: u32,
    description: &str,
) -> Result<Vec<u8>, RewardsAdapterError> {
    let token_address = Address::from(token.as_fixed_bytes());

    // Convert strategies to alloy types.
    // Note: multiplier is uint96 on the Solidity side.
    const MAX_UINT96: u128 = (1u128 << 96) - 1;
    let strategies: Vec<StrategyAndMultiplier> = strategies_and_multipliers
        .iter()
        .map(|(strategy, multiplier)| {
            if *multiplier > MAX_UINT96 {
                return Err(RewardsAdapterError::InvalidMultiplier);
            }

            // `uint96` is represented by `Uint<96, 2>` (two u64 limbs).
            let multiplier_u96 =
                Uint::<96, 2>::from_limbs([*multiplier as u64, (*multiplier >> 64) as u64]);

            Ok(StrategyAndMultiplier {
                strategy: Address::from(strategy.as_fixed_bytes()),
                multiplier: multiplier_u96,
            })
        })
        .collect::<Result<_, _>>()?;

    // Convert operator rewards to alloy types.
    let rewards: Vec<OperatorReward> = operator_rewards
        .iter()
        .map(|(operator, amount)| OperatorReward {
            operator: Address::from(operator.as_fixed_bytes()),
            amount: U256::from(*amount),
        })
        .collect();

    let submission = OperatorDirectedRewardsSubmission {
        strategiesAndMultipliers: strategies,
        token: token_address,
        operatorRewards: rewards,
        startTimestamp: start_timestamp,
        duration,
        description: description.into(),
    };

    Ok(submitRewardsCall { submission }.abi_encode())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestOutboundQueue;

    impl SnowbridgeSendMessage for TestOutboundQueue {
        type Ticket = OutboundMessage;

        fn validate(message: &OutboundMessage) -> Result<Self::Ticket, SendError> {
            Ok(message.clone())
        }

        fn deliver(ticket: Self::Ticket) -> Result<H256, SendError> {
            Ok(ticket.id)
        }
    }

    /// Test era start timestamp used consistently across test cases.
    const TEST_ERA_START_TIMESTAMP: u32 = 1_700_000_000;

    struct HappyPathConfig;

    impl RewardsSubmissionConfig for HappyPathConfig {
        type OutboundQueue = TestOutboundQueue;

        fn strategies_and_multipliers() -> Vec<(H160, u128)> {
            vec![(H160::from_low_u64_be(0x9999), 1u128)]
        }

        fn rewards_duration() -> u32 {
            86_400
        }

        fn whave_token_address() -> H160 {
            H160::from_low_u64_be(0x1234)
        }

        fn service_manager_address() -> H160 {
            H160::from_low_u64_be(0x5678)
        }

        fn rewards_agent_origin() -> H256 {
            H256::from_low_u64_be(0x4242)
        }

        fn handle_remainder(_remainder: u128) {
            // No-op in tests
        }
    }

    struct ZeroServiceManagerConfig;

    impl RewardsSubmissionConfig for ZeroServiceManagerConfig {
        type OutboundQueue = TestOutboundQueue;

        fn rewards_duration() -> u32 {
            HappyPathConfig::rewards_duration()
        }

        fn whave_token_address() -> H160 {
            HappyPathConfig::whave_token_address()
        }

        fn service_manager_address() -> H160 {
            H160::zero()
        }

        fn rewards_agent_origin() -> H256 {
            HappyPathConfig::rewards_agent_origin()
        }

        fn handle_remainder(_remainder: u128) {
            // No-op in tests
        }
    }

    struct ZeroTokenConfig;

    impl RewardsSubmissionConfig for ZeroTokenConfig {
        type OutboundQueue = TestOutboundQueue;

        fn rewards_duration() -> u32 {
            HappyPathConfig::rewards_duration()
        }

        fn whave_token_address() -> H160 {
            H160::zero()
        }

        fn service_manager_address() -> H160 {
            HappyPathConfig::service_manager_address()
        }

        fn rewards_agent_origin() -> H256 {
            HappyPathConfig::rewards_agent_origin()
        }

        fn handle_remainder(_remainder: u128) {
            // No-op in tests
        }
    }

    struct InvalidMultiplierConfig;

    impl RewardsSubmissionConfig for InvalidMultiplierConfig {
        type OutboundQueue = TestOutboundQueue;

        fn strategies_and_multipliers() -> Vec<(H160, u128)> {
            const MAX_UINT96: u128 = (1u128 << 96) - 1;
            vec![(H160::from_low_u64_be(0x9999), MAX_UINT96 + 1)]
        }

        fn rewards_duration() -> u32 {
            HappyPathConfig::rewards_duration()
        }

        fn whave_token_address() -> H160 {
            HappyPathConfig::whave_token_address()
        }

        fn service_manager_address() -> H160 {
            HappyPathConfig::service_manager_address()
        }

        fn rewards_agent_origin() -> H256 {
            HappyPathConfig::rewards_agent_origin()
        }

        fn handle_remainder(_remainder: u128) {
            // No-op in tests
        }
    }

    #[test]
    fn test_calculate_operator_amounts_basic() {
        let points = vec![
            (H160::from_low_u64_be(1), 600),
            (H160::from_low_u64_be(2), 400),
        ];
        let (rewards, remainder) = points_to_rewards(&points, 1000, 1_000_000).unwrap();

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
        let (rewards, _) = points_to_rewards(&points, 1000, 1_000_000).unwrap();

        // Should be sorted by address
        assert!(rewards[0].0 < rewards[1].0);
    }

    #[test]
    fn test_calculate_operator_amounts_zero_points() {
        let points = vec![
            (H160::from_low_u64_be(1), 0),
            (H160::from_low_u64_be(2), 100),
        ];
        let (rewards, remainder) = points_to_rewards(&points, 100, 1_000_000).unwrap();

        assert_eq!(rewards.len(), 1);
        assert_eq!(rewards[0].0, H160::from_low_u64_be(2));
        assert_eq!(remainder, 0);
    }

    #[test]
    fn test_calculate_operator_amounts_remainder_cases() {
        struct Case {
            name: &'static str,
            points: Vec<(H160, u32)>,
            total_points: u128,
            inflation: u128,
            expected_rewards: Vec<(H160, u128)>,
            expected_remainder: u128,
        }

        let two_operator_points =
            vec![(H160::from_low_u64_be(1), 1), (H160::from_low_u64_be(2), 1)];
        let ten_operator_points: Vec<_> =
            (1..=10).map(|i| (H160::from_low_u64_be(i), 1u32)).collect();
        let ten_operator_rewards: Vec<_> = (1..=10)
            .map(|i| (H160::from_low_u64_be(i), 100u128))
            .collect();

        let cases = vec![
            Case {
                name: "2 operators / 1001 inflation",
                points: two_operator_points.clone(),
                total_points: 2u128,
                inflation: 1001u128,
                expected_rewards: vec![
                    (H160::from_low_u64_be(1), 500u128),
                    (H160::from_low_u64_be(2), 500u128),
                ],
                expected_remainder: 1u128,
            },
            Case {
                name: "3 operators / 100 inflation",
                points: vec![
                    (H160::from_low_u64_be(1), 1),
                    (H160::from_low_u64_be(2), 1),
                    (H160::from_low_u64_be(3), 1),
                ],
                total_points: 3u128,
                inflation: 100u128,
                expected_rewards: vec![
                    (H160::from_low_u64_be(1), 33u128),
                    (H160::from_low_u64_be(2), 33u128),
                    (H160::from_low_u64_be(3), 33u128),
                ],
                expected_remainder: 1u128,
            },
            Case {
                name: "2 operators uneven split / 1000 inflation",
                points: vec![
                    (H160::from_low_u64_be(1), 7),
                    (H160::from_low_u64_be(2), 11),
                ],
                total_points: 18u128,
                inflation: 1000u128,
                expected_rewards: vec![
                    (H160::from_low_u64_be(1), 388u128),
                    (H160::from_low_u64_be(2), 611u128),
                ],
                expected_remainder: 1u128,
            },
            Case {
                name: "3 operators weighted / 1_000_000 inflation",
                points: vec![
                    (H160::from_low_u64_be(1), 1),
                    (H160::from_low_u64_be(2), 2),
                    (H160::from_low_u64_be(3), 3),
                ],
                total_points: 6u128,
                inflation: 1_000_000u128,
                expected_rewards: vec![
                    (H160::from_low_u64_be(1), 166_666u128),
                    (H160::from_low_u64_be(2), 333_333u128),
                    (H160::from_low_u64_be(3), 500_000u128),
                ],
                expected_remainder: 1u128,
            },
            Case {
                name: "10 operators / 1009 inflation",
                points: ten_operator_points,
                total_points: 10u128,
                inflation: 1009u128,
                expected_rewards: ten_operator_rewards,
                expected_remainder: 9u128,
            },
        ];

        for case in cases {
            let (rewards, remainder) =
                points_to_rewards(&case.points, case.total_points, case.inflation).unwrap();

            assert_eq!(rewards, case.expected_rewards, "case: {}", case.name);
            assert_eq!(remainder, case.expected_remainder, "case: {}", case.name);

            let distributed: u128 = rewards.iter().map(|(_, a)| *a).sum();
            assert_eq!(
                distributed + remainder,
                case.inflation,
                "distributed + remainder should equal inflation (case: {})",
                case.name
            );
        }
    }

    #[test]
    fn test_points_to_rewards_multiplication_overflow() {
        // Test that multiplication overflow is detected and returns an error.
        // With points = u32::MAX and inflation = u128::MAX, the product would overflow.
        let operator = H160::from_low_u64_be(1);
        let points = vec![(operator, u32::MAX)];
        let inflation = u128::MAX;
        let total_points = 1u128;

        let result = points_to_rewards(&points, total_points, inflation);

        assert_eq!(result, Err(RewardsAdapterError::MultiplicationOverflow));
    }

    #[test]
    fn test_points_to_rewards_division_by_zero() {
        let operator = H160::from_low_u64_be(1);
        let points = vec![(operator, 1u32)];

        let result = points_to_rewards(&points, 0, 100);
        assert_eq!(result, Err(RewardsAdapterError::DivisionByZero));
    }

    #[test]
    fn test_encode_submit_rewards_calldata_selector() {
        // Verify the function selector matches the expected value
        // cast sig "submitRewards(((address,uint96)[],address,(address,uint256)[],uint32,uint32,string))" = 0x83821e8e
        let calldata = encode_rewards_calldata(
            H160::from_low_u64_be(0x1234),
            &[],
            &[(H160::from_low_u64_be(0x5678), 1000)],
            86400,
            86400,
            "test",
        )
        .expect("Encoding should succeed");

        // Check the function selector (first 4 bytes)
        assert_eq!(&calldata[0..4], &[0x83, 0x82, 0x1e, 0x8e]);
    }

    #[test]
    fn test_encode_submit_rewards_calldata_multiplier_overflow() {
        const MAX_UINT96: u128 = (1u128 << 96) - 1;
        let invalid_multiplier = MAX_UINT96 + 1;

        let result = encode_rewards_calldata(
            H160::from_low_u64_be(0x1234),
            &[(H160::from_low_u64_be(0x9999), invalid_multiplier)],
            &[(H160::from_low_u64_be(0x5678), 1000u128)],
            86400,
            86400,
            "test",
        );

        assert_eq!(result, Err(RewardsAdapterError::InvalidMultiplier));
    }

    #[test]
    fn test_encode_rewards_calldata_round_trip_decodes() {
        let token = H160::from_low_u64_be(0x1234);
        let strategy = H160::from_low_u64_be(0x9999);
        let multiplier = (1u128 << 80) + 123u128;
        let operator = H160::from_low_u64_be(0x5678);
        let amount = 1000u128;
        let start_timestamp = 86_400u32;
        let duration = 86_400u32;
        let description = "round trip";

        let calldata = encode_rewards_calldata(
            token,
            &[(strategy, multiplier)],
            &[(operator, amount)],
            start_timestamp,
            duration,
            description,
        )
        .expect("Encoding should succeed");

        let decoded = submitRewardsCall::abi_decode(&calldata, true).expect("Decoding should work");
        let submission = decoded.submission;

        assert_eq!(submission.token, Address::from(token.as_fixed_bytes()));
        assert_eq!(submission.startTimestamp, start_timestamp);
        assert_eq!(submission.duration, duration);
        assert_eq!(submission.description, description);

        assert_eq!(submission.operatorRewards.len(), 1);
        assert_eq!(
            submission.operatorRewards[0].operator,
            Address::from(operator.as_fixed_bytes())
        );
        assert_eq!(submission.operatorRewards[0].amount, U256::from(amount));

        assert_eq!(submission.strategiesAndMultipliers.len(), 1);
        assert_eq!(
            submission.strategiesAndMultipliers[0].strategy,
            Address::from(strategy.as_fixed_bytes())
        );

        let expected_multiplier_u96 =
            Uint::<96, 2>::from_limbs([multiplier as u64, (multiplier >> 64) as u64]);
        assert_eq!(
            submission.strategiesAndMultipliers[0].multiplier,
            expected_multiplier_u96
        );

        let empty_calldata =
            encode_rewards_calldata(token, &[], &[], start_timestamp, duration, "empty")
                .expect("Encoding should succeed");
        let empty_decoded =
            submitRewardsCall::abi_decode(&empty_calldata, true).expect("Decoding should work");
        let empty_submission = empty_decoded.submission;

        assert_eq!(
            empty_submission.token,
            Address::from(token.as_fixed_bytes())
        );
        assert_eq!(empty_submission.startTimestamp, start_timestamp);
        assert_eq!(empty_submission.duration, duration);
        assert_eq!(empty_submission.description, "empty");
        assert!(empty_submission.operatorRewards.is_empty());
        assert!(empty_submission.strategiesAndMultipliers.is_empty());
    }

    #[test]
    fn test_build_rewards_message_happy_path() {
        let rewards_utils = EraRewardsUtils {
            era_index: 7,
            era_start_timestamp: TEST_ERA_START_TIMESTAMP,
            total_points: 100u128,
            individual_points: vec![
                (H160::from_low_u64_be(2), 40),
                (H160::from_low_u64_be(1), 60),
            ],
            inflation_amount: 1_000_000u128,
        };

        let message = build_rewards_message::<HappyPathConfig>(&rewards_utils)
            .expect("Expected message to be built");

        assert_eq!(message.origin, HappyPathConfig::rewards_agent_origin());
        assert_eq!(
            message.id,
            H256::from_low_u64_be(rewards_utils.era_index as u64)
        );
        assert_eq!(message.fee, 0);
        assert_eq!(message.commands.len(), 1);

        let expected_operator_rewards = points_to_rewards(
            &rewards_utils.individual_points,
            rewards_utils.total_points,
            rewards_utils.inflation_amount,
        )
        .expect("Rewards calculation should succeed")
        .0;

        let expected_calldata = encode_rewards_calldata(
            HappyPathConfig::whave_token_address(),
            &HappyPathConfig::strategies_and_multipliers(),
            &expected_operator_rewards,
            rewards_utils.era_start_timestamp,
            HappyPathConfig::rewards_duration(),
            REWARDS_DESCRIPTION,
        )
        .expect("Calldata should encode");

        match &message.commands[0] {
            Command::CallContract {
                target,
                calldata,
                gas,
                value,
            } => {
                assert_eq!(*target, HappyPathConfig::service_manager_address());
                assert_eq!(*gas, SUBMIT_REWARDS_GAS_LIMIT);
                assert_eq!(*value, 0);
                assert_eq!(calldata, &expected_calldata);
            }
            other => panic!("Expected CallContract command, got {:?}", other),
        }
    }

    #[test]
    fn test_build_rewards_message_happy_path_with_remainder() {
        let rewards_utils = EraRewardsUtils {
            era_index: 7,
            era_start_timestamp: TEST_ERA_START_TIMESTAMP,
            total_points: 3u128,
            individual_points: vec![(H160::from_low_u64_be(1), 1), (H160::from_low_u64_be(2), 2)],
            inflation_amount: 100u128,
        };

        let (operator_rewards, remainder) = points_to_rewards(
            &rewards_utils.individual_points,
            rewards_utils.total_points,
            rewards_utils.inflation_amount,
        )
        .expect("Rewards calculation should succeed");
        assert!(remainder > 0, "Test case should yield a remainder");
        assert!(!operator_rewards.is_empty());

        let message = build_rewards_message::<HappyPathConfig>(&rewards_utils)
            .expect("Expected message to be built");

        let expected_calldata = encode_rewards_calldata(
            HappyPathConfig::whave_token_address(),
            &HappyPathConfig::strategies_and_multipliers(),
            &operator_rewards,
            rewards_utils.era_start_timestamp,
            HappyPathConfig::rewards_duration(),
            REWARDS_DESCRIPTION,
        )
        .expect("Calldata should encode");

        match &message.commands[0] {
            Command::CallContract { calldata, .. } => assert_eq!(calldata, &expected_calldata),
            other => panic!("Expected CallContract command, got {:?}", other),
        }
    }

    #[test]
    fn test_build_rewards_message_skips_on_zero_addresses() {
        let rewards_utils = EraRewardsUtils {
            era_index: 7,
            era_start_timestamp: TEST_ERA_START_TIMESTAMP,
            total_points: 1u128,
            individual_points: vec![(H160::from_low_u64_be(1), 1)],
            inflation_amount: 100u128,
        };

        assert!(build_rewards_message::<ZeroServiceManagerConfig>(&rewards_utils).is_none());
        assert!(build_rewards_message::<ZeroTokenConfig>(&rewards_utils).is_none());
    }

    #[test]
    fn test_build_rewards_message_skips_when_no_operator_rewards() {
        // total_points is much larger than points * inflation, so all amounts truncate to zero.
        let rewards_utils = EraRewardsUtils {
            era_index: 7,
            era_start_timestamp: TEST_ERA_START_TIMESTAMP,
            total_points: 1000u128,
            individual_points: vec![(H160::from_low_u64_be(1), 1)],
            inflation_amount: 1u128,
        };

        let message = build_rewards_message::<HappyPathConfig>(&rewards_utils);
        assert!(message.is_none());
    }

    #[test]
    fn test_build_rewards_message_skips_on_points_to_rewards_error_division_by_zero() {
        let rewards_utils = EraRewardsUtils {
            era_index: 7,
            era_start_timestamp: TEST_ERA_START_TIMESTAMP,
            total_points: 0u128,
            individual_points: vec![(H160::from_low_u64_be(1), 1)],
            inflation_amount: 100u128,
        };

        let message = build_rewards_message::<HappyPathConfig>(&rewards_utils);
        assert!(message.is_none());
    }

    #[test]
    fn test_build_rewards_message_skips_on_points_to_rewards_error_multiplication_overflow() {
        let rewards_utils = EraRewardsUtils {
            era_index: 7,
            era_start_timestamp: TEST_ERA_START_TIMESTAMP,
            total_points: 1u128,
            individual_points: vec![(H160::from_low_u64_be(1), u32::MAX)],
            inflation_amount: u128::MAX,
        };

        let message = build_rewards_message::<HappyPathConfig>(&rewards_utils);
        assert!(message.is_none());
    }

    #[test]
    fn test_build_rewards_message_skips_on_invalid_multiplier() {
        let rewards_utils = EraRewardsUtils {
            era_index: 7,
            era_start_timestamp: TEST_ERA_START_TIMESTAMP,
            total_points: 1u128,
            individual_points: vec![(H160::from_low_u64_be(1), 1)],
            inflation_amount: 100u128,
        };

        let message = build_rewards_message::<InvalidMultiplierConfig>(&rewards_utils);
        assert!(message.is_none());
    }

    #[test]
    fn test_rewards_submission_adapter_validate_and_deliver() {
        let rewards_utils = EraRewardsUtils {
            era_index: 7,
            era_start_timestamp: TEST_ERA_START_TIMESTAMP,
            total_points: 100u128,
            individual_points: vec![
                (H160::from_low_u64_be(2), 40),
                (H160::from_low_u64_be(1), 60),
            ],
            inflation_amount: 1_000_000u128,
        };

        let message = RewardsSubmissionAdapter::<HappyPathConfig>::build(&rewards_utils)
            .expect("Expected message to be built");
        let ticket = RewardsSubmissionAdapter::<HappyPathConfig>::validate(message.clone())
            .expect("Expected validation to succeed");
        let delivered_id = RewardsSubmissionAdapter::<HappyPathConfig>::deliver(ticket)
            .expect("Expected delivery to succeed");

        assert_eq!(delivered_id, message.id);
    }
}

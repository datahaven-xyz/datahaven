// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 Snowfork <hello@snowfork.com>
//! Governance API for controlling the Ethereum side of the bridge
use super::*;
use frame_support::{
	migrations::VersionedMigration,
	pallet_prelude::*,
	traits::{OnRuntimeUpgrade, UncheckedOnRuntimeUpgrade},
	weights::Weight,
};
use log;
use sp_std::marker::PhantomData;

#[cfg(feature = "try-runtime")]
use sp_runtime::TryRuntimeError;

const LOG_TARGET: &str = "ethereum_system::migration";

/// The in-code storage version.
pub const STORAGE_VERSION: StorageVersion = StorageVersion::new(1);

pub mod v0 {
	use super::*;

	pub struct InitializeOnUpgrade<T, BridgeHubParaId, AssetHubParaId>(
		PhantomData<(T, BridgeHubParaId, AssetHubParaId)>,
	);

	impl<T, BridgeHubParaId, AssetHubParaId> OnRuntimeUpgrade
		for InitializeOnUpgrade<T, BridgeHubParaId, AssetHubParaId>
	where
		T: Config,
		BridgeHubParaId: Get<u32>,
		AssetHubParaId: Get<u32>,
	{
		fn on_runtime_upgrade() -> Weight {
			if !Pallet::<T>::is_initialized() {
				Pallet::<T>::initialize(
					BridgeHubParaId::get().into(),
					AssetHubParaId::get().into(),
				)
				.expect("infallible; qed");
				log::info!(
					target: LOG_TARGET,
					"Ethereum system initialized."
				);
				T::DbWeight::get().reads_writes(2, 5)
			} else {
				log::info!(
					target: LOG_TARGET,
					"Ethereum system already initialized. Skipping."
				);
				T::DbWeight::get().reads(2)
			}
		}

		#[cfg(feature = "try-runtime")]
		fn pre_upgrade() -> Result<Vec<u8>, TryRuntimeError> {
			if !Pallet::<T>::is_initialized() {
				log::info!(
					target: LOG_TARGET,
					"Agents and channels not initialized. Initialization will run."
				);
			} else {
				log::info!(
					target: LOG_TARGET,
					"Agents and channels are initialized. Initialization will not run."
				);
			}
			Ok(vec![])
		}

		#[cfg(feature = "try-runtime")]
		fn post_upgrade(_: Vec<u8>) -> Result<(), TryRuntimeError> {
			frame_support::ensure!(
				Pallet::<T>::is_initialized(),
				"Agents and channels were not initialized."
			);
			Ok(())
		}
	}
}

pub mod v1 {
	use super::*;

	#[cfg(feature = "try-runtime")]
	use sp_core::U256;

	/// Descreases the fee per gas.
	pub struct FeePerGasMigration<T>(PhantomData<T>);

	#[cfg(feature = "try-runtime")]
	impl<T> FeePerGasMigration<T>
	where
		T: Config,
	{
		/// Calculate the fee required to pay for gas on Ethereum.
		fn calculate_remote_fee_v1(params: &PricingParametersOf<T>) -> U256 {
			use snowbridge_outbound_queue_primitives::v1::{
				AgentExecuteCommand, Command, ConstantGasMeter, GasMeter,
			};
			let command = Command::AgentExecute {
				agent_id: H256::zero(),
				command: AgentExecuteCommand::TransferToken {
					token: H160::zero(),
					recipient: H160::zero(),
					amount: 0,
				},
			};
			let gas_used_at_most = ConstantGasMeter::maximum_gas_used_at_most(&command);
			params
				.fee_per_gas
				.saturating_mul(gas_used_at_most.into())
				.saturating_add(params.rewards.remote)
		}

		/// Calculate the fee required to pay for gas on Ethereum.
		fn calculate_remote_fee_v2(params: &PricingParametersOf<T>) -> U256 {
			use snowbridge_outbound_queue_primitives::v2::{Command, ConstantGasMeter, GasMeter};
			let command = Command::UnlockNativeToken {
				token: H160::zero(),
				recipient: H160::zero(),
				amount: 0,
			};
			let gas_used_at_most = ConstantGasMeter::maximum_dispatch_gas_used_at_most(&command);
			params
				.fee_per_gas
				.saturating_mul(gas_used_at_most.into())
				.saturating_add(params.rewards.remote)
		}
	}

	/// The percentage gas increase. We must adjust the fee per gas by this percentage.
	const GAS_INCREASE_PERCENTAGE: u64 = 70;

	impl<T> UncheckedOnRuntimeUpgrade for FeePerGasMigration<T>
	where
		T: Config,
	{
		fn on_runtime_upgrade() -> Weight {
			let mut params = Pallet::<T>::parameters();

			let old_fee_per_gas = params.fee_per_gas;

			// Fee per gas can be set based on a percentage in order to keep the remote fee the
			// same.
			params.fee_per_gas = params.fee_per_gas * GAS_INCREASE_PERCENTAGE / 100;

			log::info!(
				target: LOG_TARGET,
				"Fee per gas migrated from {old_fee_per_gas:?} to {0:?}.",
				params.fee_per_gas,
			);

			PricingParameters::<T>::put(params);
			T::DbWeight::get().reads_writes(1, 1)
		}

		#[cfg(feature = "try-runtime")]
		fn pre_upgrade() -> Result<Vec<u8>, TryRuntimeError> {
			use codec::Encode;

			let params = Pallet::<T>::parameters();
			let remote_fee_v1 = Self::calculate_remote_fee_v1(&params);
			let remote_fee_v2 = Self::calculate_remote_fee_v2(&params);

			log::info!(
				target: LOG_TARGET,
				"Pre fee per gas migration: pricing parameters = {params:?}, remote_fee_v1 = {remote_fee_v1:?}, remote_fee_v2 = {remote_fee_v2:?}"
			);
			Ok((params, remote_fee_v1, remote_fee_v2).encode())
		}

		#[cfg(feature = "try-runtime")]
		fn post_upgrade(state: Vec<u8>) -> Result<(), TryRuntimeError> {
			use codec::Decode;

			let (old_params, old_remote_fee_v1, old_remote_fee_v2): (
				PricingParametersOf<T>,
				U256,
				U256,
			) = Decode::decode(&mut &state[..]).unwrap();

			let params = Pallet::<T>::parameters();
			ensure!(old_params.exchange_rate == params.exchange_rate, "Exchange rate unchanged.");
			ensure!(old_params.rewards == params.rewards, "Rewards unchanged.");
			ensure!(
				(old_params.fee_per_gas * GAS_INCREASE_PERCENTAGE / 100) == params.fee_per_gas,
				"Fee per gas decreased."
			);
			ensure!(old_params.multiplier == params.multiplier, "Multiplier unchanged.");

			let remote_fee_v1 = Self::calculate_remote_fee_v1(&params);
			let remote_fee_v2 = Self::calculate_remote_fee_v2(&params);
			ensure!(
				remote_fee_v1 <= old_remote_fee_v1,
				"The v1 remote fee can cover the cost of the previous fee."
			);
			ensure!(
				remote_fee_v2 <= old_remote_fee_v2,
				"The v2 remote fee can cover the cost of the previous fee."
			);

			log::info!(
				target: LOG_TARGET,
				"Post fee per gas migration: pricing parameters = {params:?} remote_fee_v1 = {remote_fee_v1:?} remote_fee_v2 = {remote_fee_v2:?}"
			);
			Ok(())
		}
	}
}

/// Run the migration of the gas price and increment the pallet version so it cannot be re-run.
pub type FeePerGasMigrationV0ToV1<T> = VersionedMigration<
	0,
	1,
	v1::FeePerGasMigration<T>,
	Pallet<T>,
	<T as frame_system::Config>::DbWeight,
>;

# Substrate Validator Set Pallet

A [Substrate](https://github.com/paritytech/substrate/) pallet to add/remove authorities/validators in PoA networks.

**Note: Current master is compatible with Substrate [polkadot-v1.0.0](https://github.com/paritytech/substrate/tree/polkadot-v1.0.0) branch. For older versions, please see releases/tags.**

## Setup with Substrate Node Template

### Dependencies - runtime/cargo.toml

* Add the module's dependency in the `Cargo.toml` of your runtime directory. Make sure to enter the correct path or git url of the pallet as per your setup.

* Make sure that you also have the Substrate [session pallet](https://github.com/paritytech/substrate/tree/master/frame/session) as part of your runtime. This is because the validator-set pallet is dependent on the session pallet.

```toml
[dependencies.validator-set]
default-features = false
package = 'substrate-validator-set'
git = 'https://github.com/gautamdhameja/substrate-validator-set.git'
version = '0.9.42'

[dependencies.pallet-session]
default-features = false
git = 'https://github.com/paritytech/substrate.git'
branch = 'polkadot-v1.0.0'
```

```toml
std = [
	...
	'validator-set/std',
	'pallet-session/std',
]
```

### Pallet Initialization - runtime/src/lib.rs

* Import `OpaqueKeys` in your `runtime/src/lib.rs`.

```rust
use sp_runtime::traits::{
	AccountIdLookup, BlakeTwo256, Block as BlockT, Verify, IdentifyAccount, NumberFor, OpaqueKeys,
};
```

* Also in `runtime/src/lib.rs` import the `EnsureRoot` trait. This would change if you want to configure a custom origin (see below).

```rust
	use frame_system::EnsureRoot;
```

* Declare the pallet in your `runtime/src/lib.rs`. The pallet supports configurable origin and you can either set it to use one of the governance pallets (Collective, Democracy, etc.), or just use root as shown below. But **do not use a normal origin here** because the addition and removal of validators should be done using elevated privileges.

```rust
parameter_types! {
	pub const MinAuthorities: u32 = 2;
}

impl validator_set::Config for Runtime {
	type RuntimeEvent = RuntimeEvent;
	type AddRemoveOrigin = EnsureRoot<AccountId>;
	type MinAuthorities = MinAuthorities;
	type WeightInfo = validator_set::weights::SubstrateWeight<Runtime>;
}
```

* Also, declare the session pallet in  your `runtime/src/lib.rs`. Some of the type configuration of session pallet would depend on the ValidatorSet pallet as shown below.

```rust
parameter_types! {
	pub const Period: u32 = 2 * MINUTES;
	pub const Offset: u32 = 0;
}

impl pallet_session::Config for Runtime {
	type RuntimeEvent = RuntimeEvent;
	type ValidatorId = <Self as frame_system::Config>::AccountId;
	type ValidatorIdOf = validator_set::ValidatorOf<Self>;
	type ShouldEndSession = pallet_session::PeriodicSessions<Period, Offset>;
	type NextSessionRotation = pallet_session::PeriodicSessions<Period, Offset>;
	type SessionManager = ValidatorSet;
	type SessionHandler = <opaque::SessionKeys as OpaqueKeys>::KeyTypeIdProviders;
	type Keys = opaque::SessionKeys;
	type WeightInfo = ();
}
```

* Add `validator_set`, and `session` pallets in `construct_runtime` macro. **Make sure to add them before `Aura` and `Grandpa` pallets and after `Balances`. Also make sure that the `validator_set` pallet is added _before_ the `session` pallet, because it provides the initial validators at genesis, and must initialize first.**

```rust
construct_runtime!(
	pub enum Runtime where
		Block = Block,
		NodeBlock = opaque::Block,
		UncheckedExtrinsic = UncheckedExtrinsic
	{
		...
		Balances: pallet_balances,
		ValidatorSet: validator_set,
		Session: pallet_session,
		Aura: pallet_aura,
		Grandpa: pallet_grandpa,
		...
		...
	}
);
```

### Genesis config - chain_spec.rs

* Import `opaque::SessionKeys, ValidatorSetConfig, SessionConfig` from the runtime in `node/src/chain_spec.rs`.
  
```rust
use node_template_runtime::{
	AccountId, AuraConfig, BalancesConfig, GenesisConfig, GrandpaConfig,
	SudoConfig, SystemConfig, WASM_BINARY, Signature, 
	opaque::SessionKeys, ValidatorSetConfig, SessionConfig
};
```

* And then in `node/src/chain_spec.rs` update the key generation functions.

```rust
fn session_keys(aura: AuraId, grandpa: GrandpaId) -> SessionKeys {
	SessionKeys { aura, grandpa }
}

pub fn authority_keys_from_seed(s: &str) -> (AccountId, AuraId, GrandpaId) {
	(
		get_account_id_from_seed::<sr25519::Public>(s),
		get_from_seed::<AuraId>(s),
		get_from_seed::<GrandpaId>(s)
	)
}
```

* Add genesis config in the `chain_spec.rs` file for `session` and `validatorset` pallets, and update it for `Aura` and `Grandpa` pallets. Because the validators are provided by the `session` pallet, we do not initialize them explicitly for `Aura` and `Grandpa` pallets. Order is important, notice that `pallet_session` is declared after `pallet_balances` since it depends on it (session accounts should have some balance).

```rust
fn testnet_genesis(
	wasm_binary: &[u8],
	initial_authorities: Vec<(AccountId, AuraId, GrandpaId)>,
	root_key: AccountId,
	endowed_accounts: Vec<AccountId>,
	_enable_println: bool,
) -> GenesisConfig {
	GenesisConfig {
		system: SystemConfig {
			// Add Wasm runtime to storage.
			code: wasm_binary.to_vec(),
		},
		balances: BalancesConfig {
			// Configure endowed accounts with initial balance of 1 << 60.
			balances: endowed_accounts.iter().cloned().map(|k| (k, 1 << 60)).collect(),
		},
		validator_set: ValidatorSetConfig {
			initial_validators: initial_authorities.iter().map(|x| x.0.clone()).collect::<Vec<_>>(),
		},
		session: SessionConfig {
			keys: initial_authorities.iter().map(|x| {
				(x.0.clone(), x.0.clone(), session_keys(x.1.clone(), x.2.clone()))
			}).collect::<Vec<_>>(),
		},
		aura: AuraConfig {
			authorities: vec![],
		},
		grandpa: GrandpaConfig {
			authorities: vec![],
		},
		sudo: SudoConfig {
			// Assign network admin rights.
			key: Some(root_key),
		},
		transaction_payment: Default::default(),
	}
}
```

## Run

Once you have set up the pallet in your node/node-template and everything compiles, follow the steps in [docs/local-network-setup.md](./docs/local-network-setup.md) to run a local network and add validators.
Also, watch this video to see this in action - https://www.youtube.com/watch?v=lIYxE-tOAdw.

## Extensions

### Council-based Governance

Instead of using `sudo`, for a council-based governance, use the pallet with the `Collective` pallet. Follow the steps in [docs/council-integration.md](./docs/council-integration.md).

### Auto-removal Of Offline Validators

When a validator goes offline, it skips its block production slot and that causes increased block times. Sometimes, we want to remove these offline validators so that the block time can recover to normal. The `ImOnline` pallet, when added to a runtime, can report offline validators. The `ValidatorSet` pallet implements the required types to integrate with `ImOnline` pallet for automatic removal of offline validators. To use the `ValidatorSet` pallet with the `ImOnline` pallet, follow the steps in [docs/im-online-integration.md](./docs/im-online-integration.md).

## Disclaimer

This code is **not audited** for production use cases. You can expect security vulnerabilities. Do not use it without proper testing and audit in a production applications.

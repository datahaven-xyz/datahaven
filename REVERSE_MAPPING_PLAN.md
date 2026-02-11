# Reverse mapping plan (SolochainAddress -> EthAddress)

## Goal

Ensure slashing and rewards submissions that arrive with a validator's Solochain address are translated to the EigenLayer operator Eth address before calling EigenLayer, preventing “no rewards / no slashing” failures.

## Key files

- `contracts/src/DataHavenServiceManager.sol`
- `contracts/src/interfaces/IDataHavenServiceManager.sol`
- Tests:
  - `contracts/test/Slashing.t.sol`
  - `contracts/test/RewardsSubmitter.t.sol`
  - `contracts/test/storage/StorageLayout.t.sol`
- Storage layout tooling:
  - `contracts/storage-snapshots/DataHavenServiceManager.storage.json`
  - `contracts/script/fixtures/DataHavenServiceManagerBadLayout.sol`

## Implementation plan

### 1) Add reverse mapping + helper

- Add `mapping(address => address) public validatorSolochainAddressToEthAddress;` to `DataHavenServiceManager` alongside the existing forward mapping.
- Reduce `__GAP` length by 1 (from `uint256[46]` to `uint256[45]`) to preserve upgradeable layout shape.
- Add an internal helper like `_ethOperatorFromSolochain(address solochain)` that:
  - loads `validatorSolochainAddressToEthAddress[solochain]`
  - reverts if it is `address(0)`

### 2) Maintain mapping invariants during registration / updates

Update these functions in `DataHavenServiceManager.sol`:

- `registerOperator(...)`
  - Parse `solochain = _toAddress(data)` (also switch the length check to use `InvalidSolochainAddressLength()` instead of the string revert).
  - Enforce uniqueness: if `validatorSolochainAddressToEthAddress[solochain] != address(0)` and not equal to `operator`, revert (new custom error recommended).
  - If operator already had a previous solochain mapping, delete the old reverse entry.
  - Set both:
    - `validatorEthAddressToSolochainAddress[operator] = solochain`
    - `validatorSolochainAddressToEthAddress[solochain] = operator`
- `deregisterOperator(...)`
  - Read old `solochain = validatorEthAddressToSolochainAddress[operator]`.
  - Delete both forward and reverse entries.
- `updateSolochainAddressForValidator(address solochainAddress)`
  - Enforce `solochainAddress != address(0)`.
  - Enforce uniqueness against an existing assignment to a different operator.
  - Delete reverse entry for the old solochain value.
  - Set both forward + reverse to the new value.

### 3) Translate in slashing path + add checks

In `slashValidatorsOperator(SlashingRequest[] calldata slashings)`:

- For each request, compute `ethOperator = _ethOperatorFromSolochain(slashings[i].operator)`.
- Use `ethOperator` in `IAllocationManagerTypes.SlashingParams.operator`.
- This adds a strict check: unknown/unstored solochain addresses revert.

### 4) Translate in rewards path + add checks

In `submitRewards(OperatorDirectedRewardsSubmission calldata submission)`:

- Build a memory `OperatorDirectedRewardsSubmission` copy where each `operatorRewards[i].operator` is translated via `_ethOperatorFromSolochain(...)`.
- Keep all other fields identical.
- Pass the translated submission into `_REWARDS_COORDINATOR.createOperatorDirectedOperatorSetRewardsSubmission(...)`.
- Default decision: revert the whole submission if any operator is unmapped (prevents silent misdirection).

### 5) Update interface

In `contracts/src/interfaces/IDataHavenServiceManager.sol`:

- Add the new reverse-mapping getter:
  - `function validatorSolochainAddressToEthAddress(address solochain) external view returns (address);`
- Add explicit custom errors for the new checks (recommended), e.g.:
  - `error UnknownSolochainAddress();`
  - `error SolochainAddressAlreadyAssigned();`

### 6) Update the “bad layout” fixture

In `contracts/script/fixtures/DataHavenServiceManagerBadLayout.sol`:

- Mirror the added reverse mapping and update the gap size so the fixture remains a valid “layout shifted” negative test.

### 7) Add / update Foundry unit tests

#### `contracts/test/Slashing.t.sol`

- Register an operator with Eth operator != Solochain address (keep using `registerParams.data = abi.encodePacked(solochain)`).
- Create a `SlashingRequest` whose `operator` field is the solochain address.
- Assert the emitted `IAllocationManagerEvents.OperatorSlashed` shows the Eth operator (existing `expectEmit` pattern already validates this).
- Add a negative test: slashing with an unmapped solochain address reverts with `UnknownSolochainAddress()`.

#### `contracts/test/RewardsSubmitter.t.sol`

- Add setup step to register `operator1` (and optionally `operator2`) via allocation manager so reverse mapping exists.
- Build a submission whose `operatorRewards[*].operator` uses solochain.
- Use Foundry `vm.expectCall` on the RewardsCoordinator proxy to assert the calldata contains the Eth operator (translated) in `operatorRewards`.
- Add a negative test: submission with an unmapped solochain address reverts with `UnknownSolochainAddress()`.

#### `contracts/test/storage/StorageLayout.t.sol`

- Extend mapping-preservation test to assert reverse mapping is preserved across proxy upgrade:
  - set mapping pre-upgrade
  - upgrade
  - assert both `validatorEthAddressToSolochainAddress(eth)` and `validatorSolochainAddressToEthAddress(solo)` remain correct

### 8) Storage snapshot update

Because a new state variable is added:

- Regenerate snapshot:
  - `cd contracts && forge inspect DataHavenServiceManager storage --json > storage-snapshots/DataHavenServiceManager.storage.json`
- Run layout checks:
  - `./scripts/check-storage-layout.sh`
  - `./scripts/check-storage-layout-negative.sh`

### 9) Verification

- Run `forge test` (focus on updated tests).
- Run kluster code review (`kluster_code_review_auto`) on all modified files after changes.

## Notes / defaults

- Default behavior is strict: any unmapped solochain address in rewards/slashes causes a revert (avoids silent reward loss).
- Uniqueness check prevents two Eth operators from claiming the same solochain address.


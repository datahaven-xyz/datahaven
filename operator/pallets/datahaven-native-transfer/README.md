# DataHaven Native Transfer Pallet

A Substrate pallet that enables cross-chain transfers of DataHaven native tokens to and from Ethereum using the Snowbridge infrastructure.

## Overview

This pallet facilitates the transfer of DataHaven (DH) native tokens to Ethereum, where they are represented as wrapped ERC20 tokens. It implements a lock-and-mint mechanism: tokens are locked on DataHaven when transferred to Ethereum, and unlocked when transferred back.

## Features

- **Cross-chain Transfers**: Transfer DH tokens to Ethereum addresses
- **Token Locking**: Secure token locking in a sovereign account during transfers
- **Fee Management**: Mandatory fee collection for bridge relayers
- **Pause Mechanism**: Emergency pause functionality for security

## Fee Structure

Fees are mandatory for all transfers and serve to:
1. Compensate relayers for Ethereum gas costs
2. Provide incentive for timely message delivery
3. Prevent spam transactions

The fee is:
- Collected in DataHaven native tokens
- Transferred to a designated fee recipient account
- Separate from the transfer amount

### Fee Calculation Guidelines

When calculating fees, consider:
1. **Ethereum Gas Costs**: Estimate gas required for the Ethereum transaction
2. **Gas Price**: Current Ethereum gas prices (use oracles or fixed estimates)
3. **Exchange Rate**: DH to ETH conversion rate
4. **Relayer Margin**: Additional incentive

Example calculation:
```
Ethereum gas required: 100,000 gas
Gas price: 30 gwei
ETH cost: 0.003 ETH
DH/ETH rate: 1000 DH per ETH
Base fee: 3 DH
With 20% margin: 3.6 DH
```
## Extrinsics

### `transfer_to_ethereum`

Transfer DataHaven native tokens to an Ethereum address.

**Parameters:**
- `origin`: The account initiating the transfer
- `recipient`: The Ethereum address (H160) to receive the tokens
- `amount`: The amount of tokens to transfer
- `fee`: The fee to cover Ethereum gas costs and incentivize relayers (must be non-zero)

### `pause`

Pause all transfers. Only callable by `PauseOrigin` (typically governance).

### `unpause`

Resume transfers after pause. Only callable by `PauseOrigin`.

## Public Functions

### `total_locked_balance`

Get the total balance of tokens locked in the Ethereum sovereign account.

### `ethereum_sovereign_account`

Get the account ID of the Ethereum sovereign account for monitoring purposes.

## Events

- `TokensLocked`: Emitted when tokens are locked for transfer
- `TokensUnlocked`: Emitted when tokens are unlocked from Ethereum
- `TokensTransferredToEthereum`: Emitted on successful transfer to Ethereum
- `Paused`: Emitted when the pallet is paused
- `Unpaused`: Emitted when the pallet is unpaused

## Errors

- `InsufficientBalance`: Account has insufficient balance for transfer
- `Overflow`: Arithmetic overflow in calculations
- `SendMessageFailed`: Failed to send message through Snowbridge
- `InvalidEthereumAddress`: Provided Ethereum address is zero
- `InvalidAmount`: Transfer amount is zero
- `TransfersDisabled`: Transfers are paused
- `ZeroFee`: Fee cannot be zero

## Security Considerations

1. **Pause Mechanism**: The pallet can be paused by governance in case of emergencies
2. **Fee Validation**: All transfers require non-zero fees to prevent spam
3. **Balance Preservation**: The pallet uses `Preservation::Preserve` to maintain existential deposits
4. **Address Validation**: Zero Ethereum addresses are rejected

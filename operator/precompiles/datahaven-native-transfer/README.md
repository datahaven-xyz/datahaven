# DataHaven Native Transfer Precompile

This precompile exposes the `pallet-datahaven-native-transfer` functionality to the EVM layer, allowing smart contracts to transfer DataHaven native tokens to Ethereum via Snowbridge.

## Overview

The DataHaven Native Transfer precompile provides an EVM-compatible interface for:
- Transferring native tokens from DataHaven to Ethereum
- Managing the pallet's operational state (pause/unpause)
- Querying transfer statistics and system state

**Precompile Address:** `0x0000000000000000000000000000000000000819` (2073 decimal)

## Functions

### `transferToEthereum(address recipient, uint256 amount, uint256 fee)`

Transfers DataHaven native tokens to an Ethereum address via Snowbridge.

**Parameters:**
- `recipient`: Ethereum address to receive the tokens
- `amount`: Amount of tokens to transfer (in smallest unit)
- `fee`: Fee to incentivize relayers (in smallest unit)

**Requirements:**
- Caller must have sufficient balance for amount + fee
- `recipient` cannot be the zero address
- `amount` and `fee` must be greater than zero
- Pallet must not be paused
- Native token must be registered on Ethereum

**Example (Solidity):**
```solidity
import "./DataHavenNativeTransfer.sol";

contract MyContract {
    function sendToEthereum(address ethRecipient, uint256 amount) external {
        DATAHAVEN_NATIVE_TRANSFER_CONTRACT.transferToEthereum(
            ethRecipient,
            amount,
            100000000000000000 // 0.1 token fee
        );
    }
}
```

### `isPaused() view returns (bool)`

Checks if the pallet is currently paused.

**Returns:**
- `true` if paused (transfers disabled)
- `false` if operational (transfers enabled)

**Example (Solidity):**
```solidity
bool paused = DATAHAVEN_NATIVE_TRANSFER_CONTRACT.isPaused();
if (paused) {
    revert("Transfers are currently disabled");
}
```

### `totalLockedBalance() view returns (uint256)`

Returns the total amount of tokens currently locked in the Ethereum sovereign account.

**Returns:**
- Total locked balance in smallest unit

**Example (Solidity):**
```solidity
uint256 locked = DATAHAVEN_NATIVE_TRANSFER_CONTRACT.totalLockedBalance();
```

### `ethereumSovereignAccount() view returns (address)`

Returns the address of the Ethereum sovereign account that holds locked tokens.

**Returns:**
- The sovereign account address

**Example (Solidity):**
```solidity
address sovereign = DATAHAVEN_NATIVE_TRANSFER_CONTRACT.ethereumSovereignAccount();
```

## Events

### `TokensLocked(address indexed account, uint256 amount)`

Emitted when tokens are locked for transfer to Ethereum.

### `TokensUnlocked(address indexed account, uint256 amount)`

Emitted when tokens are unlocked from Ethereum (handled by pallet, not directly through precompile).

### `TokensTransferredToEthereum(address indexed from, address indexed to, uint256 amount)`

Emitted when a transfer to Ethereum is initiated.

### `Paused()`

Emitted when the pallet is paused.

### `Unpaused()`

Emitted when the pallet is unpaused.

## Error Handling

The precompile provides detailed error messages for common failure cases:

- **"Recipient cannot be zero address"**: The recipient parameter is the zero address
- **"Amount must be greater than zero"**: The amount parameter is zero
- **"Fee must be greater than zero"**: The fee parameter is zero
- **"Amount overflow"**: The amount exceeds u128::MAX
- **"Fee overflow"**: The fee exceeds u128::MAX
- **"InsufficientBalance"**: Caller doesn't have enough tokens
- **"TransfersDisabled"**: Pallet is paused
- **"TokenNotRegistered"**: Native token not registered on Ethereum
- **"BadOrigin"**: Caller doesn't have permission (for pause/unpause)

## Gas Costs

Approximate gas costs for each operation:

| Operation | Estimated Gas | Notes |
|-----------|--------------|-------|
| `transferToEthereum` | ~100,000-150,000 | Includes dispatch + storage writes |
| `pause` | ~30,000-50,000 | Simple dispatch |
| `unpause` | ~30,000-50,000 | Simple dispatch |
| `isPaused` (view) | ~2,000-5,000 | Single storage read |
| `totalLockedBalance` (view) | ~2,000-5,000 | Single storage read |
| `ethereumSovereignAccount` (view) | ~1,000-3,000 | Config read |

*Note: Actual gas costs may vary depending on runtime configuration and network conditions.*

## Integration Example

Complete example of integrating the precompile into a smart contract:

```solidity
// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./DataHavenNativeTransfer.sol";

contract CrossChainBridge {
    event TransferInitiated(address indexed from, address indexed to, uint256 amount);
    
    function bridgeToEthereum(
        address ethRecipient,
        uint256 amount,
        uint256 fee
    ) external {
        require(!DATAHAVEN_NATIVE_TRANSFER_CONTRACT.isPaused(), "Transfers paused");
        require(ethRecipient != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        
        DATAHAVEN_NATIVE_TRANSFER_CONTRACT.transferToEthereum(
            ethRecipient,
            amount,
            fee
        );
        
        emit TransferInitiated(msg.sender, ethRecipient, amount);
    }
    
    function getLockedBalance() external view returns (uint256) {
        return DATAHAVEN_NATIVE_TRANSFER_CONTRACT.totalLockedBalance();
    }
}
```

## Testing

The precompile includes a comprehensive test suite covering:

- ✅ Function selector validation
- ✅ Function modifier checks
- ✅ Successful transfer scenarios
- ✅ Error cases (zero address, zero amount, insufficient balance, etc.)
- ✅ Pause/unpause functionality
- ✅ View function correctness
- ✅ Gas accounting
- ✅ Edge cases and overflow handling

Run tests with:

```bash
cd operator/precompiles/datahaven-native-transfer
cargo test
```

## Security Considerations

1. **Existential Deposit**: Transfers respect the chain's existential deposit requirement. Ensure callers retain sufficient balance to keep their account alive.

2. **Fee Payment**: The fee is paid to the configured fee recipient separately from the amount being bridged. Ensure you have sufficient balance for both.

3. **Token Registration**: The native token must be registered on Ethereum before transfers can occur. Check this before initiating transfers.

4. **Pause Mechanism**: Only governance can pause the pallet. This is a safety mechanism for emergency situations.

5. **Snowbridge Dependency**: Transfers depend on the Snowbridge infrastructure. Monitor Snowbridge health before large transfers.

6. **No Reentrancy**: The precompile uses Frontier's reentrancy protection (`forbid-evm-reentrancy` feature).

## Architecture

```
┌─────────────────┐
│  EVM Contract   │
└────────┬────────┘
         │ calls precompile at 0x...07F5
         ↓
┌─────────────────────────────┐
│ DataHavenNativeTransfer     │
│      Precompile             │
│  ┌──────────────────────┐   │
│  │ Address Mapping      │   │
│  │ Type Conversions     │   │
│  │ Gas Accounting       │   │
│  │ Error Handling       │   │
│  └──────────┬───────────┘   │
└─────────────┼───────────────┘
              │ dispatches call
              ↓
┌─────────────────────────────┐
│ pallet-datahaven-native-    │
│         transfer             │
│  ┌──────────────────────┐   │
│  │ Lock tokens          │   │
│  │ Build message        │   │
│  │ Send via Snowbridge  │   │
│  └──────────┬───────────┘   │
└─────────────┼───────────────┘
              │
              ↓
        [ Snowbridge ]
              │
              ↓
        [ Ethereum ]
```

## Related Documentation

- [Snowbridge Documentation](https://docs.snowbridge.network/)
- [Frontier Precompiles Guide](https://github.com/polkadot-evm/frontier)
- [DataHaven Native Transfer Pallet](../../pallets/datahaven-native-transfer/)
- [EVM-Substrate Integration](https://docs.substrate.io/reference/how-to-guides/pallet-design/add-contracts-pallet/)

## License

This precompile is part of DataHaven and is licensed under GPL-3.0.

## Support

For issues or questions:
- GitHub Issues: [datahaven repository](https://github.com/datahavenxyz/datahaven)
- Documentation: [docs.datahaven.xyz](https://docs.datahaven.xyz)


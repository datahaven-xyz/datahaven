# Ethereum Inbound Queue V2

Reads messages from Ethereum and sends them to intended destination on Polkadot, using XCM.

## Architecture Overview

### Message Flow
**1. Ethereum Gateway Event:** A message is first emitted by a GatewayProxy contract on Ethereum in an OutboundMessageAccepted
event. This event contains:
- A nonce (for replay protection).
- Information about the originating address, asset(s), and XCM payload.
- Relayer fee and execution fee (both in Ether).
This event is emitted when the `v2_registerToken` and `v2_sendMessage` is called on Ethereum.

**2. Relayer Submits Proof:** A relayer gathers the event proof (containing the Ethereum event log and the proofs required:
receipts proof and execution header proof) and calls the `submit` extrinsic of this pallet.

**3. Verification:** The supplied proof is verified by an on-chain Verifier (configured in the runtime as the EthereumBeaconClient).
The verifier checks that the header containing the message is valid. If verification fails, the submission is rejected.

**4. Message Conversion:** Once verified, the message data is translated into XCM via a MessageConverter implementation.
This translation includes extracting payload details, XCM instructions, and bridging asset references.

**5. XCM Dispatch:** The resulting XCM message is dispatched to the target AssetHub parachain for further processing. Depending
on the `xcm` provided in the payload, more messages may be sent to parachains after AssetHub.

**6. Relayer Reward:** The relayer is rewarded with Ether (the relayer_fee portion), paid out by the configured RewardPayment
handler, which accumulates rewards against a relayer account, which may be claimed.

### Key Components
#### Verifier
A trait-based component (snowbridge_inbound_queue_primitives::Verifier) responsible for verifying Ethereum events and proofs.
The implementation for the verifier is the Ethereum client.

#### Message Converter
Translates the Ethereum-provided message data (Message) into XCM instructions. The default implementation uses logic in MessageToXcm.

#### Reward Payment
Handles paying out Ether-based rewards to the relayer.

#### Operating Mode
A gating mechanism allowing governance to halt or resume inbound message processing.

### Extrinsics

The pallet provides the following public extrinsics:

**1. Message Submission: `submit`**

Primary extrinsic for inbound messages. Relayers call this with a proof of the Gateway event from Ethereum. The process
is described in [message-flow](#message-flow).

```
pub fn submit(
    origin: OriginFor<T>,
    event: Box<EventProof>,
) -> DispatchResult
```

**2. Governance: `set_operating_mode`**

Allows governance (Root origin) to set the operating mode of the pallet. This can be used to:

- Halt all incoming message processing (Halted state).
- Resume normal operation or set other custom states.

```
pub fn set_operating_mode(
    origin: OriginFor<T>,
    mode: BasicOperatingMode,
) -> DispatchResult
```


import {
  BspAddedToAllowlist as BspAddedToAllowlistEvent,
  BspRemovedFromAllowlist as BspRemovedFromAllowlistEvent,
  Initialized as InitializedEvent,
  MspAddedToAllowlist as MspAddedToAllowlistEvent,
  MspRemovedFromAllowlist as MspRemovedFromAllowlistEvent,
  OperatorDeregistered as OperatorDeregisteredEvent,
  OperatorRegistered as OperatorRegisteredEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  RewardsInitiatorUpdated as RewardsInitiatorUpdatedEvent,
  RewardsRegistrySet as RewardsRegistrySetEvent,
  SnowbridgeGatewaySet as SnowbridgeGatewaySetEvent,
  ValidatorAddedToAllowlist as ValidatorAddedToAllowlistEvent,
  ValidatorRemovedFromAllowlist as ValidatorRemovedFromAllowlistEvent
} from "../generated/DataHavenServiceManager/DataHavenServiceManager"
import {
  BspAddedToAllowlist,
  BspRemovedFromAllowlist,
  Initialized,
  MspAddedToAllowlist,
  MspRemovedFromAllowlist,
  OperatorDeregistered,
  OperatorRegistered,
  OwnershipTransferred,
  RewardsInitiatorUpdated,
  RewardsRegistrySet,
  SnowbridgeGatewaySet,
  ValidatorAddedToAllowlist,
  ValidatorRemovedFromAllowlist
} from "../generated/schema"

export function handleBspAddedToAllowlist(
  event: BspAddedToAllowlistEvent
): void {
  let entity = new BspAddedToAllowlist(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.bsp = event.params.bsp

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleBspRemovedFromAllowlist(
  event: BspRemovedFromAllowlistEvent
): void {
  let entity = new BspRemovedFromAllowlist(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.bsp = event.params.bsp

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleInitialized(event: InitializedEvent): void {
  let entity = new Initialized(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.version = event.params.version

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMspAddedToAllowlist(
  event: MspAddedToAllowlistEvent
): void {
  let entity = new MspAddedToAllowlist(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.msp = event.params.msp

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMspRemovedFromAllowlist(
  event: MspRemovedFromAllowlistEvent
): void {
  let entity = new MspRemovedFromAllowlist(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.msp = event.params.msp

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOperatorDeregistered(
  event: OperatorDeregisteredEvent
): void {
  let entity = new OperatorDeregistered(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.operator = event.params.operator
  entity.operatorSetId = event.params.operatorSetId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOperatorRegistered(event: OperatorRegisteredEvent): void {
  let entity = new OperatorRegistered(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.operator = event.params.operator
  entity.operatorSetId = event.params.operatorSetId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleRewardsInitiatorUpdated(
  event: RewardsInitiatorUpdatedEvent
): void {
  let entity = new RewardsInitiatorUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.prevRewardsInitiator = event.params.prevRewardsInitiator
  entity.newRewardsInitiator = event.params.newRewardsInitiator

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleRewardsRegistrySet(event: RewardsRegistrySetEvent): void {
  let entity = new RewardsRegistrySet(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.operatorSetId = event.params.operatorSetId
  entity.rewardsRegistry = event.params.rewardsRegistry

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleSnowbridgeGatewaySet(
  event: SnowbridgeGatewaySetEvent
): void {
  let entity = new SnowbridgeGatewaySet(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.snowbridgeGateway = event.params.snowbridgeGateway

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleValidatorAddedToAllowlist(
  event: ValidatorAddedToAllowlistEvent
): void {
  let entity = new ValidatorAddedToAllowlist(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.validator = event.params.validator

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleValidatorRemovedFromAllowlist(
  event: ValidatorRemovedFromAllowlistEvent
): void {
  let entity = new ValidatorRemovedFromAllowlist(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.validator = event.params.validator

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

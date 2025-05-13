import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
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
} from "../generated/DataHavenServiceManager/DataHavenServiceManager"

export function createBspAddedToAllowlistEvent(
  bsp: Address
): BspAddedToAllowlist {
  let bspAddedToAllowlistEvent = changetype<BspAddedToAllowlist>(newMockEvent())

  bspAddedToAllowlistEvent.parameters = new Array()

  bspAddedToAllowlistEvent.parameters.push(
    new ethereum.EventParam("bsp", ethereum.Value.fromAddress(bsp))
  )

  return bspAddedToAllowlistEvent
}

export function createBspRemovedFromAllowlistEvent(
  bsp: Address
): BspRemovedFromAllowlist {
  let bspRemovedFromAllowlistEvent =
    changetype<BspRemovedFromAllowlist>(newMockEvent())

  bspRemovedFromAllowlistEvent.parameters = new Array()

  bspRemovedFromAllowlistEvent.parameters.push(
    new ethereum.EventParam("bsp", ethereum.Value.fromAddress(bsp))
  )

  return bspRemovedFromAllowlistEvent
}

export function createInitializedEvent(version: i32): Initialized {
  let initializedEvent = changetype<Initialized>(newMockEvent())

  initializedEvent.parameters = new Array()

  initializedEvent.parameters.push(
    new ethereum.EventParam(
      "version",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(version))
    )
  )

  return initializedEvent
}

export function createMspAddedToAllowlistEvent(
  msp: Address
): MspAddedToAllowlist {
  let mspAddedToAllowlistEvent = changetype<MspAddedToAllowlist>(newMockEvent())

  mspAddedToAllowlistEvent.parameters = new Array()

  mspAddedToAllowlistEvent.parameters.push(
    new ethereum.EventParam("msp", ethereum.Value.fromAddress(msp))
  )

  return mspAddedToAllowlistEvent
}

export function createMspRemovedFromAllowlistEvent(
  msp: Address
): MspRemovedFromAllowlist {
  let mspRemovedFromAllowlistEvent =
    changetype<MspRemovedFromAllowlist>(newMockEvent())

  mspRemovedFromAllowlistEvent.parameters = new Array()

  mspRemovedFromAllowlistEvent.parameters.push(
    new ethereum.EventParam("msp", ethereum.Value.fromAddress(msp))
  )

  return mspRemovedFromAllowlistEvent
}

export function createOperatorDeregisteredEvent(
  operator: Address,
  operatorSetId: BigInt
): OperatorDeregistered {
  let operatorDeregisteredEvent =
    changetype<OperatorDeregistered>(newMockEvent())

  operatorDeregisteredEvent.parameters = new Array()

  operatorDeregisteredEvent.parameters.push(
    new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator))
  )
  operatorDeregisteredEvent.parameters.push(
    new ethereum.EventParam(
      "operatorSetId",
      ethereum.Value.fromUnsignedBigInt(operatorSetId)
    )
  )

  return operatorDeregisteredEvent
}

export function createOperatorRegisteredEvent(
  operator: Address,
  operatorSetId: BigInt
): OperatorRegistered {
  let operatorRegisteredEvent = changetype<OperatorRegistered>(newMockEvent())

  operatorRegisteredEvent.parameters = new Array()

  operatorRegisteredEvent.parameters.push(
    new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator))
  )
  operatorRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "operatorSetId",
      ethereum.Value.fromUnsignedBigInt(operatorSetId)
    )
  )

  return operatorRegisteredEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createRewardsInitiatorUpdatedEvent(
  prevRewardsInitiator: Address,
  newRewardsInitiator: Address
): RewardsInitiatorUpdated {
  let rewardsInitiatorUpdatedEvent =
    changetype<RewardsInitiatorUpdated>(newMockEvent())

  rewardsInitiatorUpdatedEvent.parameters = new Array()

  rewardsInitiatorUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "prevRewardsInitiator",
      ethereum.Value.fromAddress(prevRewardsInitiator)
    )
  )
  rewardsInitiatorUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "newRewardsInitiator",
      ethereum.Value.fromAddress(newRewardsInitiator)
    )
  )

  return rewardsInitiatorUpdatedEvent
}

export function createRewardsRegistrySetEvent(
  operatorSetId: BigInt,
  rewardsRegistry: Address
): RewardsRegistrySet {
  let rewardsRegistrySetEvent = changetype<RewardsRegistrySet>(newMockEvent())

  rewardsRegistrySetEvent.parameters = new Array()

  rewardsRegistrySetEvent.parameters.push(
    new ethereum.EventParam(
      "operatorSetId",
      ethereum.Value.fromUnsignedBigInt(operatorSetId)
    )
  )
  rewardsRegistrySetEvent.parameters.push(
    new ethereum.EventParam(
      "rewardsRegistry",
      ethereum.Value.fromAddress(rewardsRegistry)
    )
  )

  return rewardsRegistrySetEvent
}

export function createSnowbridgeGatewaySetEvent(
  snowbridgeGateway: Address
): SnowbridgeGatewaySet {
  let snowbridgeGatewaySetEvent =
    changetype<SnowbridgeGatewaySet>(newMockEvent())

  snowbridgeGatewaySetEvent.parameters = new Array()

  snowbridgeGatewaySetEvent.parameters.push(
    new ethereum.EventParam(
      "snowbridgeGateway",
      ethereum.Value.fromAddress(snowbridgeGateway)
    )
  )

  return snowbridgeGatewaySetEvent
}

export function createValidatorAddedToAllowlistEvent(
  validator: Address
): ValidatorAddedToAllowlist {
  let validatorAddedToAllowlistEvent =
    changetype<ValidatorAddedToAllowlist>(newMockEvent())

  validatorAddedToAllowlistEvent.parameters = new Array()

  validatorAddedToAllowlistEvent.parameters.push(
    new ethereum.EventParam("validator", ethereum.Value.fromAddress(validator))
  )

  return validatorAddedToAllowlistEvent
}

export function createValidatorRemovedFromAllowlistEvent(
  validator: Address
): ValidatorRemovedFromAllowlist {
  let validatorRemovedFromAllowlistEvent =
    changetype<ValidatorRemovedFromAllowlist>(newMockEvent())

  validatorRemovedFromAllowlistEvent.parameters = new Array()

  validatorRemovedFromAllowlistEvent.parameters.push(
    new ethereum.EventParam("validator", ethereum.Value.fromAddress(validator))
  )

  return validatorRemovedFromAllowlistEvent
}

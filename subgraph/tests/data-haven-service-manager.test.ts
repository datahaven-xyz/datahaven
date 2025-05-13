import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { BspAddedToAllowlist } from "../generated/schema"
import { BspAddedToAllowlist as BspAddedToAllowlistEvent } from "../generated/DataHavenServiceManager/DataHavenServiceManager"
import { handleBspAddedToAllowlist } from "../src/data-haven-service-manager"
import { createBspAddedToAllowlistEvent } from "./data-haven-service-manager-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let bsp = Address.fromString("0x0000000000000000000000000000000000000001")
    let newBspAddedToAllowlistEvent = createBspAddedToAllowlistEvent(bsp)
    handleBspAddedToAllowlist(newBspAddedToAllowlistEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("BspAddedToAllowlist created and stored", () => {
    assert.entityCount("BspAddedToAllowlist", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "BspAddedToAllowlist",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "bsp",
      "0x0000000000000000000000000000000000000001"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})

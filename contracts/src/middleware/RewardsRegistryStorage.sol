// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import {Initializable} from "@openzeppelin-upgrades/contracts/proxy/utils/Initializable.sol";
import {IRewardsRegistry} from "../interfaces/IRewardsRegistry.sol";

/**
 * @title Storage variables for the RewardsRegistry contract
 * @notice This storage contract is separate from the logic to simplify the upgrade process
 */
abstract contract RewardsRegistryStorage is Initializable, IRewardsRegistry {
    /**
     *
     *                            IMMUTABLES
     *
     */
    /// @notice Address of the AVS (Service Manager)
    address public avs;

    /**
     *
     *                            STATE VARIABLES
     *
     */

    /// @notice Address of the rewards agent contract
    address public rewardsAgent;

    /// @notice History of all merkle roots, accessible by index
    bytes32[] public merkleRootHistory;

    /// @notice Mapping from operator to merkle root index to claimed status
    mapping(address => mapping(uint256 => bool)) public operatorClaimedByIndex;

    /**
     * @notice Internal initializer to set up the AVS and rewards agent addresses
     * @param _avs Address of the AVS (Service Manager)
     * @param _rewardsAgent Address of the rewards agent contract
     */
    function __RewardsRegistryStorage_init(
        address _avs,
        address _rewardsAgent
    ) internal onlyInitializing {
        avs = _avs;
        rewardsAgent = _rewardsAgent;
    }

    // storage gap for upgradeability
    uint256[49] private __GAP;
}

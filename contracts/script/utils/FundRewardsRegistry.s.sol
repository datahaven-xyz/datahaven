// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Logging} from "./Logging.sol";
import {DHScriptStorage} from "./DHScriptStorage.s.sol";

/**
 * @title FundRewardsRegistry
 * @notice Utility script to fund the RewardsRegistry contract with ETH
 */
contract FundRewardsRegistry is Script, DHScriptStorage {
    uint256 public senderPrivateKey;
    address public sender;
    uint32 public operatorSetId;
    uint256 public amount;

    function setUp() public {
        // Get the sender private key from env or use a default
        senderPrivateKey = vm.envOr(
            "SENDER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80) // Anvil acc1
        );
        sender = vm.addr(senderPrivateKey);

        // Get the operator set ID from env or default to validators set (0)
        operatorSetId = uint32(vm.envOr("OPERATOR_SET_ID", uint256(0)));

        // Get the amount to fund from env or default to 1 ether
        string memory fundAmountStr = vm.envOr("FUND_AMOUNT", string("1"));
        amount = vm.parseUint(fundAmountStr) * 1e18;
    }

    function run() public {
        string memory network = vm.envOr("NETWORK", string("anvil"));

        Logging.logHeader("FUND REWARDS REGISTRY");
        console.log("|  Network: %s", network);
        console.log("|  Timestamp: %s", vm.toString(block.timestamp));
        console.log("|  Sender Address: %s", vm.toString(sender));
        console.log("|  Operator Set ID: %s", vm.toString(operatorSetId));
        console.log("|  Amount: %s ETH", vm.toString(amount / 1e18));
        Logging.logFooter();

        // Load DataHaven contracts
        _loadDHContracts(network);
        Logging.logInfo(string.concat("Loaded DataHaven contracts for network: ", network));

        // Get the rewards registry for the specified operator set
        address rewardsRegistry =
            address(serviceManager.operatorSetToRewardsRegistry(operatorSetId));
        require(rewardsRegistry != address(0), "Rewards registry not set for operator set");
        console.log("Rewards Registry address: %s", rewardsRegistry);

        // Get the initial balance of the rewards registry
        uint256 initialBalance = address(rewardsRegistry).balance;
        console.log("Initial Registry Balance: %s ETH", vm.toString(initialBalance / 1e18));

        // Only fund if the balance is less than 1 ETH
        if (initialBalance < 1 ether) {
            // Fund the rewards registry
            vm.broadcast(senderPrivateKey);
            (bool success,) = rewardsRegistry.call{value: amount}("");
            require(success, "Transfer failed");

            // Get the final balance of the rewards registry
            uint256 finalBalance = address(rewardsRegistry).balance;
            console.log("Final Registry Balance: %s ETH", vm.toString(finalBalance / 1e18));

            Logging.logInfo(
                string.concat(
                    "Successfully funded rewards registry with ", vm.toString(amount / 1e18), " ETH"
                )
            );
        } else {
            Logging.logInfo(
                string.concat("Skipped funding: Registry balance already has at least 1 ETH")
            );
        }
    }
}

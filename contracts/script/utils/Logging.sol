// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {console} from "forge-std/console.sol";

library Logging {
    // Logging helper constants
    string private constant HEADER1 = "============================================================";
    string private constant HEADER2 = "                                                            ";
    string private constant FOOTER = "============================================================";
    string private constant SEPARATOR =
        "------------------------------------------------------------";

    function logHeader(
        string memory title
    ) internal pure {
        console.log("");
        console.log(HEADER1);
        console.log("|  %s  |", title);
        console.log(SEPARATOR);
    }

    function logSection(
        string memory title
    ) internal pure {
        console.log("");
        console.log("|  %s:", title);
        console.log(SEPARATOR);
    }

    function logContractDeployed(string memory name, address contractAddress) internal pure {
        console.log("|  [+] %s: %s", name, contractAddress);
    }

    function logAgentOrigin(string memory name, string memory agentOrigin) internal pure {
        console.log("|  [+] %s: %s", name, agentOrigin);
    }

    function logStep(
        string memory message
    ) internal pure {
        console.log("|  >>> %s", message);
    }

    function logInfo(
        string memory message
    ) internal pure {
        console.log("|  [i] %s", message);
    }

    function logFooter() internal pure {
        console.log(FOOTER);
        console.log("");
    }

    function logProgress(uint16 step, uint16 totalSteps) internal pure {
        console.log("");
        console.log(
            "Progress: Step %d/%d completed (%d%%)", step, totalSteps, (step * 100) / totalSteps
        );
        console.log("");
    }
}

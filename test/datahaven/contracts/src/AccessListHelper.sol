// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AccessListHelper {
    uint256 private storedValue;

    // Function to set the stored value
    function setValue(uint256 _value) public {
        storedValue = _value;
    }

    // Function to load the stored value multiple times using assembly and sload
    function loadValueMultipleTimes(uint256 times) public view returns (uint256 total) {
        total = 0;
        uint256 loaded;
        for (uint256 i = 0; i < times; i++) {
            assembly {
                loaded := sload(storedValue.slot)
            }
            total += loaded;
        }

        return total;
    }
}

// pragma solidity ^0.8.0;

// import "./AccessListHelper.sol";

contract AccessListHelperProxy {
    AccessListHelper accessListHelper;

    constructor(address helper) {
        accessListHelper = AccessListHelper(helper);
    }

    function callHelper(uint256 times) public view returns (uint256 value) {
        value = accessListHelper.loadValueMultipleTimes(times);
    }
}

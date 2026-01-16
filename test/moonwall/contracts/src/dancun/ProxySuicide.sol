// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.24;

contract ProxyDeployer {
    event ContractDestroyed(address destroyedAddress);

    // Function to deploy a new Suicide contract
    function deployAndDestroy(address target) public  {
        Suicide newContract = new Suicide();
        newContract.destroy(target);
        emit ContractDestroyed(address(newContract));
    }

}

contract Suicide {
    constructor() payable {
    }

    function destroy(address target) public {
        selfdestruct(payable(target));
    }
}
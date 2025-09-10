# Call Permit Precompile

This precompile aims to be a general-purpose tool to perform gas-less
transactions.

It allows a user (we'll call her **Alice**) to sign a **call permit** with
MetaMask (using the EIP712 standard), which can then be dispatched by another
user (we'll call him **Bob**) with a transaction.

**Bob** can make a transaction to the **Call Permit Precompile** with the call
data and **Alice**'s signature. If the permit and signature are valid, the
precompile will perform the call on the behalf of **Alice**, as if **Alice**
made a transaction herself. **Bob** is thus paying the transaction fees and
**Alice** can perform a call without having any native currency to pay for fees
(she'll still need to have some if the call includes a transfer).

## How to sign the permit

The following code is an example that is working in a Metamask-injected webpage.
**Bob** then need to make a transaction towards the precompile address with the same
data and **Alice**'s signature.

```js
await window.ethereum.enable();
const accounts = await window.ethereum.request({
  method: "eth_requestAccounts",
});

const from = accounts[0];
const to = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const value = 42;
const data = "0xdeadbeef";
const gaslimit = 100000;
const nonce = 0;
const deadline = 1000;

const createPermitMessageData = function () {
  const message = {
    from: from,
    to: to,
    value: value,
    data: data,
    gaslimit: gaslimit,
    nonce: nonce,
    deadline: deadline,
  };

  const typedData = JSON.stringify({
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      CallPermit: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
        { name: "gaslimit", type: "uint64" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "CallPermit",
    domain: {
      name: "Call Permit Precompile",
      version: "1",
      chainId: 0,
      verifyingContract: "0x000000000000000000000000000000000000080a",
    },
    message: message,
  });

  return {
    typedData,
    message,
  };
};

const method = "eth_signTypedData_v4";
const messageData = createPermitMessageData();
const params = [from, messageData.typedData];

web3.currentProvider.sendAsync(
  {
    method,
    params,
    from,
  },
  function (err, result) {
    if (err) return console.dir(err);
    if (result.error) {
      alert(result.error.message);
      return console.error("ERROR", result);
    }
    console.log("Signature:" + JSON.stringify(result.result));
  }
);
```

/**
 * Proxy precompile tests
 * Tests the Proxy precompile API for managing proxy accounts via EVM
 */

import { describeSuite, expect, fetchCompiledContract } from "@moonwall/cli";
import {
  ALITH_ADDRESS,
  BALTATHAR_ADDRESS,
  BALTATHAR_PRIVATE_KEY,
  CHARLETH_ADDRESS,
  CHARLETH_PRIVATE_KEY,
  createViemTransaction,
} from "@moonwall/util";
import { encodeFunctionData } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { expectEVMResult, PRECOMPILE_PROXY_ADDRESS } from "../../../../helpers";

// Proxy type constants (matching Substrate proxy types from Proxy.sol)
const CONTRACT_PROXY_TYPE_ANY = 0;
const CONTRACT_PROXY_TYPE_NON_TRANSFER = 1;
const CONTRACT_PROXY_TYPE_GOVERNANCE = 2;
const CONTRACT_PROXY_TYPE_STAKING = 3;
const CONTRACT_PROXY_TYPE_CANCEL_PROXY = 4;
const CONTRACT_PROXY_TYPE_BALANCES = 5;

// Invalid proxy type for testing error handling
const CONTRACT_PROXY_TYPE_INVALID = 99;

describeSuite({
  id: "D030601",
  title: "Precompile - Proxy",
  foundationMethods: "dev",
  testCases: ({ it, log, context }) => {
    it({
      id: "T01",
      title: "should succeed adding a proxy",
      test: async () => {
        const randomAccount = privateKeyToAccount(generatePrivateKey()).address;

        const rawTx = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "addProxy",
          args: [randomAccount, CONTRACT_PROXY_TYPE_STAKING, 0],
          rawTxOnly: true,
        });
        const { result } = await context.createBlock(rawTx);
        expectEVMResult(result!.events, "Succeed");

        // Verify proxy was added via substrate
        const proxies = await context.polkadotJs().query.proxy.proxies(ALITH_ADDRESS);
        const hasProxy = proxies[0].some(
          (p: any) =>
            p.delegate.toString() === randomAccount && p.proxyType.toString() === "Staking"
        );
        expect(hasProxy).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "should fail re-adding the same proxy",
      test: async () => {
        const randomAccount = privateKeyToAccount(generatePrivateKey()).address;

        // First add
        const rawTx = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "addProxy",
          args: [randomAccount, CONTRACT_PROXY_TYPE_STAKING, 0],
          rawTxOnly: true,
        });
        await context.createBlock(rawTx);

        // Second add should fail with exact error message
        await expect(
          async () =>
            await context.writeContract!({
              contractAddress: PRECOMPILE_PROXY_ADDRESS,
              contractName: "Proxy",
              functionName: "addProxy",
              args: [randomAccount, CONTRACT_PROXY_TYPE_STAKING, 0],
            })
        ).rejects.toThrowError("Cannot add more than one proxy");
      },
    });

    it({
      id: "T03",
      title: "should fail removing non-existent proxy",
      test: async () => {
        const randomAccount = privateKeyToAccount(generatePrivateKey()).address;

        await expect(
          async () =>
            await context.writeContract!({
              contractAddress: PRECOMPILE_PROXY_ADDRESS,
              contractName: "Proxy",
              functionName: "removeProxy",
              args: [randomAccount, CONTRACT_PROXY_TYPE_STAKING, 0],
            })
        ).rejects.toThrowError(/NotFound/i);
      },
    });

    it({
      id: "T04",
      title: "should succeed removing an existing proxy",
      test: async () => {
        const randomAccount = privateKeyToAccount(generatePrivateKey()).address;

        // Add proxy
        const addTx = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "addProxy",
          args: [randomAccount, CONTRACT_PROXY_TYPE_STAKING, 0],
          rawTxOnly: true,
        });
        await context.createBlock(addTx);

        // Remove proxy
        const rawTx = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "removeProxy",
          args: [randomAccount, CONTRACT_PROXY_TYPE_STAKING, 0],
          rawTxOnly: true,
        });
        const { result } = await context.createBlock(rawTx);
        expectEVMResult(result!.events, "Succeed");

        // Verify proxy was removed
        const proxies = await context.polkadotJs().query.proxy.proxies(ALITH_ADDRESS);
        const hasProxy = proxies[0].some((p: any) => p.delegate.toString() === randomAccount);
        expect(hasProxy).to.be.false;
      },
    });

    it({
      id: "T05",
      title: "should succeed removing all proxies",
      test: async () => {
        // First ensure no proxies exist
        const proxiesInitial = await context.polkadotJs().query.proxy.proxies(ALITH_ADDRESS);
        if (proxiesInitial[0].length > 0) {
          const clearTx = await context.writeContract!({
            contractAddress: PRECOMPILE_PROXY_ADDRESS,
            contractName: "Proxy",
            functionName: "removeProxies",
            rawTxOnly: true,
          });
          await context.createBlock(clearTx);
        }

        // Add exactly two proxies
        const account1 = privateKeyToAccount(generatePrivateKey()).address;
        const account2 = privateKeyToAccount(generatePrivateKey()).address;

        const addTx1 = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "addProxy",
          args: [account1, CONTRACT_PROXY_TYPE_STAKING, 0],
          rawTxOnly: true,
        });
        await context.createBlock(addTx1);

        const addTx2 = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "addProxy",
          args: [account2, CONTRACT_PROXY_TYPE_GOVERNANCE, 0],
          rawTxOnly: true,
        });
        await context.createBlock(addTx2);

        const proxiesBefore = await context.polkadotJs().query.proxy.proxies(ALITH_ADDRESS);
        expect(proxiesBefore[0].length).toBe(2);

        // Remove all proxies
        const rawTx = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "removeProxies",
          rawTxOnly: true,
        });
        const { result } = await context.createBlock(rawTx);
        expectEVMResult(result!.events, "Succeed");

        const proxiesAfter = await context.polkadotJs().query.proxy.proxies(ALITH_ADDRESS);
        expect(proxiesAfter[0].length).toBe(0);
      },
    });

    it({
      id: "T06",
      title: "should correctly report proxy status via isProxy",
      test: async () => {
        const randomAccount = privateKeyToAccount(generatePrivateKey()).address;

        // Check isProxy returns false before adding any proxy
        const isProxyBefore = await context.readContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "isProxy",
          args: [ALITH_ADDRESS, randomAccount, CONTRACT_PROXY_TYPE_STAKING, 0],
        });
        expect(isProxyBefore).to.be.false;

        // Add proxy
        const rawTx = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "addProxy",
          args: [randomAccount, CONTRACT_PROXY_TYPE_STAKING, 0],
          rawTxOnly: true,
        });
        await context.createBlock(rawTx);

        // Check isProxy returns true for correct parameters
        const isProxy = await context.readContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "isProxy",
          args: [ALITH_ADDRESS, randomAccount, CONTRACT_PROXY_TYPE_STAKING, 0],
        });
        expect(isProxy).to.be.true;

        // Check isProxy returns false for wrong type
        const isProxyWrongType = await context.readContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "isProxy",
          args: [ALITH_ADDRESS, randomAccount, CONTRACT_PROXY_TYPE_ANY, 0],
        });
        expect(isProxyWrongType).to.be.false;

        // Check isProxy returns false for wrong delay
        const isProxyWrongDelay = await context.readContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "isProxy",
          args: [ALITH_ADDRESS, randomAccount, CONTRACT_PROXY_TYPE_STAKING, 2],
        });
        expect(isProxyWrongDelay).to.be.false;
      },
    });

    it({
      id: "T07",
      title: "should reject proxy call from non-proxy account",
      test: async () => {
        // BALTATHAR tries to make a proxy call on behalf of ALITH without being a proxy
        const { abi } = fetchCompiledContract("Proxy");
        await expect(
          async () =>
            await context.writeContract!({
              contractAddress: PRECOMPILE_PROXY_ADDRESS,
              contractName: "Proxy",
              functionName: "proxy",
              args: [ALITH_ADDRESS, CHARLETH_ADDRESS, "0x00"],
              privateKey: BALTATHAR_PRIVATE_KEY,
            })
        ).rejects.toThrowError("Not proxy");
      },
    });

    it({
      id: "T08",
      title: "should allow proxy call from valid proxy account",
      test: async () => {
        const privateKey = generatePrivateKey();
        const randomAccount = privateKeyToAccount(privateKey).address;

        // Add BALTATHAR as proxy for ALITH with Any type
        const rawTx = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "addProxy",
          args: [BALTATHAR_ADDRESS, CONTRACT_PROXY_TYPE_ANY, 0],
          rawTxOnly: true,
        });
        await context.createBlock(rawTx);

        // Use BALTATHAR to transfer value on behalf of ALITH
        const { abi } = fetchCompiledContract("Proxy");
        const proxyTx = await createViemTransaction(context, {
          to: PRECOMPILE_PROXY_ADDRESS,
          privateKey: BALTATHAR_PRIVATE_KEY,
          value: 1000n,
          data: encodeFunctionData({
            abi,
            functionName: "proxy",
            args: [ALITH_ADDRESS, randomAccount, "0x00"],
          }),
        });
        const { result: result2 } = await context.createBlock(proxyTx);
        expectEVMResult(result2!.events, "Succeed");

        // Verify transfer happened
        expect(await context.viem().getBalance({ address: randomAccount })).toBe(1000n);
      },
    });

    it({
      id: "T09",
      title: "should succeed with proxyForceType for matching proxy type",
      test: async () => {
        const privateKey = generatePrivateKey();
        const randomAccount = privateKeyToAccount(privateKey).address;

        // Add CHARLETH as Balances proxy for ALITH
        const rawTx = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "addProxy",
          args: [CHARLETH_ADDRESS, CONTRACT_PROXY_TYPE_BALANCES, 0],
          rawTxOnly: true,
        });
        await context.createBlock(rawTx);

        // Use CHARLETH to transfer value on behalf of ALITH using proxyForceType
        const { abi } = fetchCompiledContract("Proxy");
        const proxyTx = await createViemTransaction(context, {
          to: PRECOMPILE_PROXY_ADDRESS,
          privateKey: CHARLETH_PRIVATE_KEY,
          value: 500n,
          data: encodeFunctionData({
            abi,
            functionName: "proxyForceType",
            args: [ALITH_ADDRESS, CONTRACT_PROXY_TYPE_BALANCES, randomAccount, "0x00"],
          }),
        });
        const { result } = await context.createBlock(proxyTx);
        expectEVMResult(result!.events, "Succeed");

        // Verify transfer happened
        expect(await context.viem().getBalance({ address: randomAccount })).toBe(500n);
      },
    });

    it({
      id: "T10",
      title: "should fail proxyForceType with mismatched proxy type",
      test: async () => {
        // CHARLETH is a Balances proxy for ALITH (from T09 or set up here)
        const proxies = await context.polkadotJs().query.proxy.proxies(ALITH_ADDRESS);
        const hasBalancesProxy = proxies[0].some(
          (p: any) =>
            p.delegate.toString() === CHARLETH_ADDRESS && p.proxyType.toString() === "Balances"
        );

        if (!hasBalancesProxy) {
          const rawTx = await context.writeContract!({
            contractAddress: PRECOMPILE_PROXY_ADDRESS,
            contractName: "Proxy",
            functionName: "addProxy",
            args: [CHARLETH_ADDRESS, CONTRACT_PROXY_TYPE_BALANCES, 0],
            rawTxOnly: true,
          });
          await context.createBlock(rawTx);
        }

        // Try to use proxyForceType with Governance type (CHARLETH only has Balances)
        await expect(
          async () =>
            await context.writeContract!({
              contractAddress: PRECOMPILE_PROXY_ADDRESS,
              contractName: "Proxy",
              functionName: "proxyForceType",
              args: [ALITH_ADDRESS, CONTRACT_PROXY_TYPE_GOVERNANCE, BALTATHAR_ADDRESS, "0x00"],
              privateKey: CHARLETH_PRIVATE_KEY,
            })
        ).rejects.toThrowError(/Not proxy/i);
      },
    });

    it({
      id: "T11",
      title: "should fail addProxy with invalid proxy type value",
      test: async () => {
        const randomAccount = privateKeyToAccount(generatePrivateKey()).address;

        await expect(
          async () =>
            await context.writeContract!({
              contractAddress: PRECOMPILE_PROXY_ADDRESS,
              contractName: "Proxy",
              functionName: "addProxy",
              args: [randomAccount, CONTRACT_PROXY_TYPE_INVALID, 0],
            })
        ).rejects.toThrowError(/Failed decoding value to ProxyType/i);
      },
    });

    it({
      id: "T12",
      title: "should succeed removeProxies when no proxies exist",
      test: async () => {
        // Use a fresh account that has no proxies
        const privateKey = generatePrivateKey();
        const freshAccount = privateKeyToAccount(privateKey);

        // Fund the fresh account so it can make transactions
        const fundTx = await createViemTransaction(context, {
          to: freshAccount.address,
          value: 10n * 10n ** 18n, // 10 tokens
        });
        await context.createBlock(fundTx);

        // Verify no proxies exist for this account
        const proxiesBefore = await context
          .polkadotJs()
          .query.proxy.proxies(freshAccount.address);
        expect(proxiesBefore[0].length).toBe(0);

        // removeProxies should succeed even with no proxies
        const rawTx = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "removeProxies",
          privateKey: privateKey,
          rawTxOnly: true,
        });
        const { result } = await context.createBlock(rawTx);
        expectEVMResult(result!.events, "Succeed");
      },
    });

    it({
      id: "T13",
      title: "should correctly handle non-zero delay proxy",
      test: async () => {
        const randomAccount = privateKeyToAccount(generatePrivateKey()).address;
        const delay = 5;

        // Add proxy with non-zero delay
        const rawTx = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "addProxy",
          args: [randomAccount, CONTRACT_PROXY_TYPE_STAKING, delay],
          rawTxOnly: true,
        });
        const { result } = await context.createBlock(rawTx);
        expectEVMResult(result!.events, "Succeed");

        // Verify proxy was added with correct delay via substrate
        const proxies = await context.polkadotJs().query.proxy.proxies(ALITH_ADDRESS);
        const proxyEntry = proxies[0].find(
          (p: any) =>
            p.delegate.toString() === randomAccount && p.proxyType.toString() === "Staking"
        );
        expect(proxyEntry).toBeDefined();
        expect(proxyEntry.delay.toNumber()).toBe(delay);

        // isProxy should return true with correct delay
        const isProxyCorrectDelay = await context.readContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "isProxy",
          args: [ALITH_ADDRESS, randomAccount, CONTRACT_PROXY_TYPE_STAKING, delay],
        });
        expect(isProxyCorrectDelay).to.be.true;

        // isProxy should return false with wrong delay (0)
        const isProxyWrongDelay = await context.readContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "isProxy",
          args: [ALITH_ADDRESS, randomAccount, CONTRACT_PROXY_TYPE_STAKING, 0],
        });
        expect(isProxyWrongDelay).to.be.false;
      },
    });

    it({
      id: "T14",
      title: "should fail proxyForceType with invalid proxy type value",
      test: async () => {
        await expect(
          async () =>
            await context.writeContract!({
              contractAddress: PRECOMPILE_PROXY_ADDRESS,
              contractName: "Proxy",
              functionName: "proxyForceType",
              args: [ALITH_ADDRESS, CONTRACT_PROXY_TYPE_INVALID, CHARLETH_ADDRESS, "0x00"],
              privateKey: BALTATHAR_PRIVATE_KEY,
            })
        ).rejects.toThrowError(/Failed decoding value to ProxyType/i);
      },
    });

    it({
      id: "T15",
      title: "should fail adding proxy with different type for same delegate",
      test: async () => {
        const randomAccount = privateKeyToAccount(generatePrivateKey()).address;

        // First add with Staking type
        const rawTx = await context.writeContract!({
          contractAddress: PRECOMPILE_PROXY_ADDRESS,
          contractName: "Proxy",
          functionName: "addProxy",
          args: [randomAccount, CONTRACT_PROXY_TYPE_STAKING, 0],
          rawTxOnly: true,
        });
        await context.createBlock(rawTx);

        // Try to add same delegate with different type (Any - more permissive)
        await expect(
          async () =>
            await context.writeContract!({
              contractAddress: PRECOMPILE_PROXY_ADDRESS,
              contractName: "Proxy",
              functionName: "addProxy",
              args: [randomAccount, CONTRACT_PROXY_TYPE_ANY, 0],
            })
        ).rejects.toThrowError("Cannot add more than one proxy");

        // Try to add same delegate with different type (Governance - less permissive)
        await expect(
          async () =>
            await context.writeContract!({
              contractAddress: PRECOMPILE_PROXY_ADDRESS,
              contractName: "Proxy",
              functionName: "addProxy",
              args: [randomAccount, CONTRACT_PROXY_TYPE_GOVERNANCE, 0],
            })
        ).rejects.toThrowError("Cannot add more than one proxy");
      },
    });
  },
});

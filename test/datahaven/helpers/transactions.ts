// Ethers is used to handle post-london transactions
import type { DevModeContext } from "@moonwall/cli";
import { createViemTransaction } from "@moonwall/util";
import type { ApiPromise } from "@polkadot/api";
import type { SubmittableExtrinsic } from "@polkadot/api/promise/types";

export const DEFAULT_TXN_MAX_BASE_FEE = 10_000_000_000;

/**
 * Send a JSONRPC request to the node at http://localhost:9944.
 *
 * @param method - The JSONRPC request method.
 * @param params - The JSONRPC request params.
 */
export async function rpcToLocalNode(
  rpcPort: number,
  method: string,
  params: any[] = []
): Promise<any> {
  return fetch(`http://localhost:${rpcPort}`, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method,
      params,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  })
    .then((response) => response.json())
    .then((data: any) => {
      if ("error" in data && "result" in data) {
        const { error, result } = data;
        if (error) {
          throw new Error(`${error.code} ${error.message}: ${JSON.stringify(error.data)}`);
        }
        return result;
      }
      throw new Error("Unexpected response format");
    });
}

export const sendAllStreamAndWaitLast = async (
  api: ApiPromise,
  extrinsics: SubmittableExtrinsic[],
  { threshold = 500, batch = 200, timeout = 120000 } = {
    threshold: 500,
    batch: 200,
    timeout: 120000,
  }
) => {
  const promises: any[] = [];
  while (extrinsics.length > 0) {
    const pending = await api.rpc.author.pendingExtrinsics();
    if (pending.length < threshold) {
      const chunk = extrinsics.splice(0, Math.min(threshold - pending.length, batch));
      // console.log(`Sending ${chunk.length}tx (${extrinsics.length} left)`);
      promises.push(
        Promise.all(
          chunk.map((tx) => {
            return new Promise(async (resolve, reject) => {
              const timer = setTimeout(() => {
                reject("timed out");
                unsub();
              }, timeout);
              const unsub = await tx.send((result) => {
                // reset the timer
                if (result.isError) {
                  console.log(result.toHuman());
                  clearTimeout(timer);
                  reject(result.toHuman());
                }
                if (result.isInBlock) {
                  unsub();
                  clearTimeout(timer);
                  resolve(null);
                }
              });
            }).catch(() => {});
          })
        )
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  await Promise.all(promises);
};

// The parameters passed to the function are assumed to have all been converted to hexadecimal
export async function sendPrecompileTx(
  context: DevModeContext,
  precompileContractAddress: `0x${string}`,
  selectors: { [key: string]: string },
  from: string,
  privateKey: `0x${string}`,
  selector: string,
  parameters: string[]
) {
  let data: `0x${string}`;
  if (selectors[selector]) {
    data = `0x${selectors[selector]}`;
  } else {
    throw new Error(`selector doesn't exist on the precompile contract`);
  }

  for (const param of parameters) {
    data += param.slice(2).padStart(64, "0");
  }

  return context.createBlock(
    createViemTransaction(context, {
      from,
      privateKey,
      value: 0n,
      gas: 200_000n,
      to: precompileContractAddress,
      data,
    })
  );
}

export const ERC20_TOTAL_SUPPLY = 1_000_000_000n;

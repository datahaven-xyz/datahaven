/**
 * Precompile contract call helpers
 * Adapted from Moonbeam test suite
 */

import type { BlockCreation, DevModeContext, PrecompileCallOptions } from "@moonwall/cli";
import type { KeyringPair } from "@moonwall/util";

class PrecompileContract {
  precompileName: string;
  context: DevModeContext;
  privateKey?: `0x${string}`;
  gas?: bigint | "estimate";
  rawTxOnly?: boolean;
  signer?: KeyringPair;
  expectEvents?: [any];

  constructor(precompileName: string, context: DevModeContext) {
    this.precompileName = precompileName;
    this.context = context;
    this.reset();
  }

  reset() {
    this.privateKey = undefined;
    this.gas = undefined;
    this.rawTxOnly = true;
    this.signer = undefined;
    this.expectEvents = undefined;
    return this;
  }

  withPrivateKey(privateKey: `0x${string}`) {
    this.privateKey = privateKey;
    return this;
  }

  withGas(gas: bigint | "estimate") {
    this.gas = gas;
    return this;
  }

  withRawTxOnly(rawTxOnly: boolean) {
    if (rawTxOnly === false) {
      this.rawTxOnly = undefined;
    }
    return this;
  }

  withSigner(signer: KeyringPair) {
    this.signer = signer;
    return this;
  }

  withExpectEvents(expectEvents: [any]) {
    this.expectEvents = expectEvents;
    return this;
  }

  callExtrinsic(functionName: string, args: any[]): PrecompileCall {
    return this.callRpc(functionName, args, true);
  }

  callQuery(functionName: string, args: any[]): PrecompileCall {
    return this.callRpc(functionName, args, false);
  }

  private callRpc(functionName: string, args: any[], isExtrinsic: boolean): PrecompileCall {
    const params = {
      precompileName: this.precompileName,
      functionName,
      args,
      privateKey: this.privateKey,
      rawTxOnly: this.rawTxOnly,
      gas: this.gas,
    };
    const blockCreationOptions = {
      signer: this.signer,
      expectEvents: this.expectEvents,
    };
    if (!isExtrinsic) {
      return new ReadPrecompileCall(params, this.context, blockCreationOptions);
    }
    return new WritePrecompileCall(params, this.context, blockCreationOptions);
  }
}

export class PrecompileCall {
  params: PrecompileCallOptions;
  context: DevModeContext;
  blockCreationOptions: BlockCreation;

  constructor(
    params: PrecompileCallOptions,
    context: DevModeContext,
    blockCreationOptions: BlockCreation
  ) {
    this.params = params;
    this.context = context;
    this.blockCreationOptions = blockCreationOptions;
  }

  async tx(): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async block() {
    return await this.context.createBlock((await this.tx()) as any, this.blockCreationOptions);
  }
}

class ReadPrecompileCall extends PrecompileCall {
  async tx(): Promise<unknown> {
    return await this.context.readPrecompile!(this.params);
  }
}

class WritePrecompileCall extends PrecompileCall {
  async tx(): Promise<unknown> {
    return await this.context.writePrecompile!(this.params);
  }
}

export class Preimage extends PrecompileContract {
  constructor(context: DevModeContext) {
    super("Preimage", context);
  }

  notePreimage(data: string): PrecompileCall {
    return this.callExtrinsic("notePreimage", [data]);
  }

  unnotePreimage(data: string): PrecompileCall {
    return this.callExtrinsic("unnotePreimage", [data]);
  }
}

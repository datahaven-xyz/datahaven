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

export class Referenda extends PrecompileContract {
  constructor(context: DevModeContext) {
    super("Referenda", context);
  }

  placeDecisionDeposit(proposalIndex: number): PrecompileCall {
    return this.callExtrinsic("placeDecisionDeposit", [proposalIndex]);
  }

  submitAt(
    trackId: number,
    proposalHash: string,
    proposalLen: number,
    block: number
  ): PrecompileCall {
    return this.callExtrinsic("submitAt", [trackId, proposalHash, proposalLen, block]);
  }

  submitAfter(
    trackId: number,
    proposalHash: string,
    proposalLen: number,
    block: number
  ): PrecompileCall {
    return this.callExtrinsic("submitAfter", [trackId, proposalHash, proposalLen, block]);
  }

  refundDecisionDeposit(proposalIndex: number): PrecompileCall {
    return this.callExtrinsic("refundDecisionDeposit", [proposalIndex]);
  }
}

export class ConvictionVoting extends PrecompileContract {
  constructor(context: DevModeContext) {
    super("ConvictionVoting", context);
  }

  voteYes(proposalIndex: number, amount: bigint, conviction: bigint): PrecompileCall {
    return this.callExtrinsic("voteYes", [proposalIndex, amount, conviction]);
  }

  voteNo(proposalIndex: number, amount: bigint, conviction: bigint): PrecompileCall {
    return this.callExtrinsic("voteNo", [proposalIndex, amount, conviction]);
  }

  removeVote(proposalIndex: number): PrecompileCall {
    return this.callExtrinsic("removeVote", [proposalIndex]);
  }

  removeVoteForTrack(proposalIndex: number, trackId: number): PrecompileCall {
    return this.callExtrinsic("removeVoteForTrack", [proposalIndex, trackId]);
  }

  removeOtherVote(target: `0x${string}`, trackId: number, proposalIndex: number): PrecompileCall {
    return this.callExtrinsic("removeOtherVote", [target, trackId, proposalIndex]);
  }

  voteSplit(proposalIndex: number, ayes: bigint, nays: bigint): PrecompileCall {
    return this.callExtrinsic("voteSplit", [proposalIndex, ayes, nays]);
  }

  voteSplitAbstain(
    proposalIndex: number,
    ayes: bigint,
    nays: bigint,
    abstain: bigint
  ): PrecompileCall {
    return this.callExtrinsic("voteSplitAbstain", [proposalIndex, ayes, nays, abstain]);
  }

  votingFor(who: `0x${string}`, proposalIndex: number): PrecompileCall {
    return this.callQuery("votingFor", [who, proposalIndex]);
  }

  classLocksFor(who: `0x${string}`): PrecompileCall {
    return this.callQuery("classLocksFor", [who]);
  }

  delegate(
    trackId: number,
    target: `0x${string}`,
    conviction: bigint,
    amount: bigint
  ): PrecompileCall {
    return this.callExtrinsic("delegate", [trackId, target, conviction, amount]);
  }

  undelegate(trackId: number): PrecompileCall {
    return this.callExtrinsic("undelegate", [trackId]);
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

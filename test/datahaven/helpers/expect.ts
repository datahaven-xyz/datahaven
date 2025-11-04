import { type BlockCreationResponse, type DevModeContext, expect } from "@moonwall/cli";
import type { EventRecord } from "@polkadot/types/interfaces";
import type {
  ApiTypes,
  AugmentedEvent,
  AugmentedEvents,
  SubmittableExtrinsic,
} from "@polkadot/api/types";
import type { IEvent } from "@polkadot/types/types";

export type ExtractTuple<P> = P extends AugmentedEvent<"rxjs", infer T> ? T : never;

export async function expectOk<
  ApiType extends ApiTypes,
  Call extends
    | SubmittableExtrinsic<ApiType>
    | Promise<SubmittableExtrinsic<ApiType>>
    | string
    | Promise<string>,
  Calls extends Call | Call[],
  BlockCreation extends BlockCreationResponse<
    ApiType,
    // @ts-expect-error TODO: fix this
    Calls extends Call[] ? Awaited<Call>[] : Awaited<Call>
  >,
>(call: Promise<BlockCreation>): Promise<BlockCreation> {
  const block = await call;
  if (Array.isArray(block.result)) {
    block.result.forEach((r, idx) => {
      expect(
        r.successful,
        `tx[${idx}] - ${r.error?.name}${
          r.extrinsic
            ? `\n\t\t${r.extrinsic.method.section}.${r.extrinsic.method.method}(${r.extrinsic.args
                .map((d) => d.toHuman())
                .join("; ")})`
            : ""
        }`
      ).to.be.true;
    });
  } else {
    // @ts-expect-error TODO: fix this
    expect(block.result!.successful, block.result!.error?.name).to.be.true;
  }
  return block;
}

export function expectSubstrateEvent<
  ApiType extends ApiTypes,
  Call extends
    | SubmittableExtrinsic<ApiType>
    | Promise<SubmittableExtrinsic<ApiType>>
    | string
    | Promise<string>,
  Calls extends Call | Call[],
  Event extends AugmentedEvents<ApiType>,
  Section extends keyof Event,
  Method extends keyof Event[Section],
  Tuple extends ExtractTuple<Event[Section][Method]>,
>(
  //@ts-expect-error TODO: fix this
  block: BlockCreationResponse<ApiType, Calls extends Call[] ? Awaited<Call>[] : Awaited<Call>>,
  section: Section,
  method: Method
): IEvent<Tuple> {
  let event: EventRecord | undefined;
  if (Array.isArray(block.result)) {
    block.result.forEach((r) => {
      const foundEvents = r.events.filter(
        ({ event }) => event.section.toString() === section && event.method.toString() === method
      );
      if (foundEvents.length > 0) {
        expect(
          event,
          `Event ${section.toString()}.${method.toString()} appeared multiple times`
        ).toBeUndefined();
        expect(
          foundEvents,
          `Event ${section.toString()}.${method.toString()} appeared multiple times`
        ).to.be.length(1);
        event = foundEvents[0];
      }
    });
  } else {
    const foundEvents = (block.result! as any).events!.filter(
      (item: any) =>
        item.event.section.toString() === section && item.event.method.toString() === method
    );
    if (foundEvents.length > 0) {
      expect(
        foundEvents,
        `Event ${section.toString()}.${method.toString()} appeared multiple times`
      ).to.be.length(1);
      event = foundEvents[0];
    }
  }
  expect(
    event,
    `Event ${section.toString()}.${method.toString()} not found:\n${(Array.isArray(block.result)
      ? block.result.flatMap((r) => r.events)
      : block.result
        ? block.result.events
        : []
    )
      .map(({ event }) => `       - ${event.section.toString()}.${event.method.toString()}\n`)
      .join("")}`
  ).to.not.be.undefined;
  return event!.event as any;
}

export function expectSubstrateEvents<
  ApiType extends ApiTypes,
  Call extends
    | SubmittableExtrinsic<ApiType>
    | Promise<SubmittableExtrinsic<ApiType>>
    | string
    | Promise<string>,
  Calls extends Call | Call[],
  Event extends AugmentedEvents<ApiType>,
  Section extends keyof Event,
  Method extends keyof Event[Section],
  Tuple extends ExtractTuple<Event[Section][Method]>,
>(
  //@ts-expect-error TODO: fix this
  block: BlockCreationResponse<ApiType, Calls extends Call[] ? Awaited<Call>[] : Awaited<Call>>,
  section: Section,
  method: Method
): IEvent<Tuple>[] {
  const events: EventRecord[] = [];
  if (Array.isArray(block.result)) {
    block.result.forEach((r) => {
      const foundEvents = r.events.filter(
        ({ event }) => event.section.toString() === section && event.method.toString() === method
      );
      if (foundEvents.length > 0) {
        events.push(...foundEvents);
      }
    });
  } else {
    const foundEvents = (block.result! as any).events.filter(
      (item: any) =>
        item.event.section.toString() === section && item.event.method.toString() === method
    );
    if (foundEvents.length > 0) {
      events.push(...foundEvents);
    }
  }
  expect(events.length > 0).to.not.be.null;
  return events.map(({ event }) => event) as any;
}

export async function expectSystemEvent(
  blockHash: string,
  section: string,
  method: string,
  context: DevModeContext
): Promise<EventRecord> {
  const events = await getAllBlockEvents(blockHash, context);
  const foundEvents = events.filter(
    ({ event }) => event.section.toString() === section && event.method.toString() === method
  );
  const event = foundEvents[0];
  expect(
    foundEvents,
    `Event ${section.toString()}.${method.toString()} appeared multiple times`
  ).to.be.length(1);
  expect(event, `Event ${section.toString()}.${method.toString()} not found in block ${blockHash}`)
    .to.not.be.undefined;
  return event;
}

async function getAllBlockEvents(hash: string, context: DevModeContext): Promise<EventRecord[]> {
  const apiAt = await context.polkadotJs().at(hash);
  const events = await apiAt.query.system.events();
  return events;
}

import type { Id } from '#Id.js';
import { expectTypeOf, test } from 'vitest';
import IdFlake, { extractNodeId, extractSeq } from '#IdFlake.js';
import IdSortable from '#IdSortable.js';

test('CASE-ID-FLAKE-LAYOUT: configurable flake keeps branded IDs and lossless sequence types', () => {
  type EntityId = Id & { readonly entityId: unique symbol };
  const generator = new IdFlake<EntityId>({
    nodeId: new Uint8Array(8),
    sequenceBits: 12,
    nodeBits: 62,
    randomSource: (size) => new Uint8Array(size),
  });
  const id = generator.get();
  expectTypeOf(id).toEqualTypeOf<EntityId>();
  expectTypeOf(generator.tryGet()).toEqualTypeOf<EntityId | undefined>();
  expectTypeOf(new IdSortable<EntityId>().tryGet()).toEqualTypeOf<
    EntityId | undefined
  >();
  expectTypeOf(extractSeq(id, 74)).toEqualTypeOf<bigint>();
  expectTypeOf(
    extractNodeId(id, { sequenceBits: 12, nodeBits: 62 }),
  ).toEqualTypeOf<Uint8Array>();
  // @ts-expect-error Worker allocation is supplied as bytes, not an assumed integer field.
  new IdFlake({ workerId: 7 });
});

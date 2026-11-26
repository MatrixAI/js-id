import type { Id } from '#Id.js';
import { expectTypeOf, test } from 'vitest';
import IdInternal from '#Id.js';

class NodeIdInternal extends IdInternal {
  public nodeMethod(): string {
    return 'node';
  }
}

class ClaimIdInternal extends IdInternal {
  public claimMethod(): string {
    return 'claim';
  }
}

class SpecialNodeIdInternal extends NodeIdInternal {
  public specialMethod(): string {
    return 'special';
  }
}

test('identifier factories infer subclass and preserve opaque IDs', () => {
  const node = NodeIdInternal.create(16);
  expectTypeOf(node).toEqualTypeOf<Id<NodeIdInternal>>();
  expectTypeOf(NodeIdInternal.fromString('a')).toEqualTypeOf<
    Id<NodeIdInternal>
  >();
  expectTypeOf(NodeIdInternal.fromUUID('')).toEqualTypeOf<
    Id<NodeIdInternal> | undefined
  >();
  expectTypeOf(NodeIdInternal.fromMultibase('')).toEqualTypeOf<
    Id<NodeIdInternal> | undefined
  >();
  expectTypeOf(NodeIdInternal.fromJSON({})).toEqualTypeOf<
    Id<NodeIdInternal> | undefined
  >();
  expectTypeOf(NodeIdInternal.fromBuffer(Buffer.alloc(16))).toEqualTypeOf<
    Id<NodeIdInternal>
  >();
  expectTypeOf(SpecialNodeIdInternal.create()).toEqualTypeOf<
    Id<SpecialNodeIdInternal>
  >();
  type OpaqueId = Id & { readonly __type: 'opaque' };
  expectTypeOf(IdInternal.create<OpaqueId>(16)).toEqualTypeOf<OpaqueId>();
  expectTypeOf(IdInternal.fromUUID<OpaqueId>('')).toEqualTypeOf<
    OpaqueId | undefined
  >();
  const contextualCreate: OpaqueId = IdInternal.create(16);
  const contextualString: OpaqueId = IdInternal.fromString('');
  const contextualUuid: OpaqueId | undefined = IdInternal.fromUUID('');
  const contextualJson: OpaqueId | undefined = IdInternal.fromJSON({});
  const contextualMultibase: OpaqueId | undefined =
    IdInternal.fromMultibase('');
  const contextualBuffer: OpaqueId = IdInternal.fromBuffer(Buffer.alloc(16));
  void [
    contextualCreate,
    contextualString,
    contextualUuid,
    contextualJson,
    contextualMultibase,
    contextualBuffer,
  ];
  const record: Record<string, number> = {};
  record[node] = 1;
  // @ts-expect-error Claim IDs do not provide the Node ID domain method.
  const invalid: Id<NodeIdInternal> = ClaimIdInternal.create(16);
  void invalid;
});

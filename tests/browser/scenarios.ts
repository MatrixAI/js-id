import {
  IdDeterministic,
  IdFlake,
  IdInternal,
  IdRandom,
  IdSortable,
  utils,
} from '#index.js';
import { extractNodeId, extractSeq } from '#IdFlake.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyRuntime() {
  assert(
    typeof globalThis.Buffer === 'undefined',
    'unexpected Buffer polyfill',
  );
  assert(utils.randomBytes(65_537).length === 65_537, 'random byte chunking');
  const large = new Uint8Array(262_145);
  for (let index = 0; index < large.length; index++) large[index] = index % 256;
  assert(
    utils.fromString(utils.toString(large)).equals(large),
    'large binary string roundtrip',
  );
  const random = new IdRandom().get();
  assert(random.length === 16 && random[6] >> 4 === 4, 'random UUIDv4');
  const deterministic = new IdDeterministic({ namespace: 'browser' });
  assert(deterministic.get('name').equals(deterministic.get('name')), 'UUIDv8');
  const dns = utils.fromUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
  assert(
    new IdDeterministic({ namespace: dns }).get('www.example.com').toUUID() ===
      '5c146b14-3c52-8afd-938a-375d0df1fbf6',
    'RFC 9562 name-based UUIDv8 vector',
  );
  const sortable = new IdSortable();
  const first = sortable.get();
  const second = sortable.get();
  assert(first < second && first[6] >> 4 === 7, 'monotonic UUIDv7');
  let clock = 1_700_000_000_000;
  const frozen = new IdSortable({
    timeSource: () => () => clock,
    randomSource: (size) => new Uint8Array(size),
  });
  for (let i = 0; i < 4096; i++) frozen.get();
  let exhausted = false;
  try {
    frozen.get();
  } catch (error) {
    exhausted =
      error instanceof RangeError &&
      error.message.includes('counter exhausted');
  }
  assert(exhausted, 'frozen clock must not wrap the UUIDv7 counter');
  clock++;
  assert(frozen.get()[6] >> 4 === 7, 'generation resumes after clock advances');
  let flakeClock = 100;
  const node = Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 0xff);
  const flake = new IdFlake({
    nodeId: node,
    sequenceBits: 2,
    nodeBits: 62,
    timeSource: () => () => flakeClock,
    randomSource: (size) => new Uint8Array(size),
  });
  const flakeFirst = flake.get();
  assert(flakeFirst[6] >> 4 === 8, 'UUIDv8 flake');
  assert(
    utils
      .bytes2bits(extractNodeId(flakeFirst, { sequenceBits: 2, nodeBits: 62 }))
      .slice(0, 62) === utils.bytes2bits(node).slice(0, 62),
    'flake node prefix',
  );
  const flakeSecond = flake.get();
  assert(
    flakeFirst < flakeSecond && extractSeq(flakeSecond, 2) === 1n,
    'flake sequence',
  );
  flake.get();
  flake.get();
  let flakeExhausted = false;
  try {
    flake.get();
  } catch (error) {
    flakeExhausted = error instanceof RangeError;
  }
  assert(flakeExhausted, 'flake frozen clock must not wrap');
  flakeClock++;
  assert(extractSeq(flake.get(), 2) === 0n, 'flake resumes on clock advance');
  assert(utils.fromUUID(first.toUUID())?.equals(first), 'UUID roundtrip');
  assert(
    utils.fromMultibase(first.toMultibase('base32hex'))?.equals(first),
    'multibase',
  );
  assert(
    utils.fromMultibase(first.toMultibase('base256emoji'))?.equals(first),
    'emoji multibase',
  );
  assert(
    utils.fromSortableBase64(utils.toSortableBase64(first))?.equals(first),
    'sortable base64',
  );
  for (const padding of ['=', '~'] as const) {
    assert(
      utils
        .fromSortableBase64(utils.toSortableBase64Padded(first, padding))
        ?.equals(first),
      'padded sortable base64',
    );
  }
  const typed = utils.fromTypeId(utils.toTypeId(first, 'user'));
  assert(typed?.prefix === 'user' && typed.id.equals(first), 'TypeID');
  class NodeId extends IdInternal {}
  assert(
    (NodeId.fromUUID(first.toUUID()) as unknown as
      NodeId | undefined) instanceof NodeId,
    'subclass decoding',
  );
}

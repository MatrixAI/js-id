import type { Id } from '@';
import IdSortable, { extractTs, extractSeq, extractRand } from '@/IdSortable';
import * as utils from '@/utils';
import { sleep, shuffle } from './utils';

describe('IdSortable', () => {
  test('ids are Uint8Array', () => {
    const idGen = new IdSortable();
    const id = idGen.get();
    expect(id).toBeInstanceOf(Uint8Array);
  });
  test('ids can be generated', () => {
    const idGen = new IdSortable();
    const ids = [...utils.take(idGen, 10)];
    expect(ids).toHaveLength(10);
  });
  test('ids can be generated as opaque type', () => {
    // Can't really check that types are working besides building
    // This is more of an example
    type Opaque<K, T> = T & { __TYPE__: K };
    type OpaqueId = Opaque<'opaque', Id>;
    const idGen = new IdSortable<OpaqueId>();
    const ids = [...utils.take(idGen, 10)];
    expect(ids).toHaveLength(10);
  });
  test('ids can be encoded and decoded as binary strings', () => {
    const idGen = new IdSortable();
    const id = idGen.get();
    const encoded = id.toString();
    const id_ = utils.fromString(encoded);
    expect(id_).toBeDefined();
    expect(utils.toBuffer(id).equals(utils.toBuffer(id_!))).toBe(true);
  });
  test('ids can be encoded and decoded with multibase', () => {
    const idGen = new IdSortable();
    const id = idGen.get();
    const encoded = utils.toMultibase(id, 'base58btc');
    const id_ = utils.fromMultibase(encoded);
    expect(id_).toBeDefined();
    expect(utils.toBuffer(id).equals(utils.toBuffer(id_!))).toBe(true);
  });
  test('ids can be encoded and decoded with uuid', () => {
    const idGen = new IdSortable();
    const id = idGen.get();
    const uuid = utils.toUUID(id);
    const id_ = utils.fromUUID(uuid);
    expect(id_).toBeDefined();
    expect(utils.toBuffer(id).equals(utils.toBuffer(id_!))).toBe(true);
  });
  test('maintains the last id generated', () => {
    const idGen = new IdSortable();
    idGen.get();
    idGen.get();
    const id = utils.toBuffer(idGen.get());
    const id_ = utils.toBuffer(idGen.lastId);
    expect(id.equals(id_)).toBe(true);
  });
  test('ids in bytes are lexically sortable', () => {
    const idGen = new IdSortable();
    // This generating over 100,000 ids and checks that they maintain
    // sort order for each 100 chunk of ids
    let count = 1000;
    while (count > 0) {
      const idBuffers = [...utils.take(idGen, 100)];
      const idBuffersShuffled = idBuffers.slice();
      shuffle(idBuffersShuffled);
      // Comparison is done on the bytes in lexicographic order
      idBuffersShuffled.sort(Buffer.compare);
      expect(idBuffersShuffled).toStrictEqual(idBuffers);
      count--;
    }
  });
  test('ids in bytes are lexically sortable with time delay', async () => {
    const id = new IdSortable();
    const i1 = utils.toBuffer(id.get());
    await sleep(250);
    const i2 = utils.toBuffer(id.get());
    await sleep(500);
    const i3 = utils.toBuffer(id.get());
    const buffers = [i3, i1, i2];
    // Comparison is done on the bytes in lexicographic order
    buffers.sort(Buffer.compare);
    expect(buffers).toStrictEqual([i1, i2, i3]);
  });
  test('encoded id strings are lexically sortable', () => {
    const idGen = new IdSortable();
    // This generating over 100,000 ids and checks that they maintain
    // sort order for each 100 chunk of ids
    let count = 1000;
    while (count > 0) {
      const idStrings = [...utils.take(idGen, 100)].map((id) => id.toString());
      const idStringsShuffled = idStrings.slice();
      shuffle(idStringsShuffled);
      idStringsShuffled.sort();
      expect(idStringsShuffled).toStrictEqual(idStrings);
      count--;
    }
  });
  test('encoded uuids are lexically sortable', () => {
    // UUIDs are hex encoding, and the hex alphabet preserves order
    const idGen = new IdSortable();
    // This generating over 100,000 ids and checks that they maintain
    // sort order for each 100 chunk of ids
    let count = 1000;
    while (count > 0) {
      const idUUIDs = [...utils.take(idGen, 100)].map(utils.toUUID);
      const idUUIDsShuffled = idUUIDs.slice();
      shuffle(idUUIDsShuffled);
      idUUIDsShuffled.sort();
      expect(idUUIDsShuffled).toStrictEqual(idUUIDs);
      count--;
    }
  });
  test('encoded multibase strings may be lexically sortable (base32hex)', () => {
    // `base32hex` preserves sort order
    const idGen = new IdSortable();
    // This generating over 100,000 ids and checks that they maintain
    // sort order for each 100 chunk of ids
    let count = 1000;
    while (count > 0) {
      const idStrings = [...utils.take(idGen, 100)].map((id) =>
        utils.toMultibase(id, 'base32hex'),
      );
      const idStringsShuffled = idStrings.slice();
      shuffle(idStringsShuffled);
      idStringsShuffled.sort();
      expect(idStringsShuffled).toStrictEqual(idStrings);
      count--;
    }
  });
  test('encoded multibase strings may not be lexically sortable (base64)', async () => {
    // `base64` and `base58btc` does not preserve sort order
    const idGen = new IdSortable();
    const idStrings = [...utils.take(idGen, 100)].map((id) =>
      utils.toMultibase(id, 'base64'),
    );
    const idStringsShuffled = idStrings.slice();
    shuffle(idStringsShuffled);
    idStringsShuffled.sort();
    // It will not equal
    expect(idStringsShuffled).not.toStrictEqual(idStrings);
  });
  test('ids are monotonic within the same timestamp', () => {
    // To ensure that we it generates monotonic ids
    // we have to override the timesource
    const id = new IdSortable({
      timeSource: () => {
        return () => 0;
      },
    });
    const i1 = utils.toBuffer(id.get());
    const i2 = utils.toBuffer(id.get());
    const i3 = utils.toBuffer(id.get());
    // They should not equal
    expect(i1.equals(i2)).toBe(false);
    expect(i2.equals(i3)).toBe(false);
    const buffers = [i3, i1, i2];
    // Comparison is done on the bytes in lexicographic order
    buffers.sort(Buffer.compare);
    expect(buffers).toStrictEqual([i1, i2, i3]);
    expect(extractTs(i1)).toBe(0);
    expect(extractTs(i2)).toBe(0);
    expect(extractTs(i3)).toBe(0);
    expect(extractSeq(i1)).toBe(0);
    expect(extractSeq(i2)).toBe(1);
    expect(extractSeq(i3)).toBe(2);
  });
  test('ids are monotonic over process restarts', () => {
    const id = new IdSortable({
      timeSource: () => {
        // 100 second in the future
        return () => Date.now() + 100000;
      },
    });
    const lastId = utils.toBuffer(id.get());
    // Pass a future last id
    // the default time source should get an older timestamp
    const id_ = new IdSortable({ lastId });
    const currId = utils.toBuffer(id_.get());
    expect(lastId.equals(currId)).toBe(false);
    const buffers = [currId, lastId];
    buffers.sort(Buffer.compare);
    expect(buffers).toStrictEqual([lastId, currId]);
    // Monotonicity is not enforced by seq
    // but rather the timestamp
    expect(extractSeq(lastId)).toBe(0);
    expect(extractSeq(currId)).toBe(0);
  });
  test('ids can have machine id starting from the MSB of rand-section', () => {
    const nodeId = Buffer.from('abcd', 'utf-8');
    const id = new IdSortable({ nodeId });
    const i1 = utils.toBuffer(id.get());
    const i2 = utils.toBuffer(id.get());
    const i3 = utils.toBuffer(id.get());
    const buffers = [i3, i1, i2];
    // Comparison is done on the bytes in lexicographic order
    buffers.sort(Buffer.compare);
    expect(buffers).toStrictEqual([i1, i2, i3]);
    const randBits = extractRand(i1);
    expect(randBits.length).toBe(62);
    const randBytes = utils.bits2bytes(randBits);
    const nodeBytes = randBytes.slice(0, 4);
    expect(utils.toBuffer(nodeBytes).equals(nodeId)).toBe(true);
  });
  test('ids can be used as record indexes', () => {
    const idGen = new IdSortable();
    const ids = [...utils.take(idGen, 10)];
    let counter = 0;
    const record = {};
    for (const id of ids) {
      record[id] = counter;
      expect(record[id]).toBe(counter);
      counter++;
    }
  });
  test('ids can use comparison operators', () => {
    const idGen = new IdSortable();
    let idToCompare = idGen.get();
    const ids = [...utils.take(idGen, 100)];
    for (const id of ids) {
      expect(idToCompare < id).toBe(true);
      expect(idToCompare <= id).toBe(true);
      expect(idToCompare > id).toBe(false);
      expect(idToCompare >= id).toBe(false);
      idToCompare = id;
    }
  });
  test('ids in strings can be compared for equality', () => {
    const idGen = new IdSortable();
    const id1 = idGen.get();
    const id2 = idGen.get();
    // Objects will be different
    expect(id1 == id2).toBe(false); // eslint-disable-line eqeqeq
    // Sortable ids are different
    expect(id1.toString() == id2.toString()).toBe(false); // eslint-disable-line eqeqeq
    expect(id1.toString()).toBe(id1 + '');
    expect(id2.toString()).toBe(String(id2));
  });
});

import type { Id } from '@';

import IdRandom from '@/IdRandom';
import * as utils from '@/utils';

describe('IdRandom', () => {
  test('ids are Uint8Array', () => {
    const idGen = new IdRandom();
    const id = idGen.get();
    expect(id).toBeInstanceOf(Uint8Array);
  });
  test('ids can be generated', () => {
    const idGen = new IdRandom();
    const ids = [...utils.take(idGen, 10)];
    expect(ids).toHaveLength(10);
  });
  test('ids can be generated as OpaqueType', () => {
    // Can't really check that types are working besides building
    // This is more of an example
    type Opaque<K, T> = T & { __TYPE__: K };
    type OpaqueId = Opaque<'opaque', Id>;
    const idGen = new IdRandom<OpaqueId>();
    const ids = [...utils.take(idGen, 10)];
    expect(ids).toHaveLength(10);
  });
  test('ids can be encoded and decoded as binary strings', () => {
    const idGen = new IdRandom();
    const id = idGen.get();
    const encoded = id.toString();
    const id_ = utils.fromString(encoded);
    expect(id_).toBeDefined();
    expect(utils.toBuffer(id).equals(utils.toBuffer(id_!))).toBe(true);
  });
  test('ids can be encoded and decoded with multibase', () => {
    const idGen = new IdRandom();
    const id = idGen.get();
    const encoded = utils.toMultibase(id, 'base58btc');
    const id_ = utils.fromMultibase(encoded);
    expect(id_).toBeDefined();
    expect(Buffer.from(id).equals(Buffer.from(id_!))).toBe(true);
  });
  test('ids can be encoded and decoded with uuid', () => {
    const idGen = new IdRandom();
    const id = idGen.get();
    const uuid = utils.toUUID(id);
    const id_ = utils.fromUUID(uuid);
    expect(id_).toBeDefined();
    expect(Buffer.from(id).equals(Buffer.from(id_!))).toBe(true);
  });
  test('ids are random', () => {
    const id = new IdRandom();
    const count = 10;
    const ids = [...utils.take(id, count)].map((b) =>
      Buffer.from(b).toString('hex'),
    );
    const idSet = new Set(ids);
    expect(idSet.size).toBe(count);
  });
  test('ids can be used as record indexes', () => {
    const idGen = new IdRandom();
    const ids = [...utils.take(idGen, 10)];
    let counter = 0;
    const record = {};
    for (const id of ids) {
      record[id] = counter;
      expect(record[id]).toBe(counter);
      counter++;
    }
  });
  test('ids in strings can be compared for equality', () => {
    const idGen = new IdRandom();
    const id1 = idGen.get();
    const id2 = idGen.get();
    // Objects will be different
    expect(id1 == id2).toBe(false);
    // Random ids are different
    expect(id1.toString() == id2.toString()).toBe(false);
    expect(id1.toString()).toBe(id1 + '');
    expect(id2.toString()).toBe(String(id2));
  });
});

import type { Id } from '@/Id';
import IdInternal from '@/Id';
import * as utils from '@/utils';

describe('Id', () => {
  test('create id from buffer', () => {
    const buffer = Buffer.from('abcefg');
    const id = IdInternal.create(buffer);
    expect(id.toString()).toBe('abcefg');
    expect(id + '').toBe('abcefg');
    // Primitive value of Id is still Uint8Array
    expect([...id.valueOf()]).toStrictEqual([...buffer]);
  });
  test('create id from id', () => {
    const buffer = Buffer.allocUnsafe(32);
    const id1 = IdInternal.create(buffer);
    const id2 = IdInternal.create(id1);
    expect([...id2]).toStrictEqual([...id1]);
  });
  test('id can be used as POJO keys', () => {
    const buffer = Buffer.from('hello world');
    const id = IdInternal.create(buffer);
    // Automatic string conversion takes place here
    // However the strings may not look very pretty
    // They are the raw binary string form
    // So if you expect to read this string on the terminal
    // Prefer to use an encoded form instead
    const pojo = {
      [id]: 'foo bar',
    };
    expect(pojo[id]).toBe('foo bar');
    expect(pojo[id.toString()]).toBe('foo bar');
    for (const k of Object.keys(pojo)) {
      const idDecoded = utils.fromString(k);
      expect(idDecoded).toBeDefined();
      expect([...idDecoded!]).toStrictEqual([...id]);
      break;
    }
  });
  test('id can be used as Map keys', () => {
    const buffer = Buffer.from('hello world');
    const id = IdInternal.create(buffer);
    // The id is an object, so this is an object key
    const map = new Map();
    map.set(id, 'foo bar');
    expect(map.get(id)).toBe('foo bar');
    expect(map.get(id.toString())).toBeUndefined();
  });
  test('id can be created as a opaque type directly', async () => {
    type Opaque<K, T> = T & { __TYPE__: K };
    type OpaqueId = Opaque<'opaque', Id>;
    const buffer = Buffer.from('abcefg');
    const id1 = IdInternal.create<OpaqueId>(buffer);
    expect(id1.toString()).toBe('abcefg');
    expect(id1 + '').toBe('abcefg');
    expect([...id1.valueOf()]).toStrictEqual([...buffer]);
    const id2: OpaqueId = IdInternal.create(buffer);
    expect(id2.toString()).toBe('abcefg');
    expect(id2 + '').toBe('abcefg');
    expect([...id2.valueOf()]).toStrictEqual([...buffer]);
  });
  test('id encoding & decoding for multibase, string, uuid and buffer', async () => {
    type Opaque<K, T> = T & { __TYPE__: K };
    type OpaqueId = Opaque<'opaque', Id>;
    const buffer = Buffer.from('0123456789ABCDEF');
    const id = IdInternal.create<OpaqueId>(buffer);
    const test1 = id.toMultibase('base32hex');
    expect(IdInternal.fromMultibase<OpaqueId>(test1)).toStrictEqual(id);
    const test2 = id.toString();
    expect(IdInternal.fromString<OpaqueId>(test2)).toStrictEqual(id);
    const test3 = id.toUUID();
    expect(IdInternal.fromUUID<OpaqueId>(test3)).toStrictEqual(id);
    const test4 = id.toBuffer();
    expect(IdInternal.fromBuffer<OpaqueId>(test4)).toStrictEqual(id);
  });
  test('id equality', async () => {
    const id1 = IdInternal.create([97, 98, 99]);
    const id2 = IdInternal.create([97, 98, 99]);
    const id3 = IdInternal.create([97, 98, 100]);
    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
  });
  test('id JSON representation', async () => {
    const id = IdInternal.create([97, 98, 99]);
    const json1 = JSON.stringify(id);
    const id_ = JSON.parse(json1, (k, v) => {
      return IdInternal.fromJSON(v) ?? v;
    });
    expect(id_).toBeInstanceOf(IdInternal);
    expect(id).toStrictEqual(id_);
    const json2 = JSON.stringify({
      id,
    });
    const object = JSON.parse(json2, (k, v) => {
      return IdInternal.fromJSON(v) ?? v;
    });
    expect(object.id).toBeInstanceOf(IdInternal);
    expect(object.id).toStrictEqual(id);
    // Primitives should return undefined
    expect(IdInternal.fromJSON(123)).toBeUndefined();
    expect(IdInternal.fromJSON('abc')).toBeUndefined();
    expect(IdInternal.fromJSON(undefined)).toBeUndefined();
  });
});

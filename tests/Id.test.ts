import Id from '@/Id';
import * as utils from '@/utils';

describe('Id', () => {
  test('create id from buffer', () => {
    const buffer = Buffer.from('abcefg');
    const id = Id.create(buffer);
    expect(id.toString()).toBe('abcefg');
    expect(id + '').toBe('abcefg');
    // Primitive value of Id is still Uint8Array
    expect([...id.valueOf()]).toStrictEqual([...buffer]);
  });
  test('create id from id', () => {
    const buffer = Buffer.allocUnsafe(32);
    const id1 = Id.create(buffer);
    const id2 = Id.create(id1);
    expect([...id2]).toStrictEqual([...id1]);
  });
  test('id can be used as POJO keys', () => {
    const buffer = Buffer.from('hello world');
    const id = Id.create(buffer);
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
    const id = Id.create(buffer);
    // The id is an object, so this is an object key
    const map = new Map();
    map.set(id, 'foo bar');
    expect(map.get(id)).toBe('foo bar');
    expect(map.get(id.toString())).toBeUndefined();
  });
});

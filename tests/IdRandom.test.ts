import IdRandom from '@/IdRandom';
import * as utils from '@/utils';

describe('IdRandom', () => {
  test('ids are ArrayBuffer', () => {
    const idGen = new IdRandom();
    const id = idGen.get();
    const idBuf = Buffer.from(id);
    expect(idBuf.buffer).toBe(id);
  });
  test('ids can be generated', () => {
    const idGen = new IdRandom();
    const ids = [...utils.take(idGen, 10)];
    expect(ids).toHaveLength(10);
  });
  test('ids can be encoded and decoded with multibase', () => {
    const idGen = new IdRandom();
    const id = idGen.get();
    const encoded = utils.toMultibase(id, 'base58btc');
    const id_ = utils.fromMultibase(encoded);
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
});

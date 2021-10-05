import IdSortable, { extractTs, extractSeq, extractRand } from '@/IdSortable';
import * as utils from '@/utils';

describe('IdSortable', () => {
  test('ids are ArrayBuffer', () => {
    const idGen = new IdSortable();
    const id = idGen.get();
    const idBuf = Buffer.from(id);
    expect(idBuf.buffer).toBe(id);
  });
  test('ids can be generated', () => {
    const idGen = new IdSortable();
    const ids = [...utils.take(idGen, 10)];
    expect(ids).toHaveLength(10);
  });
  test('ids are lexically sortable', () => {
    const id = new IdSortable();
    const i1 = Buffer.from(id.get());
    const i2 = Buffer.from(id.get());
    const i3 = Buffer.from(id.get());
    const buffers = [i3, i1, i2];
    // Comparison is done on the bytes in lexicographic order
    buffers.sort(Buffer.compare);
    expect(buffers).toStrictEqual([i1, i2, i3]);
  });
  test('encoded uuids are lexically sortable', () => {
    const id = new IdSortable();
    const i1 = utils.toUUID(new Uint8Array(id.get()));
    const i2 = utils.toUUID(new Uint8Array(id.get()));
    const i3 = utils.toUUID(new Uint8Array(id.get()));
    const uuids = [i3, i2, i1];
    uuids.sort();
    expect(uuids).toStrictEqual([i1, i2, i3]);
  });
  test('ids are monotonic within the same timestamp', () => {
    // To ensure that we it generates monotonic ids
    // we have to override the timesource
    const id = new IdSortable({
      timeSource: () => {
        return () => 0;
      },
    });
    const i1 = Buffer.from(id.get());
    const i2 = Buffer.from(id.get());
    const i3 = Buffer.from(id.get());
    // They should not equal
    expect(i1.equals(i2)).toBe(false);
    expect(i2.equals(i3)).toBe(false);
    const buffers = [i3, i1, i2];
    // Comparison is done on the bytes in lexicographic order
    buffers.sort(Buffer.compare);
    expect(buffers).toStrictEqual([i1, i2, i3]);
    expect(extractTs(i1.buffer)).toBe(0);
    expect(extractTs(i2.buffer)).toBe(0);
    expect(extractTs(i3.buffer)).toBe(0);
    expect(extractSeq(i1.buffer)).toBe(0);
    expect(extractSeq(i2.buffer)).toBe(1);
    expect(extractSeq(i3.buffer)).toBe(2);
  });
  test('ids are monotonic over process restarts', () => {
    const id = new IdSortable({
      timeSource: () => {
        // 100 second in the future
        return () => Date.now() + 100000;
      },
    });
    const lastId = Buffer.from(id.get());
    // Pass a future last id
    // the default time source should get an older timestamp
    const id_ = new IdSortable({ lastId: lastId.buffer });
    const currId = Buffer.from(id_.get());
    expect(lastId.equals(currId)).toBe(false);
    const buffers = [currId, lastId];
    buffers.sort(Buffer.compare);
    expect(buffers).toStrictEqual([lastId, currId]);
    // Monotonicity is not enforced by seq
    // but rather the timestamp
    expect(extractSeq(lastId.buffer)).toBe(0);
    expect(extractSeq(currId.buffer)).toBe(0);
  });
  test('ids can have machine id starting from the MSB of rand-section', () => {
    const nodeId = Buffer.from('abcd', 'utf-8');
    const id = new IdSortable({
      nodeId: nodeId.buffer.slice(
        nodeId.byteOffset,
        nodeId.byteOffset + nodeId.byteLength,
      ),
    });
    const i1 = Buffer.from(id.get());
    const i2 = Buffer.from(id.get());
    const i3 = Buffer.from(id.get());
    const buffers = [i3, i1, i2];
    // Comparison is done on the bytes in lexicographic order
    buffers.sort(Buffer.compare);
    expect(buffers).toStrictEqual([i1, i2, i3]);
    const randBits = extractRand(i1.buffer);
    expect(randBits.length).toBe(62);
    const randBytes = utils.bin2bytes(randBits);
    const nodeBytes = randBytes.slice(0, 4);
    expect(Buffer.from(nodeBytes.buffer).equals(nodeId)).toBe(true);
  });
});

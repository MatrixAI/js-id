import * as utils from './utils';

/**
 * Constants for UUIDv7 with millisecond precision
 *   0                   1                   2                   3
 *   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *  |                            unixts                             |
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *  |unixts |         msec          |  ver  |          seq          |
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *  |var|                         rand                              |
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *  |                             rand                              |
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 */
const unixtsSize = 36;
const msecSize = 12;
const seqSize = 12;
const randSize = 62;
const msecPrecision = 3;
const variantBits = '10';
const versionBits = '0111';

function extractTs(idBytes: ArrayBuffer): number {
  // Decode the timestamp from the last id
  // the timestamp bits is 48 bits or 6 bytes
  const idTsBytes = new Uint8Array(idBytes, 0, (unixtsSize + msecSize) / 8);
  const idTsBits = utils.bytes2bin(idTsBytes);
  const unixtsBits = idTsBits.substr(0, unixtsSize);
  const msecBits = idTsBits.substr(unixtsSize, unixtsSize + msecSize);
  const unixts = parseInt(unixtsBits, 2);
  const msec = parseInt(msecBits, 2);
  // Converting from second and subseconds
  return utils.fromFixedPoint([unixts, msec], msecSize, msecPrecision);
}

function extractSeq(idBytes: ArrayBuffer): number {
  const idSeqBytes = new Uint8Array(
    idBytes,
    (unixtsSize + msecSize) / 8,
    (unixtsSize + msecSize + 4 + seqSize) / 8,
  );
  const idSeqBits = utils.bytes2bin(idSeqBytes).substr(4, seqSize);
  const seq = parseInt(idSeqBits, 2);
  return seq;
}

function extractRand(idBytes: ArrayBuffer): string {
  const idRandBytes = new Uint8Array(
    idBytes,
    (unixtsSize + msecSize + 4 + seqSize) / 8,
  );
  const idRandBits = utils.bytes2bin(idRandBytes).substr(2);
  return idRandBits;
}

/**
 * Sortable ID generator based on UUIDv7 with millisecond resolution
 * 36 bits of unixts enables timestamps of 2177.59 years from 1970
 * (2**36)/(1*60*60*24*365.25) ~= 2177.59 years
 * Which means it will work until the year 4147
 * 12 bits seq enables 4096 ids per millisecond
 * After 4096, it rolls over
 */
class IdSortable implements IterableIterator<ArrayBuffer> {
  protected randomSource: (size: number) => Uint8Array;
  protected clock: () => number;
  protected nodeBits?: string;
  protected lastTs?: [number, number];
  protected lastId_?: ArrayBuffer;
  protected seqCounter: number;

  public constructor({
    lastId,
    nodeId,
    timeSource = utils.timeSource,
    randomSource = utils.randomBytes,
  }: {
    lastId?: ArrayBuffer;
    nodeId?: ArrayBuffer;
    timeSource?: (lastTs?: number) => () => number;
    randomSource?: (size: number) => Uint8Array;
  } = {}) {
    this.randomSource = randomSource;
    if (lastId == null) {
      this.clock = timeSource();
    } else {
      // Decode the timestamp from the last id
      const lastIdTs = extractTs(lastId);
      // TimeSource requires millisecond precision
      this.clock = timeSource(lastIdTs * 10 ** msecPrecision);
    }
    if (nodeId != null) {
      this.nodeBits = utils.nodeBits(nodeId, randSize);
    }
  }

  get lastId(): ArrayBuffer {
    if (this.lastId_ == null) {
      throw new ReferenceError('lastId has not yet been generated');
    }
    return this.lastId_;
  }

  public get(): ArrayBuffer {
    return this.next().value as ArrayBuffer;
  }

  public next(): IteratorResult<ArrayBuffer, void> {
    // Clock returns millisecond precision
    const ts = this.clock() / 10 ** msecPrecision;
    // Converting to seconds and subseconds
    const [unixts, msec] = utils.toFixedPoint(ts, msecSize, msecPrecision);
    const unixtsBits = utils.dec2bin(unixts, unixtsSize);
    const msecBits = utils.dec2bin(msec, msecSize);
    if (
      this.lastTs != null &&
      this.lastTs[0] >= unixts &&
      this.lastTs[1] >= msec
    ) {
      this.seqCounter += 1;
    } else {
      this.seqCounter = 0;
    }
    const seqBits = utils.dec2bin(this.seqCounter, seqSize);
    // NodeBits can be written to the most significant rand portion
    let randBits: string;
    if (this.nodeBits != null) {
      const randSize_ = randSize - this.nodeBits.length;
      randBits = this.nodeBits;
      if (randSize_ > 0) {
        randBits += utils.randomBits(this.randomSource, randSize_);
      }
    } else {
      randBits = utils.randomBits(this.randomSource, randSize);
    }
    const idBits =
      unixtsBits + msecBits + versionBits + seqBits + variantBits + randBits;
    const idBytes = utils.bin2bytes(idBits);
    // Save the fixed point timestamp
    this.lastTs = [unixts, msec];
    this.lastId_ = idBytes.buffer;
    return {
      value: idBytes.buffer,
      done: false,
    };
  }

  public [Symbol.iterator](): IterableIterator<ArrayBuffer> {
    return this;
  }
}

export default IdSortable;

export { extractTs, extractSeq, extractRand };

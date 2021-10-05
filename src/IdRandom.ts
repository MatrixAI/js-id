import { v4 as uuidv4 } from 'uuid';
import * as utils from './utils';

class IdRandom implements IterableIterator<ArrayBuffer> {
  protected randomSource: (size: number) => Uint8Array;

  public constructor({
    randomSource = utils.randomBytes,
  }: {
    randomSource?: (size: number) => Uint8Array;
  } = {}) {
    this.randomSource = randomSource;
  }

  public get(): ArrayBuffer {
    return this.next().value as ArrayBuffer;
  }

  public next(): IteratorResult<ArrayBuffer, void> {
    const idData = new ArrayBuffer(16);
    // Uuidv4 does mutate the random data
    uuidv4(
      {
        rng: () => this.randomSource(16),
      },
      new Uint8Array(idData),
    );
    return {
      value: idData,
      done: false,
    };
  }

  public [Symbol.iterator](): IterableIterator<ArrayBuffer> {
    return this;
  }
}

export default IdRandom;

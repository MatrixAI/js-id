import type { Id } from './Id';

import { v4 as uuidv4 } from 'uuid';
import * as utils from './utils';
import IdInternal from './Id';

class IdRandom<T extends Id = Id> implements IterableIterator<T> {
  protected randomSource: (size: number) => Uint8Array;

  public constructor({
    randomSource = utils.randomBytes,
  }: {
    randomSource?: (size: number) => Uint8Array;
  } = {}) {
    this.randomSource = randomSource;
  }

  public get(): T {
    return this.next().value as T;
  }

  public next(): IteratorResult<T, void> {
    const id = IdInternal.create<T>(16);
    // `uuidv4` mutates the random data
    uuidv4(
      {
        rng: () => this.randomSource(16),
      },
      id,
    );
    return {
      value: id,
      done: false,
    };
  }

  public [Symbol.iterator](): IterableIterator<T> {
    return this;
  }
}

export default IdRandom;

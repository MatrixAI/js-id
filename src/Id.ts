import * as utils from './utils';

/**
 * IdInternal can be used as a string primitive
 * This type hack prevents TS from complaining
 * See: https://github.com/microsoft/TypeScript/issues/4538
 */
type Id = IdInternal & number;

class IdInternal extends Uint8Array {
  public static create(): Id;
  public static create(length: number): Id;
  public static create(array: ArrayLike<number> | ArrayBufferLike): Id;
  public static create(
    buffer: ArrayBufferLike,
    byteOffset?: number,
    length?: number,
  ): Id;
  public static create(...args: Array<any>): Id {
    // @ts-ignore: spreading into Uint8Array constructor
    return new IdInternal(...args) as Id;
  }

  public [Symbol.toPrimitive](_hint: 'string' | 'number' | 'default'): string {
    return utils.toString(this as unknown as Id);
  }

  public toString(): string {
    return utils.toString(this as unknown as Id);
  }
}

export default IdInternal;

export type { Id };

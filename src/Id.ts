import * as utils from './utils';
import { MultibaseFormats } from './utils';

/**
 * IdInternal can be used as a string primitive
 * This type hack (as a number) prevents TS from complaining
 * See: https://github.com/microsoft/TypeScript/issues/4538
 */
type Id = IdInternal & number;

class IdInternal extends Uint8Array {
  public static create<T extends Id = Id>(): T;
  public static create<T extends Id = Id>(id: T): T;
  public static create<T extends Id = Id>(length: number): T;
  public static create<T extends Id = Id>(
    array: ArrayLike<number> | ArrayBufferLike,
  ): T;
  public static create<T extends Id = Id>(
    buffer: ArrayBufferLike,
    byteOffset?: number,
    length?: number,
  ): T;
  public static create<T extends Id = Id>(...args: Array<any>): T {
    // @ts-ignore: spreading into Uint8Array constructor
    return new IdInternal(...args) as T;
  }

  public [Symbol.toPrimitive](_hint: 'string' | 'number' | 'default'): string {
    return utils.toString(this as unknown as Id);
  }

  public static fromString<T extends Id = Id>(idString: string): T | undefined {
    return utils.fromString(idString) as T;
  }

  /**
   * Decodes as Buffer zero-copy
   */
  public static fromBuffer<T extends Id = Id>(idBuffer: Buffer): T | undefined {
    return utils.fromBuffer(idBuffer) as T;
  }

  public static fromUUID<T extends Id = Id>(uuid: string): T | undefined {
    return utils.fromUUID(uuid) as T;
  }

  public static fromMultibase<T extends Id = Id>(
    idString: string,
  ): T | undefined {
    return utils.fromMultibase(idString) as T;
  }

  public toString(): string {
    return utils.toString(this as unknown as Id);
  }

  /**
   * Encodes as Buffer zero-copy
   */
  public toBuffer(): Buffer {
    return utils.toBuffer(this);
  }

  public toUUID(): string {
    return utils.toUUID(this);
  }

  /**
   * Encodes an multibase ID string
   */
  public toMultibase(format: MultibaseFormats): string {
    return utils.toMultibase(this, format);
  }
}

export default IdInternal;

export type { Id };

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

  public static fromString<T extends Id = Id>(idString: string): T {
    return utils.fromString(idString) as T;
  }

  public static fromJSON<T extends Id = Id>(json: any): T | undefined {
    return utils.fromJSON(json) as T;
  }

  /**
   * Decodes as Buffer zero-copy
   */
  public static fromBuffer<T extends Id = Id>(idBuffer: Buffer): T {
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

  public [Symbol.toPrimitive](_hint: 'string' | 'number' | 'default'): string {
    return utils.toString(this as unknown as Id);
  }

  public toString(): string {
    return utils.toString(this as unknown as Id);
  }

  public toJSON(): { type: string; data: Array<number> } {
    return utils.toJSON(this);
  }

  /**
   * Encodes as Buffer zero-copy
   */
  public toBuffer(): Buffer {
    return utils.toBuffer(this);
  }

  /**
   * Encodes as a 16 byte UUID
   * This only works when the Id is 16 bytes long
   */
  public toUUID(): string {
    return utils.toUUID(this);
  }

  /**
   * Encodes an multibase ID string
   */
  public toMultibase(format: MultibaseFormats): string {
    return utils.toMultibase(this, format);
  }

  /**
   * Efficiently compares for equality
   * This is faster than comparing by binary string
   * If you have an ArrayBuffer, wrap it in Uint8Array first
   */
  public equals(id: Uint8Array): boolean {
    return utils.equals(this, id);
  }
}

export default IdInternal;

export type { Id };

const textDecoder = new TextDecoder("utf-8", { fatal: false });

export class BinaryReader {
  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  private cursor = 0;

  constructor(input: Uint8Array) {
    this.bytes = input;
    this.view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  }

  get offset(): number {
    return this.cursor;
  }

  get byteLength(): number {
    return this.bytes.byteLength;
  }

  get remaining(): number {
    return this.bytes.byteLength - this.cursor;
  }

  seek(nextOffset: number): void {
    if (nextOffset < 0 || nextOffset > this.bytes.byteLength) {
      throw new RangeError(
        `BinaryReader seek out of bounds: ${nextOffset} (length ${this.bytes.byteLength})`,
      );
    }
    this.cursor = nextOffset;
  }

  skip(count: number): void {
    this.seek(this.cursor + count);
  }

  private assertAvailable(count: number): void {
    if (count < 0 || this.cursor + count > this.bytes.byteLength) {
      throw new RangeError(
        `BinaryReader buffer underflow at offset ${this.cursor}: needed ${count}, remaining ${this.remaining}`,
      );
    }
  }

  readUint8(): number {
    this.assertAvailable(1);
    const val = this.view.getUint8(this.cursor);
    this.cursor += 1;
    return val;
  }

  readUint16(): number {
    this.assertAvailable(2);
    const val = this.view.getUint16(this.cursor, true);
    this.cursor += 2;
    return val;
  }

  readInt32(): number {
    this.assertAvailable(4);
    const val = this.view.getInt32(this.cursor, true);
    this.cursor += 4;
    return val;
  }

  readUint32(): number {
    this.assertAvailable(4);
    const val = this.view.getUint32(this.cursor, true);
    this.cursor += 4;
    return val;
  }

  readInt64(): bigint {
    this.assertAvailable(8);
    const val = this.view.getBigInt64(this.cursor, true);
    this.cursor += 8;
    return val;
  }

  readUint64(): bigint {
    this.assertAvailable(8);
    const val = this.view.getBigUint64(this.cursor, true);
    this.cursor += 8;
    return val;
  }

  readBytes(count: number): Uint8Array {
    this.assertAvailable(count);
    const slice = this.bytes.slice(this.cursor, this.cursor + count);
    this.cursor += count;
    return slice;
  }

  peekBytes(count: number): Uint8Array {
    this.assertAvailable(count);
    return this.bytes.subarray(this.cursor, this.cursor + count);
  }

  expectBytes(expected: readonly number[], label: string): void {
    const actual = this.readBytes(expected.length);
    for (let i = 0; i < expected.length; i++) {
      if (actual[i] !== expected[i]) {
        throw new Error(
          `Invalid ${label} at offset ${this.cursor - expected.length + i}: expected 0x${expected[i]?.toString(16).padStart(2, "0")}, got 0x${actual[i]?.toString(16).padStart(2, "0")}`,
        );
      }
    }
  }

  readLengthPrefixedUtf8(maxBytes = 262_144): string {
    const byteLen = this.readInt32();
    if (byteLen < 0 || byteLen > maxBytes) {
      throw new RangeError(`Invalid UTF-8 string byte length: ${byteLen}`);
    }
    if (byteLen === 0) return "";
    const raw = this.readBytes(byteLen);
    return textDecoder.decode(raw);
  }
}

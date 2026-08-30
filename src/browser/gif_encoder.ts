/**
 * Pure TypeScript GIF89a Animated GIF Encoder
 * Zero external dependencies.
 */

export interface GifFrame {
  width: number;
  height: number;
  /** RGBA pixel buffer (width * height * 4) or 256-indexed buffer with palette */
  rgbaData: Uint8Array | Uint8ClampedArray;
  delayMs: number;
}

export class GifEncoder {
  private width: number;
  private height: number;
  private frames: GifFrame[] = [];
  private loopCount: number;

  // Reusable LZW tables to eliminate GC allocations per frame
  private prefixTable = new Int32Array(4096);
  private suffixTable = new Int32Array(4096);
  private codeTable = new Int32Array(4096);

  constructor(width: number, height: number, loopCount = 0) {
    this.width = width;
    this.height = height;
    this.loopCount = loopCount; // 0 = infinite loop
  }

  public addFrame(rgbaData: Uint8Array | Uint8ClampedArray, delayMs = 100): void {
    this.frames.push({
      width: this.width,
      height: this.height,
      rgbaData,
      delayMs,
    });
  }

  public encode(): Uint8Array {
    const chunks: Uint8Array[] = [];

    // 1. Header (GIF89a)
    chunks.push(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]));

    // 2. Logical Screen Descriptor
    const lsd = new Uint8Array(7);
    lsd[0] = this.width & 0xff;
    lsd[1] = (this.width >> 8) & 0xff;
    lsd[2] = this.height & 0xff;
    lsd[3] = (this.height >> 8) & 0xff;
    lsd[4] = 0x70; // No Global Color Table, 8 bits/pixel color resolution
    lsd[5] = 0; // Background color index
    lsd[6] = 0; // Pixel aspect ratio
    chunks.push(lsd);

    // 3. Netscape 2.0 Loop Extension
    if (this.loopCount >= 0) {
      const netscape = new Uint8Array([
        0x21,
        0xff,
        0x0b,
        0x4e,
        0x45,
        0x54,
        0x53,
        0x43,
        0x41,
        0x50,
        0x45,
        0x32,
        0x2e,
        0x30,
        0x03,
        0x01,
        this.loopCount & 0xff,
        (this.loopCount >> 8) & 0xff,
        0x00,
      ]);
      chunks.push(netscape);
    }

    // 4. Encode each frame
    for (const frame of this.frames) {
      const { palette, indexedPixels } = this.quantizeRgba(
        frame.rgbaData,
        frame.width,
        frame.height
      );

      // Graphic Control Extension
      const delayUnits = Math.max(1, Math.round(frame.delayMs / 10)); // in 1/100s
      const gce = new Uint8Array([
        0x21,
        0xf9,
        0x04,
        0x04, // Disposal method: 1 (do not dispose / draw over)
        delayUnits & 0xff,
        (delayUnits >> 8) & 0xff,
        0x00, // Transparent color index (none)
        0x00, // Terminator
      ]);
      chunks.push(gce);

      // Image Descriptor
      const id = new Uint8Array(10);
      id[0] = 0x2c; // Image separator
      id[1] = 0; // Left
      id[2] = 0;
      id[3] = 0; // Top
      id[4] = 0;
      id[5] = frame.width & 0xff;
      id[6] = (frame.width >> 8) & 0xff;
      id[7] = frame.height & 0xff;
      id[8] = (frame.height >> 8) & 0xff;
      id[9] = 0x87; // Local Color Table Present, 256 colors (2^(7+1) = 256)
      chunks.push(id);

      // Local Color Table (256 * 3 = 768 bytes)
      chunks.push(palette);

      // LZW Image Data
      const lzwData = this.lzwEncode(indexedPixels, 8);
      chunks.push(lzwData);
    }

    // 5. Trailer
    chunks.push(new Uint8Array([0x3b]));

    // Concatenate all chunks
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Fast uniform 6x7x6 color quantizer mapping RGBA to 256-color palette
   */
  private quantizeRgba(
    rgba: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number
  ): { palette: Uint8Array; indexedPixels: Uint8Array } {
    const pixelCount = width * height;
    const indexedPixels = new Uint8Array(pixelCount);
    const palette = new Uint8Array(256 * 3);

    // Build standard 6x7x6 web-safe palette (252 colors) + 4 grayscale
    let palIdx = 0;
    for (let r = 0; r < 6; r++) {
      for (let g = 0; g < 7; g++) {
        for (let b = 0; b < 6; b++) {
          palette[palIdx++] = Math.round((r * 255) / 5);
          palette[palIdx++] = Math.round((g * 255) / 6);
          palette[palIdx++] = Math.round((b * 255) / 5);
        }
      }
    }
    // Fill remaining 4 colors with extra grays
    palette[palIdx++] = 32;
    palette[palIdx++] = 32;
    palette[palIdx++] = 32;
    palette[palIdx++] = 64;
    palette[palIdx++] = 64;
    palette[palIdx++] = 64;
    palette[palIdx++] = 128;
    palette[palIdx++] = 128;
    palette[palIdx++] = 128;
    palette[palIdx++] = 192;
    palette[palIdx++] = 192;
    palette[palIdx++] = 192;

    // Map pixels to closest palette index
    for (let i = 0; i < pixelCount; i++) {
      const offset = i * 4;
      const r = rgba[offset];
      const g = rgba[offset + 1];
      const b = rgba[offset + 2];

      const rIdx = Math.min(5, Math.floor((r * 6) / 256));
      const gIdx = Math.min(6, Math.floor((g * 7) / 256));
      const bIdx = Math.min(5, Math.floor((b * 6) / 256));

      indexedPixels[i] = rIdx * 42 + gIdx * 6 + bIdx;
    }

    return { palette, indexedPixels };
  }

  /**
   * LZW compression for GIF with recycled table buffers
   */
  private lzwEncode(pixels: Uint8Array, minCodeSize: number): Uint8Array {
    const clearCode = 1 << minCodeSize; // 256
    const eoiCode = clearCode + 1; // 257

    let codeSize = minCodeSize + 1; // 9
    let nextCode = eoiCode + 1; // 258

    const prefixTable = this.prefixTable;
    const suffixTable = this.suffixTable;
    const codeTable = this.codeTable;

    const outBytes: number[] = [minCodeSize];
    const subBlock: number[] = [];

    let bitBuffer = 0;
    let bitCount = 0;

    const emitBits = (code: number, size: number) => {
      bitBuffer |= code << bitCount;
      bitCount += size;
      while (bitCount >= 8) {
        subBlock.push(bitBuffer & 0xff);
        bitBuffer >>= 8;
        bitCount -= 8;

        if (subBlock.length === 254) {
          outBytes.push(subBlock.length, ...subBlock);
          subBlock.length = 0;
        }
      }
    };

    const resetTable = () => {
      prefixTable.fill(-1);
      suffixTable.fill(-1);
      codeTable.fill(-1);
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
    };

    emitBits(clearCode, codeSize);
    resetTable();

    if (pixels.length > 0) {
      let currentPrefix = pixels[0];

      for (let i = 1; i < pixels.length; i++) {
        const nextPixel = pixels[i];
        let foundCode = -1;

        // Simple hash probe for (currentPrefix, nextPixel)
        const hash = ((currentPrefix << 8) ^ nextPixel) & 0xfff;
        let probe = hash;
        while (codeTable[probe] !== -1) {
          if (prefixTable[probe] === currentPrefix && suffixTable[probe] === nextPixel) {
            foundCode = codeTable[probe];
            break;
          }
          probe = (probe + 1) & 0xfff;
        }

        if (foundCode !== -1) {
          currentPrefix = foundCode;
        } else {
          emitBits(currentPrefix, codeSize);

          if (nextCode < 4096) {
            let insertProbe = hash;
            while (codeTable[insertProbe] !== -1) {
              insertProbe = (insertProbe + 1) & 0xfff;
            }
            prefixTable[insertProbe] = currentPrefix;
            suffixTable[insertProbe] = nextPixel;
            codeTable[insertProbe] = nextCode++;

            if (nextCode > 1 << codeSize && codeSize < 12) {
              codeSize++;
            }
          } else {
            emitBits(clearCode, codeSize);
            resetTable();
          }

          currentPrefix = nextPixel;
        }
      }

      emitBits(currentPrefix, codeSize);
    }

    emitBits(eoiCode, codeSize);

    // Flush remaining bits
    if (bitCount > 0) {
      subBlock.push(bitBuffer & 0xff);
    }

    if (subBlock.length > 0) {
      outBytes.push(subBlock.length, ...subBlock);
      subBlock.length = 0;
    }

    // Block terminator
    outBytes.push(0x00);

    return new Uint8Array(outBytes);
  }
}

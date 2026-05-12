import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const targetPath = path.join(
  repoRoot,
  'harmony',
  'oh_modules',
  '@react-native-oh-tpl',
  'react-native-fs',
  'src',
  'main',
  'ets',
  'FsTurboModule.ts',
);

function replaceMethod(source, methodName, pattern, replacement) {
  if (!pattern.test(source)) {
    return source;
  }

  const nextSource = source.replace(pattern, replacement);
  if (nextSource === source) {
    return source;
  }

  console.log(`[harmony-patch] patched react-native-fs ${methodName}`);
  return nextSource;
}

function main() {
  if (!fs.existsSync(targetPath)) {
    console.log('[harmony-patch] skipped react-native-fs patch: target not found');
    return;
  }

  const realTargetPath = fs.realpathSync(targetPath);
  const originalSource = fs.readFileSync(realTargetPath, 'utf8');
  let nextSource = originalSource;

  nextSource = replaceMethod(
    nextSource,
    'readFile',
    /readFile\(path: string\): Promise<string> \{[\s\S]*?\n  \};/,
    `readFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let file;
      try {
        file = fs.openSync(path);
        let bufSize = this.FOUR_ZERO_NINE_SIX;
        let readSize = this.ZERO;
        let buffers: buffer.Buffer[] = [];

        while (true) {
          let buf = new ArrayBuffer(bufSize);
          let readOptions: ReadOptions = {
            offset: readSize,
            length: bufSize
          };
          let readLen = fs.readSync(file.fd, buf, readOptions);
          if (readLen <= this.ZERO) {
            break;
          }

          readSize += readLen;
          buffers.push(buffer.from(buf.slice(this.ZERO, readLen)));
        }

        let merged = buffer.concat(buffers);
        let base64Helper = new util.Base64Helper();
        resolve(base64Helper.encodeToStringSync(
          new Uint8Array(merged.buffer, merged.byteOffset, merged.length)
        ));
      } catch (e) {
        reject(e);
      } finally {
        if (file) {
          fs.closeSync(file);
        }
      }
    })
  };`,
  );

  nextSource = replaceMethod(
    nextSource,
    'appendFile',
    /appendFile\(path: string, contentStr: string\): Promise<void> \{[\s\S]*?\n  \};/,
    `appendFile(path: string, contentStr: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let result = buffer.from(contentStr, this.BASE64);
      let file = fs.openSync(
        path,
        fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.APPEND,
      );
      fs.write(file.fd, result.buffer, (err: BusinessError, writeLen: number) => {
        if (err) {
          reject('Directory could not be created');
        } else {
          resolve();
        }
        fs.closeSync(file);
      });
    })
  };`,
  );

  nextSource = replaceMethod(
    nextSource,
    'copyFile',
    /copyFile\(from: string, into: string\): Promise<void> \{[\s\S]*?\n  \};/,
    `copyFile(from: string, into: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.copyFile(from, into, (err: BusinessError) => {
        if (err) {
          reject(err.message);
        } else {
          resolve();
        }
      })
    })
  };`,
  );

  nextSource = replaceMethod(
    nextSource,
    'read',
    /read\(path: string, length: number, position: number\): Promise<string> \{[\s\S]*?\n  \}/,
    `read(path: string, length: number, position: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let file;
      try {
        file = fs.openSync(path);
        let fileSize = fs.statSync(path).size;
        let safePosition = Math.max(position, this.ZERO);
        let requestedLength =
          length > this.ZERO ? length : Math.max(fileSize - safePosition, this.ZERO);
        let remaining = Math.max(
          Math.min(requestedLength, fileSize - safePosition),
          this.ZERO
        );
        let readOffset = safePosition;
        let buffers: buffer.Buffer[] = [];

        while (remaining > this.ZERO) {
          let chunkLength = Math.min(this.FOUR_ZERO_NINE_SIX, remaining);
          let buf = new ArrayBuffer(chunkLength);
          let readOptions: ReadOptions = {
            offset: readOffset,
            length: chunkLength
          };
          let readLen = fs.readSync(file.fd, buf, readOptions);
          if (readLen <= this.ZERO) {
            break;
          }

          readOffset += readLen;
          remaining -= readLen;
          buffers.push(buffer.from(buf.slice(this.ZERO, readLen)));
        }

        let merged = buffer.concat(buffers);
        let base64Helper = new util.Base64Helper();
        resolve(base64Helper.encodeToStringSync(
          new Uint8Array(merged.buffer, merged.byteOffset, merged.length)
        ));
      } catch (err) {
        reject('read failed with error message: ' + err.message);
      } finally {
        if (file) {
          fs.closeSync(file);
        }
      }
    })
  }`,
  );

  nextSource = replaceMethod(
    nextSource,
    'write',
    /write\(filepath: string, contents: string, position: number\): Promise<void> \{[\s\S]*?\n  \}/,
    `write(filepath: string, contents: string, position: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let result = buffer.from(contents, this.BASE64);
      let file = fs.openSync(filepath, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE);
      let writeOption: WriteOptions = {
        offset: position >= this.ZERO ? position : fs.statSync(filepath).size
      };
      fs.write(file.fd, result.buffer, writeOption, (err: BusinessError, writeLen: number) => {
        if (err) {
          reject('write data to file failed with error message:' + err.message + ', error code: ' + err.code);
        } else {
          resolve();
        }
        fs.closeSync(file);
      });
    })
  }`,
  );

  if (nextSource === originalSource) {
    console.log('[harmony-patch] react-native-fs already patched');
    return;
  }

  fs.writeFileSync(realTargetPath, nextSource);
}

main();

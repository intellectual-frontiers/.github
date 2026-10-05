// Where the extension's own files are, from a test compiled into out/test or out/test/support (the stage the tests run in).
import * as path from 'path';

/** The extension's directory in the stage: package.json, src/ (TypeScript) and out/ (what the tests run). */
export const EXT_ROOT = path.resolve(__dirname, __dirname.includes(`${path.sep}support`) ? '../../..' : '../..');
export const SRC_DIR = path.join(EXT_ROOT, 'src');

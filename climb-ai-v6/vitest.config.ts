import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve:{alias:{'server-only':fileURLToPath(new URL('./tests/serverOnlyStub.ts',import.meta.url)),'@':fileURLToPath(new URL('.',import.meta.url))}},
});

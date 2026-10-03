import { defineConfig } from '@vscode/test-cli';

// The VS Code version to run integration tests against.
// CI overrides this via the VSCODE_VERSION env var so the same suite runs on
// both `stable` and the minimum version declared in `engines.vscode`.
const version = process.env.VSCODE_VERSION || 'stable';

export default defineConfig({
  version,
  files: 'out/test/**/*.test.js',
  // Open the bundled fixtures folder as the workspace so opening a `.vim`
  // file exercises the real language-client startup path.
  workspaceFolder: './src/test/fixtures',
  mocha: {
    ui: 'tdd',
    timeout: 60000,
  },
});

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'XadillaX.viml';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

suite('VimL extension integration', () => {
  test('extension is present', () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be installed in the test host`);
  });

  test('extension activates without throwing', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);

    // Activating the extension loads `vscode-languageclient/node` at runtime.
    // If the v10 package `exports` map or module resolution were broken at
    // runtime (not just at compile time), this would reject here.
    await ext!.activate();
    assert.strictEqual(ext!.isActive, true, 'extension should be active after activate()');
  });

  test('opening a .vim file starts the language client and keeps the host healthy', async () => {
    // Compiled test lives in `out/test`; the fixtures stay in the source tree
    // at `src/test/fixtures`, so walk back to the repo root to reach them.
    const fixture = path.resolve(__dirname, '..', '..', 'src', 'test', 'fixtures', 'sample.vim');
    const doc = await vscode.workspace.openTextDocument(fixture);
    await vscode.window.showTextDocument(doc);

    assert.strictEqual(doc.languageId, 'viml', 'sample.vim should be detected as viml');

    // Opening a viml document drives `new LanguageClient(...)` + `client.start()`
    // (vscode-languageclient v10). Give the client a moment to spin up the
    // vim-language-server child process, then assert the host is still alive
    // and the extension stayed active.
    await sleep(3000);

    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.strictEqual(ext!.isActive, true, 'extension should remain active after client start');
  });
});

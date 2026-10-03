import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

// Cross-file + wildcard integration tests for the syntax-group providers
// (issue #69, v2). These exercise the workspace-wide index: definitions in one
// file resolved from references in another, wildcard expansion, and workspace
// symbols.

const WS = path.resolve(__dirname, '..', '..', 'src', 'test', 'fixtures', 'workspace');

function uriFor(name: string): vscode.Uri {
  return vscode.Uri.file(path.join(WS, name));
}

function positionOf(doc: vscode.TextDocument, needle: string, occurrence = 0): vscode.Position {
  const text = doc.getText();
  let idx = -1;
  for (let i = 0; i <= occurrence; i++) {
    idx = text.indexOf(needle, idx + 1);
    assert.notStrictEqual(idx, -1, `needle "${needle}" occ ${occurrence} not found`);
  }
  return doc.positionAt(idx);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

suite('Syntax group providers - workspace & wildcards (#69 v2)', () => {
  let refsDoc: vscode.TextDocument;

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('XadillaX.viml');
    await ext!.activate();
    // Open both files so they are present; give the async workspace index
    // (findFiles + read) time to populate.
    await vscode.workspace.openTextDocument(uriFor('syntax-defs.vim'));
    refsDoc = await vscode.workspace.openTextDocument(uriFor('syntax-refs.vim'));
    await vscode.window.showTextDocument(refsDoc);
    await sleep(2000);
  });

  test('go-to-definition resolves across files (@cluster ref -> defs file)', async () => {
    const pos = positionOf(refsDoc, 'xfileGroup'); // the @xfileGroup reference
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider', refsDoc.uri, pos
    );
    assert.ok(locations && locations.length > 0, 'expected cross-file definition');
    assert.ok(
      locations.some(l => l.uri.fsPath.endsWith('syntax-defs.vim')),
      'definition should live in syntax-defs.vim'
    );
  });

  test('wildcard reference expands to all matching definitions', async () => {
    // `xfileAlpha.*` should resolve to both xfileAlpha and xfileAlphaNum.
    const pos = positionOf(refsDoc, 'xfileAlpha.*');
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider', refsDoc.uri, pos
    );
    assert.ok(locations, 'expected locations');
    assert.ok(
      locations.length >= 2,
      `xfileAlpha.* should expand to >=2 defs, got ${locations.length}`
    );
  });

  test('workspace symbols include cross-file groups', async () => {
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeWorkspaceSymbolProvider', 'xfile'
    );
    assert.ok(symbols, 'expected workspace symbols');
    const names = symbols.map(s => s.name);
    for (const expected of ['xfileAlpha', 'xfileAlphaNum', 'xfileBeta', 'xfileGroup']) {
      assert.ok(names.includes(expected), `missing ${expected}; got ${names.join(',')}`);
    }
  });

  test('find references finds usages across files', async () => {
    // Cursor on xfileAlpha definition in the defs file.
    const defsDoc = await vscode.workspace.openTextDocument(uriFor('syntax-defs.vim'));
    const pos = positionOf(defsDoc, 'xfileAlpha', 0);
    const refs = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider', defsDoc.uri, pos
    );
    assert.ok(refs && refs.length > 0, 'expected cross-file references');
    assert.ok(
      refs.some(r => r.uri.fsPath.endsWith('syntax-refs.vim')),
      'should find the reference in syntax-refs.vim'
    );
  });
});

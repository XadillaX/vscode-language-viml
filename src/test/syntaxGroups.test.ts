import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

// Integration tests for the syntax-group providers (issue #69). These run in a
// real VS Code host and exercise the registered providers via the built-in
// executeXxxProvider commands.

function fixtureUri(): vscode.Uri {
  return vscode.Uri.file(
    path.resolve(__dirname, '..', '..', 'src', 'test', 'fixtures', 'syntax-sample.vim')
  );
}

// Position of the Nth occurrence (0-based) of `needle` in the document.
function positionOf(doc: vscode.TextDocument, needle: string, occurrence = 0): vscode.Position {
  const text = doc.getText();
  let idx = -1;
  for (let i = 0; i <= occurrence; i++) {
    idx = text.indexOf(needle, idx + 1);
    assert.notStrictEqual(idx, -1, `needle "${needle}" occurrence ${occurrence} not found`);
  }
  return doc.positionAt(idx);
}

suite('Syntax group providers (#69)', () => {
  let doc: vscode.TextDocument;

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('XadillaX.viml');
    await ext!.activate();
    doc = await vscode.workspace.openTextDocument(fixtureUri());
    await vscode.window.showTextDocument(doc);
  });

  test('document symbols include the syntax groups', async () => {
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeDocumentSymbolProvider', doc.uri
    );
    assert.ok(symbols, 'expected symbols');
    const names = symbols.map(s => s.name);
    for (const expected of [
      'vimlTestNumber', 'vimlTestName', 'vimlTestString', 'vimlTestAll', 'vimlTestTop',
    ]) {
      assert.ok(names.includes(expected), `missing symbol ${expected}; got ${names.join(',')}`);
    }
  });

  test('go-to-definition from a contains= reference jumps to the definition', async () => {
    // The reference `contains=vimlTestNumber` on the `vimlTestName` match line.
    const refPos = positionOf(doc, 'vimlTestNumber', 1); // 0th is the def line; 1st is the contains= ref
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider', doc.uri, refPos
    );
    assert.ok(locations && locations.length > 0, 'expected a definition location');
    // The definition is on line 3 (0-based) `syn match vimlTestNumber ...`.
    assert.strictEqual(locations[0].range.start.line, 3);
  });

  test('go-to-definition resolves an @cluster reference', async () => {
    // `contains=@vimlTestAll` on the last line -> definition of vimlTestAll.
    const refPos = positionOf(doc, 'vimlTestAll', 1); // 0th is def, 1st is @-reference
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider', doc.uri, refPos
    );
    assert.ok(locations && locations.length > 0, 'expected a cluster definition location');
    const defText = doc.lineAt(locations[0].range.start.line).text;
    assert.ok(/syn\s+cluster\s+vimlTestAll/.test(defText), `got line: ${defText}`);
  });

  test('find references returns the usages of a group', async () => {
    // Cursor on the definition of vimlTestNumber (line 3).
    const defPos = positionOf(doc, 'vimlTestNumber', 0);
    const refs = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider', doc.uri, defPos
    );
    assert.ok(refs && refs.length >= 2,
      `expected >=2 references to vimlTestNumber, got ${refs ? refs.length : 0}`);
  });
});

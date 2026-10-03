'use strict';

// Grammar regression test for GitHub issue #74 (map highlighting).
//
// Tokenizes representative lines with the exact engine VS Code uses
// (vscode-textmate + vscode-oniguruma) and asserts the scopes that the
// scripts/patch-grammar.js patch is responsible for. Runs as a plain Node
// test (no VS Code host needed) via `npm run test:grammar`.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const oniguruma = require('vscode-oniguruma');
const vsctm = require('vscode-textmate');

const GRAMMAR = path.join(__dirname, '..', 'syntaxes', 'viml.tmLanguage.json');

const wasmBin = fs.readFileSync(
  path.join(require.resolve('vscode-oniguruma'), '../onig.wasm')
).buffer;
const onigLib = oniguruma.loadWASM(wasmBin).then(() => ({
  createOnigScanner: patterns => new oniguruma.OnigScanner(patterns),
  createOnigString: s => new oniguruma.OnigString(s),
}));

const registry = new vsctm.Registry({
  onigLib,
  loadGrammar: () =>
    Promise.resolve(
      vsctm.parseRawGrammar(fs.readFileSync(GRAMMAR, 'utf8'), GRAMMAR)
    ),
});

// Tokenize a line and return [{ text, scopes }].
function tokenize(grammar, line) {
  const r = grammar.tokenizeLine(line, vsctm.INITIAL);
  return r.tokens.map(t => ({
    text: line.substring(t.startIndex, t.endIndex),
    scopes: t.scopes,
  }));
}

// Find the token covering the first occurrence of `needle`.
function tokenOf(tokens, needle) {
  return tokens.find(t => t.text.includes(needle));
}

function run(grammar) {
  let passed = 0;
  const check = (desc, fn) => {
    fn();
    passed++;
    console.log('  ok - ' + desc);
  };

  // --- Issue #74: ordinary map lhs/rhs ---
  {
    const t = tokenize(grammar, 'nnoremap qq "_dd');
    check('lhs `qq` is scoped (not bare source.viml)', () => {
      const lhs = tokenOf(t, 'q');
      assert.ok(
        lhs.scopes.some(s => s.includes('map-lhs')),
        'lhs should carry a map-lhs scope, got: ' + lhs.scopes.join(',')
      );
    });
    check('rhs `"_dd` is NOT highlighted as a comment', () => {
      for (const tok of t) {
        if (tok.text.includes('"_')) {
          assert.ok(
            !tok.scopes.some(s => s.includes('comment')),
            'register rhs must not be a comment, got: ' + tok.scopes.join(',')
          );
          assert.ok(
            tok.scopes.some(s => s.includes('map-rhs')),
            'register rhs should be in map-rhs, got: ' + tok.scopes.join(',')
          );
        }
      }
    });
  }

  // --- <plug> notation in rhs ---
  {
    const t = tokenize(grammar, 'nmap qs <plug>Dsurround');
    check('<plug> in rhs is notation', () => {
      const plug = tokenOf(t, 'plug');
      assert.ok(
        plug.scopes.some(s => s.includes('notation')),
        'got: ' + plug.scopes.join(',')
      );
    });
  }

  // --- <expr> map: rhs is a real expression ---
  {
    const line = 'nnoremap <expr> k v:count ? "k" : "gk"';
    const t = tokenize(grammar, line);
    check('<expr> rhs string "k" is a string (not a comment)', () => {
      const str = t.find(x => x.text === 'k' &&
        x.scopes.some(s => s.includes('string.quoted')));
      assert.ok(str, 'expected a quoted-string token for "k" in expr rhs');
    });
    check('<expr> rhs variable v:count is a variable', () => {
      const v = t.find(x => x.scopes.some(s => s.includes('variable')));
      assert.ok(v, 'expected a variable token in expr rhs');
    });
  }

  // --- No regression on non-map lines ---
  {
    check('a pure comment line is still a comment', () => {
      const t = tokenize(grammar, '" just a comment');
      assert.ok(t[0].scopes.some(s => s.includes('comment')));
    });
    check('`nmapclear` is NOT captured by the map rule', () => {
      const t = tokenize(grammar, 'nmapclear');
      assert.ok(
        !t.some(x => x.scopes.some(s => s.includes('meta.map'))),
        'nmapclear should not enter the map rule'
      );
    });
  }

  console.log(`\n${passed} grammar assertions passed.`);
}

registry
  .loadGrammar('source.viml')
  .then(grammar => {
    if (!grammar) throw new Error('failed to load source.viml grammar');
    run(grammar);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });

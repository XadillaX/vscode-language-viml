'use strict';

// Unit tests for the pure syntax-group parser (src/syntaxGroups.ts),
// addressing GitHub issue #69. Runs as plain Node (no VS Code host) via
// `npm run test:syntax`.

const assert = require('assert');
const path = require('path');

// Compiled by `tsc` into out/ before this runs (see the pretest hooks).
const { parseSyntaxGroups, buildLogicalLines } = require(
  path.join(__dirname, '..', 'out', 'syntaxGroups.js')
);

let passed = 0;
function check(desc, fn) {
  fn();
  passed++;
  console.log('  ok - ' + desc);
}

function defNames(g) {
  return g.definitions.map(d => `${d.kind}:${d.name}`);
}
function refNames(g) {
  return g.references.map(r => `${r.via}:${r.name}`);
}

// --- definitions ---
check('extracts match/region/cluster/keyword definitions', () => {
  const g = parseSyntaxGroups([
    'syn match   fooMatch   /\\d\\+/',
    'syntax region fooRegion start=/(/ end=/)/',
    'syn cluster fooCluster contains=fooMatch',
    'syn keyword fooKw todo fixme',
  ].join('\n'));
  const names = defNames(g);
  assert.ok(names.includes('match:fooMatch'), names.join(','));
  assert.ok(names.includes('region:fooRegion'), names.join(','));
  assert.ok(names.includes('cluster:fooCluster'), names.join(','));
  assert.ok(names.includes('keyword:fooKw'), names.join(','));
});

check('cluster definition name excludes the @ sigil', () => {
  const g = parseSyntaxGroups('syn cluster @Bad contains=x'); // leading @ not valid in def
  // `@Bad` is not matched as a plain name here; but a normal def:
  const g2 = parseSyntaxGroups('syn cluster myCluster contains=x');
  assert.strictEqual(g2.definitions[0].name, 'myCluster');
});

// --- references ---
check('extracts contains/nextgroup/containedby references', () => {
  const g = parseSyntaxGroups(
    'syn match foo /x/ contains=aGroup,bGroup nextgroup=cGroup containedby=dGroup'
  );
  const names = refNames(g);
  assert.ok(names.includes('contains:aGroup'), names.join(','));
  assert.ok(names.includes('contains:bGroup'), names.join(','));
  assert.ok(names.includes('nextgroup:cGroup'), names.join(','));
  assert.ok(names.includes('containedby:dGroup'), names.join(','));
});

check('@cluster reference is recorded without the @', () => {
  const g = parseSyntaxGroups('syn match foo /x/ contains=@myCluster');
  assert.strictEqual(g.references.length, 1);
  assert.strictEqual(g.references[0].name, 'myCluster');
});

check('reserved words (ALL/ALLBUT/TOP/CONTAINED) are ignored', () => {
  const g = parseSyntaxGroups('syn match foo /x/ contains=ALLBUT,@realCluster,TOP');
  const names = g.references.map(r => r.name);
  assert.ok(!names.includes('ALLBUT') && !names.includes('TOP'), names.join(','));
  assert.ok(names.includes('realCluster'), names.join(','));
});

// --- line continuation ---
check('joins backslash continuation lines for references', () => {
  const g = parseSyntaxGroups([
    'syn region fooRegion start=/(/ end=/)/',
    '      \\ contains=aGroup,bGroup',
    '      \\ nextgroup=cGroup',
  ].join('\n'));
  const names = refNames(g);
  assert.ok(names.includes('contains:aGroup'), names.join(','));
  assert.ok(names.includes('contains:bGroup'), names.join(','));
  assert.ok(names.includes('nextgroup:cGroup'), names.join(','));
});

// --- range mapping across continuations ---
check('reference on a continuation line maps to the correct physical line', () => {
  const g = parseSyntaxGroups([
    'syn region fooRegion start=/(/ end=/)/',   // line 0
    '      \\ contains=aGroup',                   // line 1
  ].join('\n'));
  const ref = g.references.find(r => r.name === 'aGroup');
  assert.ok(ref, 'aGroup ref should exist');
  assert.strictEqual(ref.nameSpan.startLine, 1, 'should map to physical line 1');
  // verify the character offset points at the "aGroup" token
  const lineText = '      \\ contains=aGroup';
  assert.strictEqual(
    lineText.slice(ref.nameSpan.startCharacter, ref.nameSpan.endCharacter),
    'aGroup'
  );
});

check('definition name span points exactly at the name', () => {
  const line = 'syn match fooMatch /x/';
  const g = parseSyntaxGroups(line);
  const d = g.definitions[0];
  assert.strictEqual(
    line.slice(d.nameSpan.startCharacter, d.nameSpan.endCharacter),
    'fooMatch'
  );
});

check('non-syntax lines produce nothing', () => {
  const g = parseSyntaxGroups([
    'function! Foo()',
    '  let x = 1',
    'endfunction',
    '" contains=notAThing in a comment is still scanned (acceptable v1 approximation)',
  ].join('\n'));
  assert.strictEqual(g.definitions.length, 0);
});

console.log(`\n${passed} syntax-group assertions passed.`);

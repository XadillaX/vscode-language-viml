// Pure, dependency-free parser for Vim :syntax group definitions and
// references. Kept free of any `vscode` import so it can be unit-tested as
// plain Node (see scripts/test-syntax-groups.js) and reused by the VS Code
// providers in syntaxGroupProviders.ts.
//
// Addresses GitHub issue #69: let users jump between a syntax group's
// definition (`syn match Foo`, `syn region Foo`, `syn cluster Foo`, ...) and
// its references (`contains=Foo`, `nextgroup=Foo`, `containedby=Foo`, ...).

export type SyntaxGroupKind = 'match' | 'region' | 'cluster' | 'keyword';

export interface Span {
  // 0-based line, 0-based character; end is exclusive (LSP/VS Code style).
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export interface SyntaxGroupDefinition {
  name: string;
  kind: SyntaxGroupKind;
  // Range covering just the group name token.
  nameSpan: Span;
}

export interface SyntaxGroupReference {
  name: string;
  // Range covering the referenced token (without any leading `@`). For a
  // wildcard reference this covers the whole pattern, e.g. `foo.*`.
  nameSpan: Span;
  // The key the reference appeared under, e.g. "contains", "nextgroup".
  via: string;
  // True when `name` is a Vim group-name pattern (contains `*`) rather than a
  // literal group name, e.g. `foo.*` or `vimFunc.*`.
  isWildcard: boolean;
}

export interface SyntaxGroups {
  definitions: SyntaxGroupDefinition[];
  references: SyntaxGroupReference[];
}

// Turn a Vim group-name pattern (as used in `contains=foo.*`) into a RegExp
// anchored to the whole name. Vim uses a small pattern syntax here; we support
// the common pieces: `.` (any char), `*` (zero-or-more of previous), and treat
// everything else literally. Returns null if the token has no wildcard.
export function wildcardToRegExp(pattern: string): RegExp | null {
  if (!pattern.includes('*')) {
    return null;
  }
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '.') {
      out += '.';
    } else if (ch === '*') {
      out += '*';
    } else if (/[A-Za-z0-9_]/.test(ch)) {
      out += ch;
    } else {
      // Escape anything else so it is matched literally.
      out += '\\' + ch;
    }
  }
  try {
    return new RegExp('^' + out + '$');
  } catch {
    return null;
  }
}

// Reserved words that may appear where a group name is expected but which are
// NOT user-defined groups (so they are never treated as refs/defs).
const RESERVED = new Set([
  'ALL', 'ALLBUT', 'TOP', 'CONTAINED', 'NONE',
]);

// `syn[tax]` then a sub-command. We only index the four that introduce a named
// group. `syn keyword` also names a group (its first arg).
const DEFINITION_RE =
  /^\s*sy(?:n(?:tax)?)?\s+(match|region|cluster|keyword)\s+(@?)([A-Za-z][A-Za-z0-9_]*)/;

// Keys whose `=`-value is a comma-separated list of group names.
const REFERENCE_KEYS = ['contains', 'nextgroup', 'containedby', 'add'];
const REFERENCE_KEY_RE = new RegExp(
  `\\b(${REFERENCE_KEYS.join('|')})=([^\\s]*)`,
  'g'
);

interface LogicalLine {
  text: string;
  // Maps an offset within `text` back to the physical line and character.
  // segments are the pieces each physical line contributed.
  segments: Array<{
    offsetInText: number; // where this segment starts within `text`
    physicalLine: number; // 0-based
    physicalChar: number; // 0-based char in the physical line where segment starts
    length: number;
  }>;
}

// Join Vim line continuations: a physical line whose first non-blank char is
// `\` continues the previous logical line. We keep a mapping so offsets in the
// joined text can be translated back to physical (line, char) positions.
export function buildLogicalLines(lines: string[]): LogicalLine[] {
  const result: LogicalLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const contMatch = /^\s*\\/.exec(raw);
    if (contMatch && result.length > 0) {
      // Append (without the leading backslash) to the previous logical line.
      const prev = result[result.length - 1];
      const contentStart = contMatch[0].length; // chars up to and incl. '\'
      const piece = raw.slice(contentStart);
      // Separate with a single space so tokens don't glue together.
      prev.segments.push({
        offsetInText: prev.text.length + 1,
        physicalLine: i,
        physicalChar: contentStart,
        length: piece.length,
      });
      prev.text += ' ' + piece;
    } else {
      result.push({
        text: raw,
        segments: [{ offsetInText: 0, physicalLine: i, physicalChar: 0, length: raw.length }],
      });
    }
  }
  return result;
}

// Translate an offset within a logical line's joined text into a physical
// (line, character) position.
function mapOffset(ll: LogicalLine, offset: number): { line: number; character: number } {
  let seg = ll.segments[0];
  for (const s of ll.segments) {
    if (offset >= s.offsetInText) {
      seg = s;
    } else {
      break;
    }
  }
  const delta = offset - seg.offsetInText;
  return { line: seg.physicalLine, character: seg.physicalChar + delta };
}

function spanFor(ll: LogicalLine, offset: number, length: number): Span {
  const start = mapOffset(ll, offset);
  const end = mapOffset(ll, offset + length);
  return {
    startLine: start.line,
    startCharacter: start.character,
    endLine: end.line,
    endCharacter: end.character,
  };
}

export function parseSyntaxGroups(text: string): SyntaxGroups {
  const lines = text.split(/\r?\n/);
  const logicalLines = buildLogicalLines(lines);
  const definitions: SyntaxGroupDefinition[] = [];
  const references: SyntaxGroupReference[] = [];

  for (const ll of logicalLines) {
    // --- definitions ---
    const def = DEFINITION_RE.exec(ll.text);
    if (def) {
      const kind = def[1] as SyntaxGroupKind;
      const name = def[3];
      if (!RESERVED.has(name)) {
        // offset of the name within ll.text: after the matched prefix minus name length.
        const nameOffset = def[0].length - name.length;
        definitions.push({ name, kind, nameSpan: spanFor(ll, nameOffset, name.length) });
      }
    }

    // --- references ---
    REFERENCE_KEY_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = REFERENCE_KEY_RE.exec(ll.text)) !== null) {
      const via = m[1];
      const listText = m[2];
      // offset where the value list starts within ll.text.
      const listOffset = m.index + m[1].length + 1; // + '='
      // Split on commas, tracking each item's offset.
      let cursor = 0;
      for (const rawItem of listText.split(',')) {
        const itemOffset = listOffset + cursor;
        cursor += rawItem.length + 1; // + comma
        let item = rawItem;
        let at = 0;
        if (item.startsWith('@')) {
          at = 1;
          item = item.slice(1);
        }
        // A group-name token here is an identifier optionally followed by Vim
        // pattern wildcards (`.`, `*`), e.g. `foo`, `foo.*`, `vimFunc\w*`.
        // Capture the whole token so wildcard references can be expanded later.
        const tokMatch = /^[A-Za-z][A-Za-z0-9_]*(?:[.*\\][A-Za-z0-9_.*\\]*)?/.exec(item);
        if (!tokMatch) {
          continue;
        }
        const token = tokMatch[0];
        const isWildcard = token.includes('*');
        // Reserved words (ALL/ALLBUT/...) are not groups. They never contain a
        // wildcard, so only check the plain-identifier case.
        if (!isWildcard && RESERVED.has(token)) {
          continue;
        }
        references.push({
          name: token,
          via,
          isWildcard,
          nameSpan: spanFor(ll, itemOffset + at, token.length),
        });
      }
    }
  }

  return { definitions, references };
}

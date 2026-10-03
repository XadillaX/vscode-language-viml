// VS Code providers that surface Vim :syntax groups (issue #69). They wrap the
// pure parser in syntaxGroups.ts and register alongside the vim-language-server
// client, so syntax-group symbols/jumps are merged with the server's function
// and variable symbols rather than replacing them.

import {
  CancellationToken,
  DefinitionProvider,
  Definition,
  DocumentSymbol,
  DocumentSymbolProvider,
  Location,
  Position,
  Range,
  ReferenceContext,
  ReferenceProvider,
  SymbolKind,
  TextDocument,
  Uri,
} from 'vscode';
import {
  parseSyntaxGroups,
  Span,
  SyntaxGroupKind,
  SyntaxGroups,
} from './syntaxGroups';

function spanToRange(span: Span): Range {
  return new Range(
    new Position(span.startLine, span.startCharacter),
    new Position(span.endLine, span.endCharacter)
  );
}

function kindToSymbolKind(kind: SyntaxGroupKind): SymbolKind {
  // cluster is a grouping of groups -> Namespace; the rest are leaf groups.
  return kind === 'cluster' ? SymbolKind.Namespace : SymbolKind.Field;
}

// Parse once per (uri, version) so repeated provider calls on an unchanged
// document are cheap.
const cache = new Map<string, { version: number; groups: SyntaxGroups }>();

function getGroups(document: TextDocument): SyntaxGroups {
  const key = document.uri.toString();
  const cached = cache.get(key);
  if (cached && cached.version === document.version) {
    return cached.groups;
  }
  const groups = parseSyntaxGroups(document.getText());
  cache.set(key, { version: document.version, groups });
  return groups;
}

// Find the reference name token under `position`, if any.
function referenceAt(groups: SyntaxGroups, position: Position): string | undefined {
  for (const ref of groups.references) {
    if (spanToRange(ref.nameSpan).contains(position)) {
      return ref.name;
    }
  }
  return undefined;
}

export class SyntaxGroupSymbolProvider implements DocumentSymbolProvider {
  public provideDocumentSymbols(
    document: TextDocument,
    _token: CancellationToken
  ): DocumentSymbol[] {
    const { definitions } = getGroups(document);
    return definitions.map(def => {
      const range = spanToRange(def.nameSpan);
      return new DocumentSymbol(
        def.name,
        `syntax ${def.kind}`,
        kindToSymbolKind(def.kind),
        range,
        range
      );
    });
  }
}

export class SyntaxGroupDefinitionProvider implements DefinitionProvider {
  public provideDefinition(
    document: TextDocument,
    position: Position,
    _token: CancellationToken
  ): Definition | undefined {
    const groups = getGroups(document);
    const name = referenceAt(groups, position);
    if (!name) {
      return undefined;
    }
    const locations: Location[] = groups.definitions
      .filter(def => def.name === name)
      .map(def => new Location(document.uri, spanToRange(def.nameSpan)));
    return locations.length > 0 ? locations : undefined;
  }
}

export class SyntaxGroupReferenceProvider implements ReferenceProvider {
  public provideReferences(
    document: TextDocument,
    position: Position,
    context: ReferenceContext,
    _token: CancellationToken
  ): Location[] {
    const groups = getGroups(document);
    // Resolve the group name under the cursor: either a definition name or a
    // reference token.
    let name: string | undefined = referenceAt(groups, position);
    if (!name) {
      const def = groups.definitions.find(d =>
        spanToRange(d.nameSpan).contains(position)
      );
      name = def?.name;
    }
    if (!name) {
      return [];
    }
    const locations: Location[] = [];
    for (const ref of groups.references) {
      if (ref.name === name) {
        locations.push(new Location(document.uri, spanToRange(ref.nameSpan)));
      }
    }
    if (context.includeDeclaration) {
      for (const def of groups.definitions) {
        if (def.name === name) {
          locations.push(new Location(document.uri, spanToRange(def.nameSpan)));
        }
      }
    }
    return locations;
  }
}

// Exposed for testing: drop a document's cached parse (not needed in normal
// use since version checks handle invalidation).
export function _clearCache(uri?: Uri): void {
  if (uri) {
    cache.delete(uri.toString());
  } else {
    cache.clear();
  }
}

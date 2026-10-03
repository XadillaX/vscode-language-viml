// VS Code providers that surface Vim :syntax groups (issue #69). They wrap the
// pure parser in syntaxGroups.ts and a workspace-wide index (syntaxIndex.ts),
// and register alongside the vim-language-server client, so syntax-group
// symbols/jumps are merged with the server's function/variable symbols rather
// than replacing them.

import {
  CancellationToken,
  DefinitionProvider,
  Definition,
  DocumentSymbol,
  DocumentSymbolProvider,
  Location,
  Position,
  ProviderResult,
  Range,
  ReferenceContext,
  ReferenceProvider,
  SymbolInformation,
  SymbolKind,
  TextDocument,
  Uri,
  workspace,
  WorkspaceSymbolProvider,
} from 'vscode';
import {
  parseSyntaxGroups,
  Span,
  SyntaxGroupKind,
  SyntaxGroupReference,
  SyntaxGroups,
  wildcardToRegExp,
} from './syntaxGroups';
import { SyntaxGroupIndex } from './syntaxIndex';

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

// Find the reference token under `position`, if any.
function referenceAt(
  groups: SyntaxGroups,
  position: Position
): SyntaxGroupReference | undefined {
  for (const ref of groups.references) {
    if (spanToRange(ref.nameSpan).contains(position)) {
      return ref;
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
  constructor(private readonly index: SyntaxGroupIndex) {}

  public provideDefinition(
    document: TextDocument,
    position: Position,
    _token: CancellationToken
  ): Definition | undefined {
    const groups = getGroups(document);
    const ref = referenceAt(groups, position);
    if (!ref) {
      return undefined;
    }
    // Make sure the current document's own definitions are up to date (handles
    // unsaved edits) before resolving against the workspace index.
    this.index.updateFromDocument(document);
    const locations = this.index.resolve(ref.name, ref.isWildcard);
    return locations.length > 0 ? locations : undefined;
  }
}

export class SyntaxGroupReferenceProvider implements ReferenceProvider {
  constructor(private readonly index: SyntaxGroupIndex) {}

  public async provideReferences(
    document: TextDocument,
    position: Position,
    context: ReferenceContext,
    _token: CancellationToken
  ): Promise<Location[]> {
    const groups = getGroups(document);
    // Resolve the group name under the cursor: a reference token (ignore
    // wildcard tokens here) or a definition name.
    let name: string | undefined;
    const ref = referenceAt(groups, position);
    if (ref && !ref.isWildcard) {
      name = ref.name;
    }
    if (!name) {
      const def = groups.definitions.find(d =>
        spanToRange(d.nameSpan).contains(position)
      );
      name = def?.name;
    }
    if (!name) {
      return [];
    }

    // Scan every .vim file in the workspace for references to `name`
    // (including wildcard references that match it).
    const files = await workspace.findFiles('**/*.vim', '**/node_modules/**');
    const out: Location[] = [];
    for (const uri of files) {
      const text = await readText(uri);
      if (text === undefined) {
        continue;
      }
      const g = parseSyntaxGroups(text);
      for (const r of g.references) {
        if (referenceMatches(r, name)) {
          out.push(new Location(uri, spanToRange(r.nameSpan)));
        }
      }
      if (context.includeDeclaration) {
        for (const d of g.definitions) {
          if (d.name === name) {
            out.push(new Location(uri, spanToRange(d.nameSpan)));
          }
        }
      }
    }
    return out;
  }
}

export class SyntaxGroupWorkspaceSymbolProvider
implements WorkspaceSymbolProvider {
  constructor(private readonly index: SyntaxGroupIndex) {}

  public provideWorkspaceSymbols(
    query: string,
    _token: CancellationToken
  ): ProviderResult<SymbolInformation[]> {
    const q = query.toLowerCase();
    return this.index.allDefinitions()
      .filter(({ def }) => q === '' || def.name.toLowerCase().includes(q))
      .map(({ uri, def }) => new SymbolInformation(
        def.name,
        kindToSymbolKind(def.kind),
        `syntax ${def.kind}`,
        new Location(uri, spanToRange(def.nameSpan))
      ));
  }
}

function referenceMatches(ref: SyntaxGroupReference, name: string): boolean {
  if (!ref.isWildcard) {
    return ref.name === name;
  }
  // A wildcard reference matches `name` if its pattern does.
  const re = wildcardToRegExp(ref.name);
  return re ? re.test(name) : false;
}

async function readText(uri: Uri): Promise<string | undefined> {
  const open = workspace.textDocuments.find(
    d => d.uri.toString() === uri.toString()
  );
  if (open) {
    return open.getText();
  }
  try {
    const bytes = await workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return undefined;
  }
}

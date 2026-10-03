// Workspace-wide index of Vim :syntax group definitions (issue #69, v2).
//
// v1 resolved syntax groups within a single document. Real syntax plugins
// split definitions across many files (and reference them with wildcards like
// `contains=foo.*`), so this builds and maintains a workspace-wide index of
// group definitions keyed by name, and resolves references (including
// wildcards) against it.

import {
  Disposable,
  Location,
  Position,
  Range,
  TextDocument,
  Uri,
  workspace,
} from 'vscode';
import {
  parseSyntaxGroups,
  Span,
  SyntaxGroupDefinition,
  wildcardToRegExp,
} from './syntaxGroups';

function spanToRange(span: Span): Range {
  return new Range(
    new Position(span.startLine, span.startCharacter),
    new Position(span.endLine, span.endCharacter)
  );
}

interface IndexedDefinition {
  uri: Uri;
  def: SyntaxGroupDefinition;
}

export class SyntaxGroupIndex {
  // All definitions found in a given file (keyed by uri string).
  private byFile = new Map<string, IndexedDefinition[]>();
  // name -> definitions across the whole workspace.
  private byName = new Map<string, IndexedDefinition[]>();
  private watcher: Disposable | undefined;
  private ready: Promise<void> | undefined;

  // Scan the workspace and start watching for changes. Safe to call once.
  public initialize(): Promise<void> {
    if (this.ready) {
      return this.ready;
    }
    this.ready = (async () => {
      const files = await workspace.findFiles('**/*.vim', '**/node_modules/**');
      await Promise.all(files.map(uri => this.indexFile(uri)));
      this.installWatcher();
    })();
    return this.ready;
  }

  public dispose(): void {
    this.watcher?.dispose();
    this.watcher = undefined;
    this.byFile.clear();
    this.byName.clear();
    this.ready = undefined;
  }

  private installWatcher(): void {
    const w = workspace.createFileSystemWatcher('**/*.vim');
    const reindex = (uri: Uri) => {
      void this.indexFile(uri);
    };
    this.watcher = Disposable.from(
      w,
      w.onDidCreate(reindex),
      w.onDidChange(reindex),
      w.onDidDelete(uri => this.removeFile(uri))
    );
  }

  // Re-parse a single file and refresh its entries in the index. Prefers the
  // in-memory document (unsaved edits) over the on-disk bytes.
  public async indexFile(uri: Uri): Promise<void> {
    let text: string;
    const open = workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
    if (open) {
      text = open.getText();
    } else {
      try {
        const bytes = await workspace.fs.readFile(uri);
        text = Buffer.from(bytes).toString('utf8');
      } catch {
        this.removeFile(uri);
        return;
      }
    }
    this.setFileDefinitions(
      uri,
      parseSyntaxGroups(text).definitions.map(def => ({ uri, def }))
    );
  }

  // Update the index from an already-parsed, in-memory document. Used so the
  // providers reflect live edits immediately without waiting for a save.
  public updateFromDocument(document: TextDocument): void {
    this.setFileDefinitions(
      document.uri,
      parseSyntaxGroups(document.getText()).definitions.map(def => ({
        uri: document.uri,
        def,
      }))
    );
  }

  private setFileDefinitions(uri: Uri, defs: IndexedDefinition[]): void {
    this.removeFile(uri);
    this.byFile.set(uri.toString(), defs);
    for (const entry of defs) {
      const list = this.byName.get(entry.def.name) ?? [];
      list.push(entry);
      this.byName.set(entry.def.name, list);
    }
  }

  private removeFile(uri: Uri): void {
    const key = uri.toString();
    const existing = this.byFile.get(key);
    if (!existing) {
      return;
    }
    this.byFile.delete(key);
    for (const entry of existing) {
      const list = this.byName.get(entry.def.name);
      if (!list) {
        continue;
      }
      const filtered = list.filter(e => e !== entry);
      if (filtered.length > 0) {
        this.byName.set(entry.def.name, filtered);
      } else {
        this.byName.delete(entry.def.name);
      }
    }
  }

  // Resolve a reference to definition locations across the workspace. When
  // `isWildcard` is set, `name` is a Vim group-name pattern (e.g. `foo.*`) and
  // every matching group's definitions are returned.
  public resolve(name: string, isWildcard: boolean): Location[] {
    const out: Location[] = [];
    if (isWildcard) {
      const re = wildcardToRegExp(name);
      if (!re) {
        return out;
      }
      for (const [defName, entries] of this.byName) {
        if (re.test(defName)) {
          for (const e of entries) {
            out.push(new Location(e.uri, spanToRange(e.def.nameSpan)));
          }
        }
      }
      return out;
    }
    for (const e of this.byName.get(name) ?? []) {
      out.push(new Location(e.uri, spanToRange(e.def.nameSpan)));
    }
    return out;
  }

  // All indexed definitions (for workspace symbols).
  public allDefinitions(): IndexedDefinition[] {
    const out: IndexedDefinition[] = [];
    for (const defs of this.byFile.values()) {
      out.push(...defs);
    }
    return out;
  }
}

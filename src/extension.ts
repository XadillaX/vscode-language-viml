import {
  ExtensionContext,
  languages,
  OutputChannel,
  TextEditor,
  TextEditorOptionsChangeEvent,
  window,
  WindowState,
  workspace,
} from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import {
  SyntaxGroupDefinitionProvider,
  SyntaxGroupReferenceProvider,
  SyntaxGroupSymbolProvider,
  SyntaxGroupWorkspaceSymbolProvider,
} from './syntaxGroupProviders';
import { SyntaxGroupIndex } from './syntaxIndex';

const VIML_SELECTOR = { scheme: 'file', language: 'viml' };

const VIM_MODELINE = /(?:(?:^|[ \t])(?:vi|Vi(?=m))(?:m[<=>]?[0-9]+|m)?|[ \t]ex)(?=:(?=[ \t]*set?[ \t][^\r\n:]+:)|:(?![ \t]*set?[ \t]))(?:(?:[ \t]*:[ \t]*|[ \t])\w*(?:[ \t]*=(?:[^\\\s]|\\.)*)?)*[ \t:](?:filetype|ft|syntax)[ \t]*=(\w+)(?=$|\s|:)/mi;

let client: LanguageClient | undefined;
let outputChannel: OutputChannel;

function startVimLLanguageServer() {
  outputChannel.append('Start VimL Language Server.\n');
  const serverModule = require.resolve('vim-language-server');
  const debugOptions = { execArgv: [ '--nolazy', '--inspect=6009' ] };
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'viml' }],
  };

  client = new LanguageClient(
    'VimLLanguageServer',
    'VimL Language Server',
    serverOptions,
    clientOptions);

  client.start();
}

function startVimLLanguageServerWhenVimLFile() {
  if (window.activeTextEditor &&
      window.activeTextEditor.document &&
      window.activeTextEditor.document.languageId === 'viml') {
    startVimLLanguageServer();
    return;
  }

  window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
    if (client) return;
    if (!editor || !editor.document || editor.document.languageId !== 'viml') {
      return;
    }
    startVimLLanguageServer();
  });

  window.onDidChangeWindowState((e: WindowState) => {
    if (client) return;
    if (!e.focused) return;
    if (window.activeTextEditor &&
        window.activeTextEditor.document &&
        window.activeTextEditor.document.languageId === 'viml') {
      startVimLLanguageServer();
    }
  });
}

function tryApplyVimHelpEditorOption(
  editor: TextEditor,
  dependsOnHighPriorityConfig = false) {
  if (!editor) return;
  if (dependsOnHighPriorityConfig) {
    const config = workspace.getConfiguration('viml');
    const highPriority = config.get<boolean>('highVimHelpIndentStylePriority');
    if (!highPriority) {
      outputChannel.append(
        'viml.highVimHelpIndentStylePriority is false, ignore.\n');
      return;
    }

    outputChannel.append(
      'viml.highVimHelpIndentStylePriority is true, force indentation.\n');
  }

  outputChannel.append(`Set ${editor.document.fileName}'s indentation\n`);

  editor.options = {
    tabSize: 8,
    insertSpaces: false,
  };
}

function detectIfVimHelp(editor: TextEditor) {
  const document = editor.document;
  // Refer to https://github.com/Alhadis/language-viml/blob/769b532/index.js
  if (/\.txt$/i.test(document.fileName) &&
      VIM_MODELINE.test(document.getText()) &&
      RegExp.lastParen === 'help') {
    outputChannel.append(`vim-help detected on ${document.fileName}.\n`);
    languages.setTextDocumentLanguage(document, 'vim-help');
    tryApplyVimHelpEditorOption(editor, true);
  }
}

function startVimHelpLogic() {
  if (window.activeTextEditor && window.activeTextEditor.document) {
    if (window.activeTextEditor.document.languageId === 'vim-help') {
      tryApplyVimHelpEditorOption(window.activeTextEditor, true);
    } else if (![
      'viml',
      'vim-snippet',
    ].includes(window.activeTextEditor.document.languageId)) {
      detectIfVimHelp(window.activeTextEditor);
    }
  }

  window.onDidChangeTextEditorOptions(
    // For EditorConfig
    async (e: TextEditorOptionsChangeEvent) => {
      if (e.textEditor &&
          e.textEditor.document &&
          e.textEditor.document.languageId === 'vim-help') {
        if (e.options.tabSize !== 8 || e.options.insertSpaces) {
          tryApplyVimHelpEditorOption(e.textEditor, true);
        }
      }
    });

  window.onDidChangeActiveTextEditor(async (editor: TextEditor | undefined) => {
    if (editor && editor.document) {
      if (editor.document.languageId === 'vim-help') {
        tryApplyVimHelpEditorOption(editor);
      } else {
        detectIfVimHelp(editor);
      }
    }
  });

  window.onDidChangeWindowState(async (state: WindowState) => {
    const editor: TextEditor | undefined = window.activeTextEditor;
    if (state.focused && editor && editor.document) {
      if (editor.document.languageId === 'vim-help') {
        tryApplyVimHelpEditorOption(editor);
      } else {
        detectIfVimHelp(editor);
      }
    }
  });
}

export function activate(context: ExtensionContext) {
  outputChannel = window.createOutputChannel('VimL');
  startVimLLanguageServerWhenVimLFile();
  startVimHelpLogic();

  // Syntax-group symbols/jumps (issue #69). These register alongside the
  // language client, so VS Code merges their results with the server's
  // function/variable symbols. A workspace-wide index backs cross-file
  // definition/reference resolution (including `contains=foo.*` wildcards).
  const syntaxIndex = new SyntaxGroupIndex();
  void syntaxIndex.initialize();
  context.subscriptions.push(
    syntaxIndex,
    languages.registerDocumentSymbolProvider(
      VIML_SELECTOR, new SyntaxGroupSymbolProvider()),
    languages.registerWorkspaceSymbolProvider(
      new SyntaxGroupWorkspaceSymbolProvider(syntaxIndex)),
    languages.registerDefinitionProvider(
      VIML_SELECTOR, new SyntaxGroupDefinitionProvider(syntaxIndex)),
    languages.registerReferenceProvider(
      VIML_SELECTOR, new SyntaxGroupReferenceProvider(syntaxIndex)));
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return;
  const old: LanguageClient = client;
  client = undefined;
  return old.stop();
}

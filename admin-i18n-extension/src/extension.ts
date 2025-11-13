import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { loadAllTranslations, TranslationMap } from './csvParser';
import { TranslationDecorationProvider } from './decorationProvider';
import { TranslationEditor } from './translationEditor';

let decorationProvider: TranslationDecorationProvider;
let translationEditor: TranslationEditor;
let fileWatcher: vscode.FileSystemWatcher | undefined;
let fullLocalesPath: string;

export function activate(context: vscode.ExtensionContext) {
  console.log('Admin i18n Helper extension is now active');

  // Get workspace folder
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showWarningMessage('Admin i18n Helper: No workspace folder found');
    return;
  }

  // Get configuration
  const config = vscode.workspace.getConfiguration('adminI18nHelper');
  const adminPath = config.get<string>('adminPath', 'admin');
  const localesPath = config.get<string>('localesPath', 'locales');
  const displayLanguage = config.get<string>('displayLanguage', 'ko');

  // Construct the full locales path
  fullLocalesPath = path.join(workspaceFolder.uri.fsPath, adminPath, localesPath);

  // Check if locales directory exists
  if (!fs.existsSync(fullLocalesPath)) {
    vscode.window.showWarningMessage(
      `Admin i18n Helper: Locales directory not found at ${fullLocalesPath}`
    );
    return;
  }

  // Load translations
  let translations: TranslationMap = loadAllTranslations(fullLocalesPath);
  console.log(`Loaded ${Object.keys(translations).length} translations`);

  // Create decoration provider with language setting
  decorationProvider = new TranslationDecorationProvider(translations, displayLanguage);

  // Create translation editor
  translationEditor = new TranslationEditor(translations, fullLocalesPath);

  // Update decorations for the active editor
  const updateActiveEditor = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      decorationProvider.updateDecorations(editor);
    }
  };

  // Initial update
  updateActiveEditor();

  // Update decorations when active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        decorationProvider.updateDecorations(editor);
      }
    })
  );

  // Update decorations when document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        // Debounce updates
        setTimeout(() => {
          decorationProvider.updateDecorations(editor);
        }, 100);
      }
    })
  );

  // Update decorations when cursor position changes
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      const editor = event.textEditor;
      if (editor && event.selections.length === 1) {
        const selection = event.selections[0];
        // Only handle single cursor position (not selections)
        if (selection.isEmpty) {
          decorationProvider.updateCursorPosition(editor, selection.active);
        }
      }
    })
  );

  // Clean up positions when document is closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      decorationProvider.clearPositions(document.uri.toString());
    })
  );

  // Watch for changes in CSV files
  const csvPattern = new vscode.RelativePattern(fullLocalesPath, '*.csv');
  fileWatcher = vscode.workspace.createFileSystemWatcher(csvPattern);

  // Reload translations when CSV files change
  const reloadTranslations = () => {
    translations = loadAllTranslations(fullLocalesPath);
    decorationProvider.updateTranslations(translations);
    translationEditor.updateTranslations(translations);
    console.log(`Reloaded ${Object.keys(translations).length} translations`);
    updateActiveEditor();
    vscode.window.showInformationMessage('Admin i18n Helper: Translations reloaded');
  };

  fileWatcher.onDidChange(reloadTranslations);
  fileWatcher.onDidCreate(reloadTranslations);
  fileWatcher.onDidDelete(reloadTranslations);

  context.subscriptions.push(fileWatcher);

  // Register command to manually reload translations
  const reloadCommand = vscode.commands.registerCommand(
    'adminI18nHelper.reloadTranslations',
    () => {
      reloadTranslations();
    }
  );

  context.subscriptions.push(reloadCommand);

  // Register command to open CSV file at translation key
  const openCsvFileCommand = vscode.commands.registerCommand(
    'adminI18nHelper.openCsvFile',
    async (args) => {
      // args can be either a string or already parsed object
      const parsedArgs = typeof args === 'string' ? JSON.parse(decodeURIComponent(args)) : args;
      const { key } = parsedArgs;

      // Extract namespace from key (e.g., "sequences.toast.noSequencesSelected" -> "sequences")
      const parts = key.split('.');
      const namespace = parts[0];
      const actualKey = parts.slice(1).join('.');

      // Construct CSV file path
      const csvFilePath = path.join(fullLocalesPath, `${namespace}.csv`);

      if (!fs.existsSync(csvFilePath)) {
        vscode.window.showErrorMessage(`CSV 파일을 찾을 수 없습니다: ${csvFilePath}`);
        return;
      }

      try {
        // Open the CSV file
        const document = await vscode.workspace.openTextDocument(csvFilePath);
        const editor = await vscode.window.showTextDocument(document);

        // Find the line with the key
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith(`${actualKey},`)) {
            // Move cursor to this line
            const position = new vscode.Position(i, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            break;
          }
        }

        vscode.window.showInformationMessage(`CSV 파일로 이동: ${namespace}.csv`);
      } catch (error) {
        vscode.window.showErrorMessage(`CSV 파일 열기 실패: ${error}`);
      }
    }
  );

  context.subscriptions.push(openCsvFileCommand);

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('adminI18nHelper.displayLanguage')) {
        const newConfig = vscode.workspace.getConfiguration('adminI18nHelper');
        const newLanguage = newConfig.get<string>('displayLanguage', 'ko');
        decorationProvider.updateLanguage(newLanguage);
        updateActiveEditor();
        vscode.window.showInformationMessage(
          `Admin i18n Helper: Language changed to ${newLanguage === 'ko' ? '한국어' : 'English'}`
        );
      }
    })
  );

  vscode.window.showInformationMessage(
    `Admin i18n Helper: Loaded ${Object.keys(translations).length} translations from ${fullLocalesPath}`
  );
}

export function deactivate() {
  if (fileWatcher) {
    fileWatcher.dispose();
  }
  if (decorationProvider) {
    decorationProvider.dispose();
  }
}

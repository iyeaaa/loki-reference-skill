import * as vscode from 'vscode';
import { TranslationMap, extractTranslationKey } from './csvParser';

export class TranslationHoverProvider implements vscode.HoverProvider {
  constructor(private translations: TranslationMap) {}

  updateTranslations(translations: TranslationMap) {
    this.translations = translations;
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    // Get the range of the word at the cursor position
    const range = document.getWordRangeAtPosition(position, /t\s*\(\s*["'][^"']+["']\s*\)/);

    if (!range) {
      return null;
    }

    // Get the text in the range
    const text = document.getText(range);

    // Extract the translation key
    const key = extractTranslationKey(text);

    if (!key) {
      return null;
    }

    // Look up the translation
    const translation = this.translations[key];

    if (!translation) {
      return new vscode.Hover(
        new vscode.MarkdownString(`**Translation not found**\n\nKey: \`${key}\``)
      );
    }

    // Create hover content with both Korean and English translations
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.appendMarkdown(`**Translation:** \`${key}\`\n\n`);
    markdown.appendMarkdown(`**한국어 (ko):** ${translation.ko}\n\n`);
    markdown.appendMarkdown(`**English (en):** ${translation.en}\n\n`);
    markdown.appendCodeblock(`t("${translation.ko}")`, 'typescript');

    return new vscode.Hover(markdown, range);
  }
}

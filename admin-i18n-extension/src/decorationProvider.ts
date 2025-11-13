import * as vscode from 'vscode';
import type { TranslationMap } from './csvParser';

interface TranslationPosition {
  range: vscode.Range;
  key: string;
  translatedText: string;
  originalText: string;
}

export class TranslationDecorationProvider {
  private hideDecorationType: vscode.TextEditorDecorationType;
  private showDecorationType: vscode.TextEditorDecorationType;
  private originalDecorationType: vscode.TextEditorDecorationType;
  private translations: TranslationMap;
  private language: string;
  private translationPositions: Map<string, TranslationPosition[]> = new Map();
  private currentCursorPosition: vscode.Position | null = null;

  constructor(translations: TranslationMap, language: string = 'ko') {
    this.translations = translations;
    this.language = language;

    // Decoration to hide original text completely
    this.hideDecorationType = vscode.window.createTextEditorDecorationType({
      letterSpacing: '-1000px',
      opacity: '0',
      color: 'transparent',
    });

    // Decoration to show replacement text
    this.showDecorationType = vscode.window.createTextEditorDecorationType({});

    // Decoration for original text (when cursor is inside)
    this.originalDecorationType = vscode.window.createTextEditorDecorationType({});
  }

  updateTranslations(translations: TranslationMap) {
    this.translations = translations;
  }

  updateLanguage(language: string) {
    this.language = language;
  }

  /**
   * Update cursor position and refresh decorations
   */
  updateCursorPosition(editor: vscode.TextEditor, position: vscode.Position) {
    this.currentCursorPosition = position;
    this.updateDecorations(editor);
  }

  /**
   * Check if cursor is inside any translation range
   */
  private isCursorInsideTranslation(position: vscode.Position, positions: TranslationPosition[]): TranslationPosition | null {
    if (!position) {
      return null;
    }

    for (const pos of positions) {
      if (pos.range.contains(position)) {
        return pos;
      }
    }
    return null;
  }

  /**
   * Update decorations for the active editor
   */
  updateDecorations(editor: vscode.TextEditor | undefined) {
    if (!editor) {
      return;
    }

    const document = editor.document;
    const text = document.getText();
    const docKey = document.uri.toString();
    const hideDecorations: vscode.DecorationOptions[] = [];
    const showDecorations: vscode.DecorationOptions[] = [];
    const originalDecorations: vscode.DecorationOptions[] = [];

    const newPositions: TranslationPosition[] = [];

    // Find all t() function calls
    const regex = /t\s*\(\s*["']([^"']+)["']\s*\)/g;
    let match: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: Regex exec in loop pattern
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const key = match[1];
      const translation = this.translations[key];
      const translatedText = this.language === 'ko' ? translation?.ko : translation?.en;

      if (translatedText) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + fullMatch.length);
        const range = new vscode.Range(startPos, endPos);

        newPositions.push({
          range,
          key,
          translatedText,
          originalText: fullMatch,
        });
      }
    }

    // Update stored positions
    this.translationPositions.set(docKey, newPositions);

    // Check which translation the cursor is inside
    const cursorInsideTranslation = this.currentCursorPosition
      ? this.isCursorInsideTranslation(this.currentCursorPosition, newPositions)
      : null;

    // Apply decorations
    for (const pos of newPositions) {
      const currentTranslation = this.translations[pos.key];

      // If cursor is inside this translation, show original key with hover
      if (cursorInsideTranslation && pos.range.isEqual(cursorInsideTranslation.range)) {
        // Add hover to original text
        originalDecorations.push({
          range: pos.range,
          hoverMessage: this.createHoverMessage(pos.key, currentTranslation),
        });
      } else {
        // Show translation
        hideDecorations.push({ range: pos.range });

        showDecorations.push({
          range: pos.range,
          renderOptions: {
            before: {
              contentText: `t("${pos.translatedText}")`,
              color: '#4EC9B0',
              fontWeight: 'bold',
              margin: '0 0 0 0',
            },
          },
          hoverMessage: this.createHoverMessage(pos.key, currentTranslation),
        });
      }
    }

    editor.setDecorations(this.hideDecorationType, hideDecorations);
    editor.setDecorations(this.showDecorationType, showDecorations);
    editor.setDecorations(this.originalDecorationType, originalDecorations);
  }

  /**
   * Create hover message with translation info and CSV link
   */
  private createHoverMessage(
    key: string,
    translation: { key: string; ko: string; en: string } | undefined
  ): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    if (!translation) {
      markdown.appendMarkdown(`**Key:** \`${key}\`\n\n`);
      markdown.appendMarkdown(`⚠️ 번역을 찾을 수 없습니다`);
      return markdown;
    }

    markdown.appendMarkdown(`### 번역 정보\n\n`);
    markdown.appendMarkdown(`**Key:** \`${key}\`\n\n`);
    markdown.appendMarkdown(`**한국어 (ko):** ${translation.ko}\n\n`);
    markdown.appendMarkdown(`**English (en):** ${translation.en}\n\n`);
    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(
      `[📄 CSV 파일로 이동](command:adminI18nHelper.openCsvFile?${encodeURIComponent(
        JSON.stringify({ key })
      )})\n\n`
    );

    return markdown;
  }

  /**
   * Clear positions when document is closed
   */
  clearPositions(documentUri: string) {
    this.translationPositions.delete(documentUri);
  }

  dispose() {
    this.hideDecorationType.dispose();
    this.showDecorationType.dispose();
    this.originalDecorationType.dispose();
    this.translationPositions.clear();
  }
}

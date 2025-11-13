import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TranslationMap } from './csvParser';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export class TranslationEditor {
  constructor(
    private translations: TranslationMap,
    private localesPath: string
  ) {}

  updateTranslations(translations: TranslationMap) {
    this.translations = translations;
  }

  /**
   * Show original translation key
   */
  async showOriginalKey(key: string) {
    const translation = this.translations[key];

    if (!translation) {
      vscode.window.showWarningMessage(`번역을 찾을 수 없습니다: ${key}`);
      return;
    }

    const message = `원본 키: ${key}\n\n한국어: ${translation.ko}\n영어: ${translation.en}`;

    const action = await vscode.window.showInformationMessage(
      message,
      '클립보드에 복사',
      '번역 수정'
    );

    if (action === '클립보드에 복사') {
      await vscode.env.clipboard.writeText(key);
      vscode.window.showInformationMessage('클립보드에 복사되었습니다');
    } else if (action === '번역 수정') {
      await this.editTranslation(key);
    }
  }

  /**
   * Edit translation
   */
  async editTranslation(key: string) {
    const translation = this.translations[key];

    if (!translation) {
      vscode.window.showWarningMessage(`번역을 찾을 수 없습니다: ${key}`);
      return;
    }

    // Extract namespace and actual key
    const parts = key.split('.');
    const namespace = parts[0];
    const actualKey = parts.slice(1).join('.');

    // Show quick pick for language selection
    const language = await vscode.window.showQuickPick(['한국어 (ko)', 'English (en)'], {
      placeHolder: '수정할 언어를 선택하세요',
    });

    if (!language) {
      return;
    }

    const lang = language.includes('ko') ? 'ko' : 'en';
    const currentValue = translation[lang];

    // Show input box for new translation
    const newValue = await vscode.window.showInputBox({
      prompt: `${language} 번역을 입력하세요`,
      value: currentValue,
      placeHolder: currentValue,
    });

    if (newValue === undefined || newValue === currentValue) {
      return;
    }

    // Update CSV file
    const csvFilePath = path.join(this.localesPath, `${namespace}.csv`);

    if (!fs.existsSync(csvFilePath)) {
      vscode.window.showErrorMessage(`CSV 파일을 찾을 수 없습니다: ${csvFilePath}`);
      return;
    }

    try {
      // Read CSV file
      const content = fs.readFileSync(csvFilePath, 'utf-8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      // Update the translation
      let found = false;
      for (const record of records) {
        if (record.key === actualKey) {
          record[lang] = newValue;
          found = true;
          break;
        }
      }

      if (!found) {
        vscode.window.showErrorMessage(`번역 키를 찾을 수 없습니다: ${actualKey}`);
        return;
      }

      // Write back to CSV file
      const csvContent = stringify(records, {
        header: true,
        columns: ['key', 'ko', 'en'],
      });

      fs.writeFileSync(csvFilePath, csvContent, 'utf-8');

      vscode.window.showInformationMessage(
        `번역이 수정되었습니다: ${key} (${lang})`
      );

      // Update in-memory translations
      this.translations[key][lang] = newValue;
    } catch (error) {
      vscode.window.showErrorMessage(
        `번역 수정 중 오류가 발생했습니다: ${error}`
      );
    }
  }
}

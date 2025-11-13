import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

export interface Translation {
  key: string;
  ko: string;
  en: string;
}

export interface TranslationMap {
  [key: string]: Translation;
}

/**
 * Parse a CSV file and return translations as a map
 */
export function parseCsvFile(filePath: string): TranslationMap {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Translation[];

    const translationMap: TranslationMap = {};

    for (const record of records) {
      if (record.key) {
        translationMap[record.key] = record;
      }
    }

    return translationMap;
  } catch (error) {
    console.error(`Error parsing CSV file ${filePath}:`, error);
    return {};
  }
}

/**
 * Load all CSV files from the locales directory
 */
export function loadAllTranslations(localesPath: string): TranslationMap {
  const allTranslations: TranslationMap = {};

  try {
    if (!fs.existsSync(localesPath)) {
      console.error(`Locales path does not exist: ${localesPath}`);
      return allTranslations;
    }

    const files = fs.readdirSync(localesPath);

    for (const file of files) {
      if (file.endsWith('.csv')) {
        const filePath = path.join(localesPath, file);
        const translations = parseCsvFile(filePath);

        // Extract namespace from filename (e.g., "sequences.csv" -> "sequences")
        const namespace = path.basename(file, '.csv');

        // Add translations with namespace prefix
        for (const [key, translation] of Object.entries(translations)) {
          const fullKey = `${namespace}.${key}`;
          allTranslations[fullKey] = translation;
        }
      }
    }
  } catch (error) {
    console.error('Error loading translations:', error);
  }

  return allTranslations;
}

/**
 * Extract translation key from t() function call
 * e.g., t("sequences.toast.noSequencesSelected") -> "sequences.toast.noSequencesSelected"
 */
export function extractTranslationKey(text: string): string | null {
  // Match t("key") or t('key')
  const match = text.match(/t\s*\(\s*["']([^"']+)["']\s*\)/);
  return match ? match[1] : null;
}

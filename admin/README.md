# Admin Frontend

React + TypeScript + Vite based admin frontend application.

## Translation Management (i18n)

This project uses a translation management system integrated with Google Sheets.

### Setup

1. **Create Google Service Account**
   - Create Service Account in Google Cloud Console
   - Enable Google Sheets API
   - Download Service Account JSON key

2. **Environment Variables**
   - Create `.env` file (see `.env.example`)
   - `GOOGLE_CREDENTIALS`: Service Account JSON as string
   - `GOOGLE_SHEET_ID`: Google Spreadsheet ID (extract from URL)

3. **Google Spreadsheet Setup**
   - Create a spreadsheet
   - Grant edit permission to Service Account
   - Sheet name `send-grinda` will be auto-created

4. **Auto Timestamp Setup (Optional but Recommended)**
   - Install Google Apps Script for auto-updating `lastModified` column
   - See `docs/GOOGLE_SHEETS_SETUP.md` for detailed instructions
   - Copy `scripts/google-apps-script-auto-timestamp.js` to Google Apps Script
   - This enables automatic timestamp updates when translations are edited in the sheet

### Translation Workflow

#### Working with Translations Locally

1. **Add New Translation Keys**
   ```bash
   # Use t('new.key') in source code
   yarn i18n:scan  # Automatically added to CSV
   ```

2. **Edit Translation Files**
   - Modify translations in `locales/*.csv` files
   - Each CSV file is separated by namespace

3. **Upload to Google Sheet**
   ```bash
   yarn i18n:push        # Default mode (Google Sheet content priority)
   yarn i18n:push --force # Force mode (local content priority)
   ```

4. **Download from Google Sheet**
   ```bash
   yarn i18n:pull        # Default mode (Google Sheet content priority)
   yarn i18n:pull --force # Force mode
   ```

5. **Check Sync Status**
   ```bash
   yarn i18n:check
   ```

#### Auto-Notifications

When running `yarn dev` or `yarn build`, sync status is automatically checked:
- If local changes exist: "push needed" notification
- If Google Sheet changes exist: "pull needed" notification

#### After Git Pull

When you receive CSV file changes via `git pull`:
1. Run `yarn dev` - automatic sync check will run
2. You'll see: "Translation changes detected"
3. Run `yarn i18n:pull` to ensure sync with Google Sheet
4. The `.i18n-sync.json` file (sync metadata) is tracked in Git to maintain team-wide sync state

### Adding New Languages

To add a new language:

1. Add language code to `lngs` array in `i18next-scanner.config.cjs`
   ```js
   lngs: ["ko", "en", "ja"], // Example: adding Japanese
   ```

2. Language column automatically added to CSV files
3. Automatically reflected in Google Sheet

### File Structure

```
locales/
  ├── common.csv          # Common translations
  ├── login.csv           # Login-related translations
  ├── ...                 # Other namespace CSV files
  └── .i18n-sync.json     # Sync metadata (tracked in Git)

src/i18n/
  └── generated/          # Auto-generated JSON files
      ├── ko.json
      └── en.json
```

### Important Notes

- If `GOOGLE_CREDENTIALS` is not set (e.g., CI/CD environment), sync features are automatically disabled
- During production builds, sync check runs but build continues even if it fails
- When conflicts occur, prompts guide you through resolution
- The `.i18n-sync.json` file is tracked in Git to share sync state across the team

---

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

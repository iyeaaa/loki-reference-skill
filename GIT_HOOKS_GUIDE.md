# 🎣 Git Hooks Setup Guide

## ⚡ Quick Setup (1 minute)

```bash
git pull origin main
./setup-husky-lint-ci.sh
```

✅ Done! Hooks will run automatically on commit/push.

---

## 📖 Commands

```bash
./setup-husky-lint-ci.sh          # Auto-detect and install
./setup-husky-lint-ci.sh setup    # Force install
./setup-husky-lint-ci.sh check    # Check status only
yarn setup-ci                      # Install (shortcut)
yarn check-ci                      # Check (shortcut)
```

---

## 🎯 What Hooks Do

**pre-commit** (5-10 sec)
- Auto-fix lint on changed files
- Lint check + Type check

**pre-push** (1-2 min)
- Auto-fix lint on changed files
- Full build

---

## ❓ Troubleshooting

**"permission denied"**
```bash
chmod +x .husky/pre-commit .husky/pre-push send-ci.sh setup-husky-lint-ci.sh
```

**Hooks not running**
```bash
git config core.hooksPath .husky
./setup-husky-lint-ci.sh setup
```

**Complete reinstall**
```bash
rm -rf node_modules
yarn install
./setup-husky-lint-ci.sh setup
```

**Skip hooks (emergency only)**
```bash
git commit --no-verify -m "message"
git push --no-verify
```

---

**🎉 Setup Complete!**

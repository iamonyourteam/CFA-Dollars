# Chick-fil-A Dollar Tracker

A team rewards tracking app with PIN-based login, admin/manager/employee roles, and batch dollar entry.

## Default PINs
| Role | Name | PIN |
|------|------|-----|
| Admin | Admin 1 | 9999 |
| Manager | Manager 1 | 1111 |
| Manager | Manager 2 | 2222 |
| Manager | Manager 3 | 3333 |
| Employee | (each employee) | 4001–4055 |

## Getting Started

### Install dependencies
```bash
npm install
```

### Run locally
```bash
npm run dev
```
Then open http://localhost:5173

### Deploy to GitHub Pages
1. Update `homepage` in `package.json` with your GitHub username
2. Update `base` in `vite.config.js` to match your repo name
3. Run:
```bash
npm run deploy
```

### Deploy to Netlify (easier)
```bash
npm run build
```
Then drag the `dist` folder onto netlify.com.

# Contributing to Topragh

Thanks for helping improve the Turkmen–Persian–English dictionary.

## Before you start

- Search existing issues before opening a new one.
- For a word or translation correction, open a **Dictionary correction** issue
  with the Turkmen headword, suggested correction, source, and a short reason.
- Do not upload PDFs, scans, or source datasets unless their redistribution
  permission is clear. See [DATA_LICENSE.md](DATA_LICENSE.md).

## Local development

```bash
cd web
npm install --legacy-peer-deps
npm run build:data
npm run dev
```

Run the checks before opening a pull request:

```bash
cd web
npm run check
npm run build
```

## Pull requests

- Keep each pull request focused on one improvement.
- Explain the change, link its issue when applicable, and include the source
  for dictionary-data corrections.
- Never include local environment files, generated build output, or raw source
  material.

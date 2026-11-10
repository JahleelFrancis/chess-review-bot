# Harness v2 — Browser-build alignment patch

## Why
`static/index.html` now loads `/vendor/chess.browser.js`, but the original v1 UI contract looked for `/vendor/chess.js` and the isolated test loader still used the old CommonJS version with a fake `exports` object.

## Contents
- `tests/05-ui-contract.test.cjs` — requires one `chess.browser.js` script tag, before `tactics.js` and `ui.js`, rejects the legacy browser script tag, and checks that the file exists.
- `tests/helpers/load-project.cjs` — loads the actual browser build during unit tests and **does not** inject `exports`.

## Install
From the project root (`chess_bot`) in PowerShell:

```powershell
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\chess_harness_v2_browser_alignment_patch.zip" -DestinationPath . -Force
node scripts/v2/run-fast.cjs
```

The archive has paths relative to the project root. Use `Expand-Archive` into `.`, not a new named folder. Back up or commit before overwriting these two harness files. Nothing in `static/` is changed.

## Local verification
In the archived Nov 4 project plus the browser compatibility build, 31/31 v1 Node tests and 9/9 v2 Node tests passed after this patch. This does not certify the 4 unverified historical fixtures. The independent Python oracle was not rerun during patch creation; your earlier output reported 7 PASS, 0 FAIL and 4 UNVERIFIED.

If your application source has changed substantially since the archive, actual test outcomes may differ. Do not suppress any new failures.

---
description: Verify the site still works - syntax-check inline JS, smoke-load index.html in headless Chromium, and run security checks on the diff.
---

# Verification Command

Run verification on the current state of `index.html`.

## Instructions

Execute in this order:

1. **Script and browser check**
   - Run `node .claude/scripts/verify.mjs`
   - It syntax-checks every inline `<script>` block, then (if Playwright is installed)
     loads the page in headless Chromium and reports uncaught errors and `console.error` output.
   - `NETWORK` lines for CDN or Google Fonts requests are environment-dependent (offline,
     proxy); mention them but don't fail on them.
   - If it reports `SYNTAX` or `ERROR` lines, report them and STOP.

2. **Security audit of the diff** (`git diff HEAD -- index.html`)
   - No API keys, tokens or other secrets committed (look for `gsk_`, `sk-`, `Bearer ` followed by a literal)
   - Every value interpolated into `innerHTML` or a template string that becomes HTML goes through `escapeHtml()`
   - New external scripts are pinned to an exact version on cdnjs (like pdf.js and mammoth today)
   - New `fetch()` targets are HTTPS and only receive the user's API key when they are that key's provider

3. **Debug output audit**
   - New `console.log` calls in the diff

4. **Git status**
   - Uncommitted changes and files modified since the last commit

## Output

```
VERIFICATION: [PASS/FAIL]

Syntax:   [OK/X errors]
Browser:  [OK/X errors/skipped]
Security: [OK/X issues]
Logs:     [OK/X console.logs]

Ready for PR: [YES/NO]
```

If anything critical is found, list it with a suggested fix.

## Arguments

$ARGUMENTS can be:
- `quick` - Step 1 only, with `--no-browser`
- `full` - All steps (default)

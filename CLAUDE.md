# SOZYKIN Плагиат

Client-side plagiarism and AI-text checker. The whole app is one file, `index.html`
(HTML + CSS + JS, no build step, no package manager). It runs entirely in the browser
and is meant to work from Russia without a VPN.

## Layout of `index.html`

| Lines (approx.) | What |
|---|---|
| 1–32 | `<head>`: meta, inline SVG icons, data-URI PWA manifest, CDN scripts (mammoth 1.8.0, pdf.js 3.11.174) |
| 33–1273 | `<style>` |
| 1303–end | Main `<script>`, split into `// ===` sections with Russian headings |

Main script sections, in order: global state `S` (persisted to `localStorage` keys
`sp_v7` / `sp_draft_v7`), toasts, dictionaries, text utilities (`tokenize`,
`escapeHtml`), document suspicion detector, MinHash + LSH, TF-IDF cosine, file
reading (PDF/DOCX/TXT), local analysis, lexical-diversity metrics (MTLD, HD-D,
Honoré, Yule K, Zipf), AI providers, API mode, source search (OpenAlex, Crossref,
Semantic Scholar, arXiv, DOAJ, ru.wikipedia), key-phrase extraction,
Fast-DetectGPT-lite, run-analysis entry point, UI helpers, home screen, file upload,
progress screen.

Find a section with `grep -n '^// ===' -A1 index.html`.

## Conventions

- Keep it a single file. Don't add a bundler, framework or `package.json` unless asked.
- Code comments are in Russian and explain *why*; match that style.
- UI text is Russian.
- Use `toast()` for user messages, never `alert()`.
- Mobile first: test at phone width (390px), respect safe-area insets.

## Security rules (adapted from everything-claude-code `rules/security.md`)

- Never commit an API key. The user's key lives only in `S.apiKey` / `localStorage`
  and is sent only to the selected provider's endpoint.
- Anything from a document, an API response or the user that goes into `innerHTML`
  or an HTML template string must pass through `escapeHtml()`.
- External scripts: cdnjs only, pinned to an exact version.
- New network calls: HTTPS, and degrade gracefully when the service is unreachable
  (no VPN is a hard requirement).

## Workflow

- `/plan` before larger changes (uses the `planner` agent).
- After changing `index.html`, run `/verify` (or `node .claude/scripts/verify.mjs`
  directly). It syntax-checks the inline scripts and, if Playwright is installed,
  smoke-loads the page in headless Chromium.
- Use the `code-reviewer` agent on finished changes, and the `security-reviewer`
  agent or `security-review` skill when touching API keys, file parsing or `innerHTML`.
- Commit messages: `<type>: <description>` with types feat, fix, refactor, docs,
  test, chore, perf, ci.

## Claude Code setup

`.claude/` holds a subset of
[everything-claude-code](https://github.com/worldflowai/everything-claude-code)
(MIT, by Affaan Mustafa), picked for a static single-file site:

- `agents/`: planner, architect, code-reviewer, security-reviewer (verbatim)
- `skills/security-review` (verbatim)
- `commands/`: `/plan`, `/learn`, `/checkpoint` (lightly adapted), `/verify` (rewritten for this repo)
- `scripts/verify.mjs`: checks behind `/verify`

Left out on purpose: TDD/coverage, build-error and E2E agents, React/backend/ClickHouse
skills, and the upstream hooks (tmux, Prettier, tsc, .md blocker), which assume a
Node/TypeScript project.

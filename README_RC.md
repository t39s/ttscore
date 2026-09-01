# ttScore + ttScore Team integration release candidate

## Pair

- `ttScore v0.4.0` — release candidate; accepted baseline remains v0.3.5 until owner acceptance.
- `ttscore_team v0.9.0` — release candidate; accepted baseline remains v0.8.12 until owner acceptance.

## Deployable layout

Keep this relative layout unchanged on the same static origin:

- `/ttScore_0.4.0.html`
- `/team/ttscore_team_0.9.0.html`
- `/team/assets/0.9.0/*`

The Team editor action resolves to `../ttScore_0.4.0.html?teamMatch=<id>`. ttScore Team mode lazy-loads `./team/assets/0.9.0/ttscore-team-adapter.mjs`.

No Node.js runtime/server is required by the products. Node is used only for the included automated test suite.

## Reproducible verification after extraction

From the extracted bundle root:

- `node --test tests/ttscore_team/*.test.mjs` → 201/201 PASS in the final cycle run.
- `node --test tests/ttscore/*.test.mjs` → 10/10 PASS.
- Browser harnesses are in `evidence/harness/`; they use Playwright/Chromium only as development evidence and are not product dependencies.
- `sha256sum -c SHA256SUMS.md` verifies artifact integrity.

The accepted v0.3.5 HTML included under `evidence/baselines/` is evidence-only and is not a deploy target.

## Acceptance

The engineering cycle decision is `STOP`; this is not automatic owner acceptance. Use `docs/OWNER_ACCEPTANCE_CHECKLIST.md` with the real Firebase editor account before promoting these release candidates to accepted baselines.

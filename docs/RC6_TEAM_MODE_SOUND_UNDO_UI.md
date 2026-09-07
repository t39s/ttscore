# RC6 — Team mode sound / Undo UI stabilization

## Baseline

Owner-accepted baseline: **ttScore 0.5.0 + ttscore_team 0.11.0 RC3**.

RC4 and RC5 are rejected intermediate candidates and are not implementation baselines for RC6. RC6 was rebuilt directly from RC3.

## Product requirement

Only in Team mode:

- every page opening starts with sound `off`, regardless of a previously saved sound state;
- every newly created match starts with sound `off`;
- the umpire may enable sound manually during an active match;
- while sound is `off`, Repeat Score is removed from layout and Undo occupies the two original central toolbar tracks;
- when sound is enabled, the original Undo + Repeat Score layout returns;
- standalone ttScore behavior remains unchanged.

## Implementation

`defaultState().speechEnabled` is mode-aware: `!IS_TEAM_MODE`. This keeps standalone default `on` while making all newly created Team states default `off`.

A separate Team-only normalization immediately after state restoration forces `speechEnabled = false` on page opening. This intentionally prevents a previously persisted Team `sound on` state from surviving a reload.

`render()` derives `teamSoundOff = IS_TEAM_MODE && !state.speechEnabled` and:

- toggles `body.team-sound-off`;
- hides `speechRepeatButton` only for Team sound-off state.

CSS makes `#undoButton` span toolbar columns 2–3 while `body.team-sound-off` is active. The original four-column grid is not replaced, so enabling sound removes the class and restores the exact baseline layout automatically.

`toggleSpeech()` itself is unchanged.

## Runtime scope

Changed runtime file relative to accepted RC3:

- `ttScore_0.5.0.html`

No Team Editor, integration contract/adapter, Firebase Rules, scoring, lifecycle, or Undo semantic changes.

## Verification

- Full Node regression: **254/254 PASS**.
- Inline JavaScript syntax: **PASS**.
- Runtime diff reviewed directly against RC3.
- Browser E2E was attempted but Chromium blocked localhost with `ERR_BLOCKED_BY_ADMINISTRATOR`; no browser-pass claim is made.

## Review decision

**STABILIZE** — code review found no blocking defect. Owner visual/operational verification remains required before acceptance.

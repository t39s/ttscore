# ttScore 0.8.2 + ttscore_team 0.11.1 RC16

## Status

Owner-device stabilization of RC15 after real iOS verification.

RC15 was reported as generally functional, but two defects were confirmed on the owner device:
1. the speech-language mode reset to `Ru` after page reload;
2. the native iOS range control left visible endpoint gaps at 0% and 100%.

RC16 fixes both defects without changing Team runtime or Firebase Rules.

- Speech mode is now a device-local preference under `ttScore:speechMode:v1` and survives reload/new match/reset.
- Volume sliders use explicit WebKit range geometry; the visible track terminates at the thumb centers for 0% and 100%.
- Speech Voice Profiles architecture remains the RC14/RC15 reset architecture.
- Stable owner-accepted baseline remains RC4 until explicit owner acceptance.
- Engineering decision: `ESCALATE` only for owner-controlled iOS/iPadOS re-verification of the two fixes and the existing voice-profile checklist.

See `docs/GENERAL_REVIEW.md`, `docs/EVIDENCE.md`, `docs/OWNER_ACCEPTANCE_CHECKLIST.md`, and `docs/RC16_OWNER_DEVICE_DEFECT_STABILIZATION.md`.

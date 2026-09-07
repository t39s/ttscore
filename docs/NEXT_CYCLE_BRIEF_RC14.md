# NEXT CYCLE BRIEF — RC14

## Current state

Stable baseline before this cycle: `ttScore 0.5.0 + ttscore_team 0.11.0 RC10`.

Candidate: `ttScore 0.5.0 + ttscore_team 0.11.0 RC14`.

## Evidence

- 267/267 Node tests PASS;
- 6/6 functional Chromium cases PASS;
- 5/5 viewport geometry cases PASS;
- runtime scope limited to `ttScore_0.5.0.html`;
- Team runtime/Firebase Rules unchanged.

## Known limitations

Real-device acceptance has not been performed by the executor.

## Gap

Need owner operational validation that physical placement of the tablet matches the intended `normal/reversed` semantics and that the permanent toggle is convenient in actual use.

## Recommended next target

No new development until owner acceptance or a concrete defect is reported.

## Decision

**STABILIZE**

## Reason

Development goal and automated/browser criteria are met; remaining evidence is owner-controlled real-device use.

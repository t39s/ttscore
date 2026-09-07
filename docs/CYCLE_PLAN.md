# Cycle plan — ttScore 0.5.0 + ttscore_team 0.10.0 RC1

1. Preserve accepted RC9 scoring/CAS/rebase behavior.
2. Add versioned RTDB report-record contract and Security Rules.
3. Add create-only/idempotent Firebase report transport.
4. Capture canonical completed JSON before local reset and wait for server-confirmed backup.
5. Carry generated reportUrl through pendingRelease and apply it with Team finish transition.
6. Add `source=team` report viewer with integrity validation and local file recovery.
7. Review temporary-network, ambiguous-acknowledgement, stale Team and regression paths.
8. Run Node/browser suites and package only if no open blocker remains.

Decision target: STABILIZE for production owner acceptance.

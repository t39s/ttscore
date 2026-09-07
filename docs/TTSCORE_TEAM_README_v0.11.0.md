# ttscore_team 0.11.0

Adds administrative **Team-level Undo** to the accepted 0.10.0 baseline.

The editor can prepare and publish rollback of the latest finished individual match. The undone match becomes current, an existing next current returns to planned, Team score is recalculated, active result/reportUrl are cleared for the undone match, and historical report backup is retained.

`ttScore 0.5.0` and Firebase Rules are unchanged.

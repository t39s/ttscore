# Owner acceptance checklist — ttScore 0.4.0 + ttscore_team 0.9.0

Use the real deployed Firebase/editor account and a disposable Team match.

1. Open Team `mode=edit` for a Firebase match and press `Открыть в ttScore`. Confirm `ttScore_0.4.0.html?teamMatch=<id>` opens.
2. Confirm date, current pair and best-of are prefilled and locked; server, side and handicap remain selectable.
3. Start the individual match and enable Live. Confirm Team receives current Live scoreboard/report links.
4. Finish the match. Before leaving the final result, use Undo once and confirm Team has not moved current → finished. Re-finish the match.
5. Choose `Новая встреча` and confirm exit. Verify exactly the completed individual match becomes `finished`, score is correct, and the next planned match becomes `current`.
6. Confirm ttScore setup is automatically prefilled with the next pair.
7. Reload/network-interrupt around final delivery once; verify same-result retry reconciles without a second schedule transition.
8. Separately open ttScore without `teamMatch`; confirm ordinary autonomous setup/scoring still works.

Acceptance decision remains with the product owner.

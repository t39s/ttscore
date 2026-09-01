# General review — ttScore 0.4.0 + ttscore_team 0.9.0

## Review stance

Ревью пыталось опровергнуть выполнение цели: корректность assignment/binding, Undo boundary, concurrency, retry, regression scoring, автономность и Firebase security boundary.

## Findings resolved

### HIGH — non-atomic editor publication
Baseline `get → revision check → set` оставлял race window. Исправлено: общий `transactFirebaseTeamMatch()` использует `runTransaction()` и проверяет revision/contract на фактическом transaction snapshot.

### HIGH — possible loss of v0.3.5 local state on version namespace change
Первый кандидат сменил `ttScore:0.3.5:*` на `0.4.0:*`. Это могло скрыть незавершённую встречу после обновления. Исправлено: local protocol namespace сохранён `0.3.5`, так как schema не менялась.

### HIGH — retry after already committed transition
Если другой writer или предыдущая попытка уже применили тот же result, старый binding становился stale и pending мог застрять. Исправлено: `finishedBindingApplied()` reconciles exact same result; different result остаётся fail-closed.

### HIGH — Team launch URL did not target the paired versioned ttScore artifact
Финальный release review обнаружил, что первый кандидат строил Team launch от корня сайта (`../`). Исторический ttScore публикуется версионными HTML-файлами, поэтому root URL не является гарантированным entry point. Исправлено: общий `ttScoreBaseUrl()` явно указывает `../ttScore_0.4.0.html`; этот же base используется launch action и legacy Live URL generation. Добавлена structural regression assertion.

### MEDIUM — duplicated assignment/binding comparison in ttScore
Первый кандидат дублировал часть contract logic. Исправлено: ttScore делегирует `assignmentMatchesTeamBinding()` adapter/contract.

### MEDIUM — Team launch action in local editor
Локальный JSON editor не является Firebase operational source. Исправлено: action запуска Team mode скрыт вне Firebase editor.

### MEDIUM — release-candidate tests were not relocatable after packaging
Первый общий RC переместил Team tests в `tests/ttscore_team/`, но сохранил их старые относительные imports; ttScore regression-test также не содержал baseline v0.3.5 внутри архива. Исправлено: относительные пути адаптированы к RC layout, baseline помещён в `evidence/baselines/`, browser harness сделан относительным к собственному каталогу. Полный suite повторно запущен из распакованного RC.

## Regression

- 9 критических scoring/Undo функций ttScore byte-identical с v0.3.5.
- localStorage/BroadcastChannel protocol сохранён.
- legacy Team editor bridge сохранён.
- Team schemaVersion остаётся 4.

## Concurrency

Operational revision включает дату, bestOf, player identities/names, порядок/status/result всех individual matches. Не включает Live links, reportUrl и updatedAt. Это позволяет безопасно сохранять независимые link/admin изменения из актуального transaction snapshot, но блокирует изменение расписания/assignment.

## Security

`firebase-database-rules.json` сохраняет allowlisted editor UID. Client contract не рассматривается как защита от компрометированного admin credential; он защищает штатный automatic writer от stale/wrong operations. Для технического ограничения одного credential только operational-полями потребовалась бы отдельная role/custom claim/credential, что не входит в текущую цель.

Classification: **ACCEPTED LIMITATION**, не blocker acceptance criteria.

## Environment limitations

Обычный localhost/file navigation Chromium блокируется policy среды. Это не product defect. Для browser evidence использован DevTools `Page.setDocumentContent` в чистом about:blank context; применялся реальный ttScore DOM/JS, а mock заменял только Team Firebase adapter boundary. Отдельно выполнен autonomous browser smoke.

Реальный authenticated Firebase write не выполнялся из-за отсутствия editor credentials. Claims о production Firebase E2E не делаются.

## Final review result

BLOCKER: 0  
HIGH open: 0  
MEDIUM open: 0  
LOW: 0 существенных  
ACCEPTED LIMITATION: 2 (credential trust boundary; no live credentialed Firebase E2E in execution environment)

Goal acceptance criteria имеют достаточное альтернативное evidence. Решение: `STOP`.

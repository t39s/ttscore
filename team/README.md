# ttScore Team v0.8.11

## Статус

- Версия: `v0.8.11`.
- Статус: `IMPLEMENTED LOCALLY, REVIEWED, NOT PUBLISHED, NOT YET ACCEPTED`.
- Baseline: `v0.8.10`.
- `ttScore 0.3.5` не изменяется.
- `schemaVersion: 4` не изменяется.

Главное изменение `v0.8.11`: для завершённых командных встреч добавлен статический read-only fallback финального JSON на GitHub Pages. Firebase остаётся единственным оперативным источником для `planned/current/live` и основным источником для `finished`.

```text
public view
   ↓
Firebase /teamMatches/<id>
   ├─ success → обычный realtime view
   └─ error / no match
          ↓
     проверить GitHub archive
     team/matches/<id>/<id>.json
          ↓
     только если schemaVersion: 4 + completed
          ↓
     предложить [Открыть архивную копию]
          ↓
     read-only view + «Архивная копия»
```

Архив не используется в `mode=edit`, не участвует в Live, не записывается обратно в Firebase и не сравнивается с Firebase по принципу «какая версия новее».

## Firebase

Проект и правила не изменены относительно `v0.8.10`:

- `projectId`: `ttscore-list`;
- `databaseURL`: `https://ttscore-list-default-rtdb.europe-west1.firebasedatabase.app/`;
- Authentication: Email/Password;
- рабочий путь: `/teamMatches/<id>`;
- публичное чтение `/teamMatches/<id>`;
- запись только для UID из закрытого `/editors/<uid> = true`.

Настройка: `ttscore_team_firebase_setup_v0.8.10.md`. Rules: `firebase-database-rules.json`.

## Структура пакета

```text
team/
  ttscore_team_0.8.11.html
  assets/0.8.11/
    app.mjs
    archive-source.mjs
    creator.mjs
    editor.mjs
    file-save.mjs
    firebase-source.mjs
    matches-source.mjs
    model.mjs
    styles.css
    ttscore-integration.mjs
    ui-state.mjs
tests/
  archive-source.test.mjs
  ...
firebase-database-rules.json
RESEARCH_v0.8.11.md
PLAN_v0.8.11.md
GENERAL_REVIEW_v0.8.11.md
NEXT_CYCLE_BRIEF_v0.8.11.md
ttscore_team_referee_checklists_v0.8.11.md
```

Исторические документы предыдущих версий сохранены без переписывания.

## Публичный режим

```text
ttscore_team_0.8.11.html?match=<id>
```

Нормальный путь — Firebase `onValue()`. Если Firebase успешно отдаёт матч, GitHub archive не используется.

Если первоначальное получение Firebase завершается ошибкой или матч отсутствует, приложение проверяет:

```text
team/matches/<id>/<id>.json
```

Архив предлагается пользователю только если:

1. JSON проходит обычную строгую модель `schemaVersion: 4`;
2. `id` совпадает с параметром `match`;
3. командная встреча действительно завершена (`completed`).

Переход на архив выполняется только после нажатия `Открыть архивную копию`. В интерфейсе постоянно показывается `Архивная копия · read-only`.

Запрос архива использует `cache: no-store`, чтобы снизить риск показа старой копии после обновления постоянных `reportUrl`.

## Редактор и creator

Firebase-editor и creator сохраняют контракт `v0.8.10`:

- `?match=<id>&mode=edit` — только Firebase;
- `?mode=create` — создание в Firebase;
- `?mode=edit` без `match` — локальный JSON editor;
- `Сохранить JSON` — резервный локальный экспорт.

Архивный fallback не подключён к editor. Это жёсткая граница против появления второго оперативного source of truth.

Editor publication остаётся `get()` → проверка ревизии → `set()` → readback. Это не атомарный CAS; модель рассчитана на одного операционного редактора. Create-mode по-прежнему использует transaction для защиты от overwrite существующего ID.

## Архивирование finished

После финальной публикации Firebase и проверки public view сохранить канонический JSON и разместить:

```text
team/matches/<id>/<id>.json
```

Рекомендуемый порядок:

```text
finished в Firebase
→ проверить public view
→ Сохранить JSON
→ commit <id>.json вместе с постоянными отчётами
```

Если позднее добавляется `reportUrl`, рекомендуется обновить и Firebase final JSON, и GitHub archive JSON. GitHub archive при этом остаётся только read-only fallback.

## Относительные reportUrl

Семантика не изменилась. `./individual-01.html` разрешается от:

```text
team/matches/<id>/
```

Поэтому архивный `<id>.json` и постоянные отчёты естественно живут в одном каталоге.

## Интеграция ttScore 0.3.5

Сохранена без изменений: `currentMeeting`, `livePublication`, BroadcastChannel/storage events, `pendingFinishedMatch`, Undo до нового `matchId`, пакетный переход, проверка следующей пары, Live и reconciliation.

## Проверки

- автоматические тесты: **177/177**;
- добавлены unit/regression tests архивного URL, HTTP 404/503, `cache: no-store`, совпадения `id` и запрета fallback для незавершённой встречи;
- статически проверена граница `public view only` и отсутствие archive-write path;
- JavaScript syntax: `node --check` для всех runtime/test `.mjs`;
- Firebase Rules и `schemaVersion: 4` не изменены;
- `ttScore 0.3.5` не изменён.

Не выполнен реальный production smoke с искусственным отключением Firebase на GitHub Pages: среда не управляет production Firebase/Pages. Этот сценарий покрыт модульными и структурными проверками; перед публикацией остаётся короткий ручной smoke по чеклисту.

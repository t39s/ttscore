# ttScore Team v0.8.10

## Статус

- Версия: `v0.8.10`.
- Статус: `IMPLEMENTED LOCALLY, NOT PUBLISHED, NOT YET ACCEPTED`.
- Основа: принятая `v0.8.7`.
- `ttScore 0.3.5` не изменяется.
- `schemaVersion: 4` не изменяется.

Главное изменение `v0.8.10`: рабочий JSON командной встречи больше не публикуется через GitHub Pages. Источник истины — Firebase Realtime Database проекта `ttscore-list`.

```text
mode=create / mode=edit
        │
        │ Email/Password + get/set
        ▼
Firebase Realtime Database
/teamMatches/<teamMatchId>
        │
        │ onValue()
        ▼
public view на всех устройствах
```

GitHub Pages остаётся статическим хостингом HTML/JS/CSS `ttscore_team`. Собственный backend, Cloud Functions, GitHub API и service account не добавляются.

## Firebase

Проект:

- `projectId`: `ttscore-list`
- `databaseURL`: `https://ttscore-list-default-rtdb.europe-west1.firebasedatabase.app/`
- Authentication: Email/Password
- рабочий путь: `/teamMatches/<id>`

Готовые правила находятся в `firebase-database-rules.json`. Перед рабочей публикацией их нужно установить в Firebase Console → Realtime Database → Rules.

Публичное чтение разрешено только внутри `/teamMatches/<id>`. Запись разрешена только аутентифицированным UID, включённым в закрытый allowlist `/editors/<uid> = true`. Учётная запись редактора создаётся вручную в Firebase Console → Authentication → Users, затем её UID добавляется в Realtime Database → Data → `/editors`.
Для работы Web Auth с production-страницей в Authentication → Settings → Authorized domains должен присутствовать `t39s.github.io`.

Подробная настройка: `ttscore_team_firebase_setup_v0.8.10.md`.

## Структура пакета

```text
team/
  ttscore_team_0.8.10.html
  assets/0.8.10/
    app.mjs
    creator.mjs
    editor.mjs
    file-save.mjs
    firebase-source.mjs
    matches-source.mjs
    model.mjs
    styles.css
    ttscore-integration.mjs
    ui-state.mjs
firebase-database-rules.json
tests/
  creator.test.mjs
  editor.test.mjs
  file-save.test.mjs
  firebase-source.test.mjs
  matches-source.test.mjs
  model.test.mjs
  static-structure.test.mjs
  ttscore-integration.test.mjs
  ui-state.test.mjs
ttscore_team_firebase_setup_v0.8.10.md
ttscore_team_review_v0.8.10.md
ttscore_team_referee_checklists_v0.8.10.md
...
```

Исторические документы предыдущих версий сохранены без изменения.

## Модель данных

Одна командная встреча хранится одним JSON-объектом:

```text
/teamMatches/<teamMatchId>
```

Логическое содержимое объекта — тот же командный JSON `schemaVersion: 4`, который использовался в `v0.8.7`. Realtime Database физически не хранит свойства со значением `null`; Firebase-adapter `v0.8.10` восстанавливает отсутствующие nullable-поля (`venue`, верхнеуровневые Live-поля, `result`, `reportUrl`) перед строгой валидацией и вычислением ревизии. Поэтому спортивная модель и локальный JSON остаются каноническими.

Поля `liveReportUrl` и `liveScoreboardUrl` по-прежнему относятся только к текущей (`current`) личной встрече. `reportUrl` завершённой личной встречи остаётся необязательным.

## Публичный режим

```text
ttscore_team_0.8.10.html?match=<id>
```

Публичная страница подписывается через Firebase `onValue()` непосредственно на `/teamMatches/<id>`. Listener получает первоначальное состояние и каждое последующее изменение. Периодический polling удалён.

Публичному режиму Firebase Authentication не требуется.

## Редактор Firebase

```text
ttscore_team_0.8.10.html?match=<id>&mode=edit
```

Редактор:

1. Загружает `/teamMatches/<id>` из Firebase.
2. Позволяет локально подготовить preview точно так же, как `v0.8.7`.
3. Перед preview повторно читает Firebase и проверяет ревизию источника.
4. Для публикации требует вход Email/Password.
5. Непосредственно перед публикацией выполняет свежий `get()` из Firebase.
6. Сравнивает серверную ревизию с загруженной и при совпадении записывает подготовленный JSON через `set()`.
7. После успешной публикации сразу синхронизирует editor с опубликованным состоянием.

Таким образом, прежняя ручная цепочка `Сохранить JSON → GitHub commit → дождаться Pages → Перезагрузить источник` больше не является рабочим циклом.

Основное действие после preview — `Опубликовать в Firebase`. `Сохранить JSON` остаётся резервным локальным экспортом.

## Создание новой встречи

```text
ttscore_team_0.8.10.html?mode=create
```

Creator формирует тот же JSON `schemaVersion: 4`. После preview:

- `Опубликовать в Firebase` создаёт `/teamMatches/<id>`;
- создание по-прежнему выполняется transaction и не перезаписывает уже существующий ID;
- если ID занят, для дальнейших изменений используется `?match=<id>&mode=edit`;
- `Сохранить JSON` остаётся резервным экспортом.

## Локальный editor

```text
ttscore_team_0.8.10.html?mode=edit
```

Локальный режим сохранён как fallback для чтения и редактирования файла `schemaVersion: 4`. Он не обращается к Firebase и не публикует данные. Это сознательное разделение: Firebase-editor работает только при наличии `match=<id>`.

## Относительные reportUrl

Перенос рабочего JSON в Firebase не меняет семантику файлов постоянных отчётов.

Относительный `reportUrl`, например:

```text
./individual-01.html
```

по-прежнему разрешается от GitHub Pages-каталога:

```text
team/matches/<id>/
```

То есть в Firebase хранится командный JSON, а автономные HTML/JSON-файлы отчётов при необходимости могут оставаться статическими файлами GitHub Pages.

## Интеграция ttScore 0.3.5

Вся логика `v0.8.7` сохранена:

- чтение `ttScore:0.3.5:currentMeeting`;
- чтение `ttScore:0.3.5:livePublication`;
- `BroadcastChannel("ttScore:0.3.5:meeting")` и `storage` events;
- локальный `pendingFinishedMatch`;
- автоматический Undo, пока остаётся тот же `matchId`;
- удержание завершённого результата после запуска следующей встречи;
- проверка следующей пары;
- пакетный переход `finished предыдущей + current следующей + Live следующей`;
- ручная корректировка сохранённого результата после нового `matchId`;
- публикация перехода без Live;
- reconciliation pending с опубликованным состоянием.

Разница только в последнем шаге: подготовленный JSON публикуется напрямую в Firebase.

## Безопасность и простота

`v0.8.10` сознательно использует минимальную модель доступа:

- public read `/teamMatches/<id>`;
- write `/teamMatches/<id>` только для UID из `/editors`;
- `/editors` закрыт для клиентского чтения и записи;
- нет регистрации пользователя в приложении;
- нет пользовательских ролей, custom claims или Cloud Functions;
- нет собственного сервера;
- нет секретов service account в клиенте.

Firebase Web config является клиентской конфигурацией. Право записи защищается Authentication и Realtime Database Rules, а не сокрытием `apiKey`.

Все разрешённые UID сейчас имеют одинаковые права на все командные встречи. Более детальное разграничение при необходимости можно добавить позже без изменения структуры спортивного JSON.

## Проверки

- автоматические тесты: **173/173**;
- Firebase: config/path/auth/realtime, create-transaction, editor get+revision+set, RTDB-null normalization и editor allowlist проверены статическими и модульными тестами;
- JavaScript syntax: проверяется `node --check`;
- спортивная модель `schemaVersion: 4` и workflow `v0.8.7` сохранены.

Сетевой end-to-end write в реальный Firebase не включён в автоматические тесты пакета, потому что для него требуется действующая учётная запись редактора и установленные Rules.

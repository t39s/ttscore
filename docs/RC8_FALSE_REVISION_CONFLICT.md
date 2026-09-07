# RC8 — ложный revision conflict при завершении личной встречи

## Наблюдение owner acceptance RC6

Основной Team transition выполнялся корректно после ручного «Перечитать Team», но первая автоматическая попытка завершения могла сообщить:

`Данные в Firebase изменились во время публикации. Team state не перезаписан; перезагрузите источник и повторите операцию.`

После «Перечитать Team» pending-result успешно публиковался: командный счёт менялся, следующая личная встреча становилась current.

## Корневая причина

RC6 использует server-enforced CAS через `_writeRevision`: existing-node write выполняет `GET revision N → transform → SET revision N+1`. Это корректно для межклиентной конкуренции.

В `ttScore` при выходе из завершённой встречи могли почти одновременно стартовать две легальные операции из **одной и той же страницы**:

1. остановка Live-публикации ставила в очередь Team Live-clear;
2. pending finished-result запускал Team transition.

Обе операции могли прочитать одну `_writeRevision = N` до записи другой. Тогда обе предлагали `N+1`; первая проходила, вторая корректно отклонялась Rules как stale. Это был не внешний конфликт, а локальная гонка same-client writers.

## Решение

В `firebase-source.mjs` введена per-Team write queue. Она сериализует **весь** existing-node critical section:

`GET → domain transform → SET`

а не только `SET`.

Очередь scoped по Team match ID, поэтому:

- Live-clear и finished transition из одной страницы выполняются последовательно;
- второй writer читает уже новую `_writeRevision`;
- ошибка одной операции не блокирует следующие;
- конкуренция другой вкладки/администратора не скрывается и по-прежнему определяется server-side CAS.

## Что не менялось

- Firebase Rules RC6;
- Team domain model;
- integration contract;
- `ttScore` scoring core;
- product versions `ttScore 0.4.0` / `ttscore_team 0.9.0`.

## Regression

Добавлен тест, запускающий конкурентно `live-clear` и `finish` для одного Team ID. Ожидаемая последовательность чтений/записей: `7→8`, затем `8→9`, без ложного conflict. Отдельно проверяется восстановление очереди после failed write.

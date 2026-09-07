# RC14 — terminology and evidence portability fix

## Purpose

RC14 не меняет функциональное поведение side-perspective RC13.

Исправлено:

- термин «сторона корта» заменён на корректный для настольного тенниса термин **«сторона стола»**;
- runtime-local identifier `courtView` переименован в `tableView`;
- тестовые названия и browser-evidence labels приведены к `table-side`;
- browser evidence scripts больше не содержат абсолютный путь `/mnt/data/...` и вычисляют корень RC относительно расположения самого script.

## Runtime semantics

`state.leftPlayer` не переименовывается и не меняет семантику: это существующее поле baseline, означающее спортсмена на левой стороне стола.

RC13 → RC14 функциональная логика side-perspective не изменена.

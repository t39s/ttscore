# PRODUCT GOAL — ttScore + ttscore_team integration

## Продукт

ttScore + ttscore_team — межпродуктовая интеграция.

## Цель

Обеспечить полноценный командный режим взаимодействия ttScore и ttscore_team без зависимости operational-пути от открытой страницы ttscore_team editor, сохранив ttScore полностью автономным вне командного режима.

## Желаемый результат

При явном запуске ttScore в контексте командной встречи он получает актуальное назначение текущей индивидуальной встречи из ttscore_team, предзаполняет необходимые данные setup и после проведения встречи автоматически передаёт Live-состояние и подтверждённый финальный результат. После закрытия Undo-window Team-состояние корректно переходит к следующей индивидуальной встрече, а её данные становятся доступны ttScore без повторного ручного ввода и без необходимости держать Team editor открытым.

## Ключевые ограничения

- Автономный ttScore не зависит от Team Firebase/auth/context.
- ttscore_team editor не встраивается в ttScore.
- Новый server-side runtime не вводится.
- Общий versioned operational-domain contract используется обоими продуктами.
- Первый подающий, сторона и фора остаются решениями судьи.
- Конфликт revision/assignment/match/result/network должен быть fail-closed.

## Критерий достижения

End-to-end путь `Team assignment → ttScore prefill → scoring/Undo → release → Team transition → next assignment` работает без открытого Team editor; ошибочные/stale contexts не изменяют чужую встречу; автономный ttScore не получает regression; regression и integration contract checks проходят.

Статус: согласовано владельцем 2026-08-31.

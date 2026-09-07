# PRODUCT GOAL — online scoreboard side perspective

Baseline: `ttScore 0.5.0 + ttscore_team 0.11.0 RC10`

## Goal

Добавить в публичное онлайн-табло device-local режим стороны просмотра, позволяющий использовать один и тот же live-state при двух физических положениях планшета относительно наблюдателя.

Режимы:

- `normal`: текущая сторона стола слева отображается слева;
- `reversed`: текущая сторона стола слева отображается справа, а текущая сторона стола справа — слева.

Текст, цифры и вертикальная ориентация интерфейса остаются нормальными.

## Product decisions

1. Последний выбранный режим `normal/reversed` сохраняется локально на display-устройстве и восстанавливается при следующем открытии.
2. На рабочем онлайн-табло постоянно доступен явный touch-переключатель стороны просмотра.

## Required architecture

- сначала существующая спортивная логика RC10 определяет `table-left / table-right` через `state.leftPlayer`;
- затем отдельный presentation preference определяет отображение этих двух готовых side-моделей на `display-left / display-right`;
- при `reversed` переставляется целиком side payload: спортсмен, имя, текущий счёт, счёт партий и индикатор подачи;
- `state.leftPlayer` не изменяется ради display preference;
- Firebase/live schema и Team JSON не изменяются.

## Constraints

Запрещено использовать в качестве core-механизма:

- `rotate(180deg)` всего экрана;
- зеркальные CSS transforms;
- mutation `state.leftPlayer`;
- shared persistence в Firebase/Team JSON.

RC11/RC12 относятся к отклонённой экспериментальной трактовке whole-screen rotation и не являются основой разработки.

## Acceptance criteria

1. `normal` визуально сохраняет mapping RC10.
2. `reversed` меняет визуальные стороны A/B целиком.
3. Подающий переезжает вместе со своим спортсменом.
4. Реальная спортивная смена сторон композиционно корректно работает в обоих display modes.
5. Выбор сохраняется device-local и fail-safe возвращается к `normal` при невалидном/недоступном storage.
6. Переключатель постоянно доступен и имеет touch-target не менее 44×44 CSS px.
7. Firebase/live/scoring/lifecycle не меняются.
8. Regression и browser-review не выявляют блокирующих дефектов.
9. Реальный планшет остаётся обязательным owner acceptance для touch/visual эксплуатации.

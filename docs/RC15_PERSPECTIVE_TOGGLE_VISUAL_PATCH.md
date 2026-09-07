# RC15 — perspective toggle visual patch

Baseline: RC14.

Точечная UI-правка без изменения продуктовой логики:

- active/reversed состояние больше не получает чёрный фон и белый цвет;
- normal сохраняет исходную толщину glyph `⇄` (`font-weight: 700`);
- reversed индицируется только более выраженной толщиной glyph (`font-weight: 900` + `-webkit-text-stroke: .45px currentColor`);
- геометрия, 48×48 touch-target, position, persistence и side-perspective mapping не изменены.

Runtime scope RC14 → RC15: только `ttScore_0.5.0.html`, CSS-only.

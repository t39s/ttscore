import assert from "node:assert/strict";
import test from "node:test";

import {
  activeTeamMatchStatusText, movePlannedMatchWithSelection, personalMatchWinPhrase, selectPlannedMatch
} from "../../team/assets/0.10.0/ui-state.mjs";

test("склонение количества личных встреч учитывает русские окончания", () => {
  for (const [value, expected] of [
    [1, "1 личную встречу"], [2, "2 личные встречи"], [3, "3 личные встречи"], [4, "4 личные встречи"],
    [5, "5 личных встреч"], [11, "11 личных встреч"], [14, "14 личных встреч"],
    [21, "21 личную встречу"], [22, "22 личные встречи"], [25, "25 личных встреч"]
  ]) assert.equal(personalMatchWinPhrase(value), expected);
});

test("активный статус показывает номер текущей встречи и грамматический порог побед", () => {
  for (const [order, winsToFinish, phrase] of [[2, 3, "3 личные встречи"], [5, 5, "5 личных встреч"], [10, 9, "9 личных встреч"]]) {
    const text = activeTeamMatchStatusText({
      winsToFinish,
      individualMatches: [{ order, status: "current" }]
    });
    assert.equal(
      text,
      `Идёт личная встреча № ${order}. Для победы команде нужно выиграть ${phrase}.`
    );
  }
});

test("статус без current сохраняет порог побед", () => {
  assert.equal(
    activeTeamMatchStatusText({ winsToFinish: 5, individualMatches: [] }),
    "Ожидается назначение следующей личной встречи. Для победы команде нужно выиграть 5 личных встреч."
  );
});

test("простое выделение принимает только ID запланированной встречи", () => {
  const orderIds = ["m02", "m03", "m04"];
  assert.equal(selectPlannedMatch(orderIds, "m03"), "m03");
  assert.equal(selectPlannedMatch(orderIds, "m01"), null);
  assert.deepEqual(orderIds, ["m02", "m03", "m04"]);
});

test("после перемещения выделяется стабильный ID перемещённой встречи", () => {
  const orderIds = ["m02", "m03", "m04"];
  const moved = movePlannedMatchWithSelection(orderIds, 1, -1);
  assert.deepEqual(moved, {
    orderIds: ["m03", "m02", "m04"],
    selectedMatchId: "m03"
  });
  assert.deepEqual(orderIds, ["m02", "m03", "m04"]);
});

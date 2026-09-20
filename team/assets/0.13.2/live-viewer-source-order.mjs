export function createTeamLiveSourceOrder(onAccept) {
  if (typeof onAccept !== "function") throw new Error("Для Team Live source order требуется обработчик данных.");
  let epoch = 0;

  return {
    acceptRealtime(value) {
      epoch += 1;
      onAccept(value);
      return true;
    },
    beginRefresh() {
      const startedAt = epoch;
      let settled = false;
      return value => {
        if (settled) return false;
        settled = true;
        if (epoch !== startedAt) return false;
        epoch += 1;
        onAccept(value);
        return true;
      };
    },
    epoch() {
      return epoch;
    }
  };
}

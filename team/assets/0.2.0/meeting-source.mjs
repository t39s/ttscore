const MEETING_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function parseMeetingId(search) {
  const params = new URLSearchParams(search);
  const values = params.getAll("match");
  if (values.length !== 1 || !values[0]) {
    throw new Error("В адресе требуется ровно один параметр ?match=<id>.");
  }
  const id = values[0];
  if (!MEETING_ID_PATTERN.test(id)) {
    throw new Error("Параметр match должен содержать только строчные латинские буквы, цифры и дефисы.");
  }
  return id;
}

export function meetingDataUrl(meetingId, moduleUrl) {
  if (!MEETING_ID_PATTERN.test(meetingId)) {
    throw new Error("Некорректный идентификатор командной встречи.");
  }
  return new URL(`../../team-matches/${meetingId}.json`, moduleUrl);
}

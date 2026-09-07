export const TEAM_REPORT_SCHEMA_VERSION = 1;
export const TEAM_REPORT_MAX_JSON_BYTES = 1024 * 1024;

const TEAM_MATCH_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const RECORD_ID_PATTERN = /^\d{4}-\d{4}-[0-9a-f]{4}$/;
const INDIVIDUAL_MATCH_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const RECORD_KEYS = [
  'schemaVersion', 'teamMatchId', 'individualMatchId', 'recordId',
  'savedAt', 'byteLength', 'sha256', 'json'
];

function cloneJson(value) { return JSON.parse(JSON.stringify(value)); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function assertExactObject(value, path) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${path}: ожидается объект.`);
  const keys = Object.keys(value).sort();
  const expected = [...RECORD_KEYS].sort();
  assert(keys.length === expected.length && keys.every((key, index) => key === expected[index]), `${path}: неверный набор полей.`);
}
function assertTeamMatchId(value) {
  assert(typeof value === 'string' && TEAM_MATCH_ID_PATTERN.test(value), 'Backup report: некорректный teamMatchId.');
}
function assertRecordId(value) {
  assert(typeof value === 'string' && RECORD_ID_PATTERN.test(value), 'Backup report: некорректный recordId.');
}
function assertIndividualMatchId(value) {
  assert(typeof value === 'string' && INDIVIDUAL_MATCH_ID_PATTERN.test(value), 'Backup report: некорректный individualMatchId.');
}

export function validateTeamReportRecord(value, expected = {}) {
  assertExactObject(value, 'Backup report');
  assert(value.schemaVersion === TEAM_REPORT_SCHEMA_VERSION, 'Backup report: неподдерживаемая schemaVersion.');
  assertTeamMatchId(value.teamMatchId);
  assertIndividualMatchId(value.individualMatchId);
  assertRecordId(value.recordId);
  assert(Number.isSafeInteger(value.savedAt) && value.savedAt > 0, 'Backup report: savedAt должен быть положительным целым timestamp.');
  assert(Number.isSafeInteger(value.byteLength) && value.byteLength > 0 && value.byteLength <= TEAM_REPORT_MAX_JSON_BYTES, 'Backup report: byteLength вне допустимого диапазона.');
  assert(typeof value.sha256 === 'string' && SHA256_PATTERN.test(value.sha256), 'Backup report: sha256 должен быть 64-символьным lowercase hex SHA-256.');
  assert(typeof value.json === 'string' && value.json.length > 0 && value.json.length <= TEAM_REPORT_MAX_JSON_BYTES, 'Backup report: json отсутствует или превышает допустимый размер.');
  if (expected.teamMatchId !== undefined) assert(value.teamMatchId === expected.teamMatchId, 'Backup report: teamMatchId не совпадает с путём.');
  if (expected.recordId !== undefined) assert(value.recordId === expected.recordId, 'Backup report: recordId не совпадает с путём.');
  if (expected.individualMatchId !== undefined) assert(value.individualMatchId === expected.individualMatchId, 'Backup report: individualMatchId не совпадает с assignment.');
  return cloneJson(value);
}

export function buildTeamReportRecord(input) {
  return validateTeamReportRecord({
    schemaVersion: TEAM_REPORT_SCHEMA_VERSION,
    teamMatchId: input?.teamMatchId,
    individualMatchId: input?.individualMatchId,
    recordId: input?.recordId,
    savedAt: input?.savedAt,
    byteLength: input?.byteLength,
    sha256: input?.sha256,
    json: input?.json
  });
}

export function sameTeamReportPayload(left, right) {
  let a, b;
  try {
    a = validateTeamReportRecord(left);
    b = validateTeamReportRecord(right);
  } catch {
    return false;
  }
  return a.schemaVersion === b.schemaVersion
    && a.teamMatchId === b.teamMatchId
    && a.individualMatchId === b.individualMatchId
    && a.recordId === b.recordId
    && a.byteLength === b.byteLength
    && a.sha256 === b.sha256
    && a.json === b.json;
}

export function assertTeamReportRecordIdentity(record, binding) {
  const validated = validateTeamReportRecord(record, {
    teamMatchId: binding?.teamMatchId,
    recordId: binding?.ttScoreMatchId,
    individualMatchId: binding?.individualMatchId
  });
  return validated;
}

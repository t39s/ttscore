import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TEAM_REPORT_MAX_JSON_BYTES,
  TEAM_REPORT_SCHEMA_VERSION,
  assertTeamReportRecordIdentity,
  buildTeamReportRecord,
  sameTeamReportPayload,
  validateTeamReportRecord
} from '../../team/assets/0.10.0/team-report-contract.mjs';

function record(overrides = {}) {
  return buildTeamReportRecord({
    teamMatchId: 'team-report-test',
    individualMatchId: 'm01',
    recordId: '2026-0902-abcd',
    savedAt: 1788336000000,
    byteLength: 3,
    sha256: 'a'.repeat(64),
    json: '{}\n',
    ...overrides
  });
}

test('report backup schema v1 валидирует self-describing record', () => {
  const value = record();
  assert.equal(value.schemaVersion, TEAM_REPORT_SCHEMA_VERSION);
  assert.equal(value.teamMatchId, 'team-report-test');
  assert.equal(value.recordId, '2026-0902-abcd');
  assert.equal(value.byteLength, 3);
  assert.equal(TEAM_REPORT_MAX_JSON_BYTES, 1024 * 1024);
  assert.deepEqual(validateTeamReportRecord(value), value);
});

test('path identity должна совпадать с Team binding', () => {
  const value = record();
  const binding = {
    teamMatchId: 'team-report-test', individualMatchId: 'm01', ttScoreMatchId: '2026-0902-abcd'
  };
  assert.deepEqual(assertTeamReportRecordIdentity(value, binding), value);
  assert.throws(() => assertTeamReportRecordIdentity(value, { ...binding, individualMatchId: 'm02' }), /individualMatchId/);
  assert.throws(() => assertTeamReportRecordIdentity(value, { ...binding, ttScoreMatchId: '2026-0902-beef' }), /recordId/);
});

test('idempotent equality игнорирует только savedAt', () => {
  const first = record({ savedAt: 1000 });
  const retry = record({ savedAt: 2000 });
  assert.equal(sameTeamReportPayload(first, retry), true);
  assert.equal(sameTeamReportPayload(first, record({ savedAt: 2000, sha256: 'b'.repeat(64) })), false);
  assert.equal(sameTeamReportPayload(first, record({ savedAt: 2000, json: '{ }\n', byteLength: 4 })), false);
});

test('report backup отклоняет лишние поля и превышение size guard', () => {
  assert.throws(() => validateTeamReportRecord({ ...record(), extra: true }), /набор полей/);
  assert.throws(() => record({ byteLength: TEAM_REPORT_MAX_JSON_BYTES + 1 }), /byteLength/);
  assert.throws(() => record({ recordId: '../secret' }), /recordId/);
  assert.throws(() => record({ sha256: 'A'.repeat(64) }), /sha256/);
});

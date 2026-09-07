import {
  createFirebaseIndividualMatchReport,
  observeFirebaseAuth,
  readFirebaseIndividualMatchReport,
  readFirebaseTeamMatch,
  signInFirebaseEditor,
  subscribeFirebaseTeamMatch,
  transactFirebaseTeamMatch
} from './firebase-source.mjs';
import {
  assignmentMatchesBinding, bindAssignment, finishedBindingApplied, rebaseBinding,
  prepareFinishedReportUpdate,
  prepareOperationalLiveUpdate,
  prepareTransition,
  teamAssignment,
  validateBoundState
} from './team-integration-contract.mjs';
import {
  assertTeamReportRecordIdentity,
  validateTeamReportRecord
} from './team-report-contract.mjs';

function requireTeam(raw, id) {
  if (!raw) throw new Error('Командная встреча не найдена в Firebase.');
  if (raw.id !== id) throw new Error('Team match id не совпадает с Firebase path.');
  return raw;
}

export async function readTeamContext(teamMatchId) {
  return teamAssignment(requireTeam(await readFirebaseTeamMatch(teamMatchId), teamMatchId));
}

export async function subscribeTeamContext(teamMatchId, onAssignment, onError) {
  return subscribeFirebaseTeamMatch(teamMatchId, raw => {
    try { onAssignment(teamAssignment(requireTeam(raw, teamMatchId))); }
    catch (error) { onError?.(error); }
  }, onError);
}

export async function observeTeamAuth(callback) {
  return observeFirebaseAuth(callback);
}

export async function signInTeamEditor(email, password) {
  return signInFirebaseEditor(email, password);
}

export function assignmentMatchesTeamBinding(assignment, binding) {
  return assignmentMatchesBinding(assignment, binding);
}

export function bindTeamAssignment(assignment, ttScoreState) {
  return bindAssignment(assignment, ttScoreState);
}

export function rebaseTeamBinding(assignment, binding, ttScoreState) {
  return rebaseBinding(assignment, binding, ttScoreState);
}

export function validateTeamBoundState(binding, ttScoreState) {
  return validateBoundState(binding, ttScoreState);
}

export async function backupTeamReport(teamMatchId, binding, ttScoreState, record) {
  if (!binding || binding.teamMatchId !== teamMatchId) throw new Error('Backup report: Team binding не совпадает с teamMatch.');
  validateBoundState(binding, ttScoreState);
  if (ttScoreState?.matchId !== binding.ttScoreMatchId) throw new Error('Backup report: ttScore matchId не совпадает с Team binding.');
  const validated = assertTeamReportRecordIdentity(record, binding);
  return createFirebaseIndividualMatchReport(teamMatchId, validated.recordId, validated);
}

export async function readTeamReport(teamMatchId, recordId) {
  const raw = await readFirebaseIndividualMatchReport(teamMatchId, recordId);
  if (!raw) throw new Error('Резервная копия отчёта не найдена в Firebase.');
  return validateTeamReportRecord(raw, { teamMatchId, recordId });
}

export async function publishTeamLive(teamMatchId, binding, ttScoreState, liveLinks) {
  const published = await transactFirebaseTeamMatch(teamMatchId, current => (
    prepareOperationalLiveUpdate(current, liveLinks, new Date().toISOString(), binding, ttScoreState).data
  ));
  return teamAssignment(published);
}

export async function publishTeamFinished(teamMatchId, binding, ttScoreState, result, reportUrl = undefined) {
  validateBoundState(binding, ttScoreState);
  if (ttScoreState?.matchId !== binding?.ttScoreMatchId) throw new Error('ttScore matchId не совпадает с сохранённым Team binding.');
  const published = await transactFirebaseTeamMatch(teamMatchId, current => {
    if (finishedBindingApplied(current, binding, result, reportUrl)) return current;
    if (reportUrl !== undefined && finishedBindingApplied(current, binding, result)) {
      return prepareFinishedReportUpdate(current, binding, result, reportUrl, new Date().toISOString()).data;
    }
    const transitionInput = reportUrl === undefined ? result : { ...result, reportUrl };
    return prepareTransition(current, transitionInput, new Date().toISOString(), undefined, binding, ttScoreState).data;
  });
  return { teamMatch: published, assignment: teamAssignment(published) };
}

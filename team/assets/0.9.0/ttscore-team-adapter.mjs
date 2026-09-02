import {
  observeFirebaseAuth,
  readFirebaseTeamMatch,
  signInFirebaseEditor,
  subscribeFirebaseTeamMatch,
  transactFirebaseTeamMatch
} from './firebase-source.mjs';
import {
  assignmentMatchesBinding, bindAssignment, finishedBindingApplied, rebaseBinding,
  prepareOperationalLiveUpdate,
  prepareTransition,
  teamAssignment,
  validateBoundState
} from './team-integration-contract.mjs';

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

export async function publishTeamLive(teamMatchId, binding, ttScoreState, liveLinks) {
  const published = await transactFirebaseTeamMatch(teamMatchId, current => (
    prepareOperationalLiveUpdate(current, liveLinks, new Date().toISOString(), binding, ttScoreState).data
  ));
  return teamAssignment(published);
}

export async function publishTeamFinished(teamMatchId, binding, ttScoreState, result) {
  const published = await transactFirebaseTeamMatch(teamMatchId, current => {
    if (finishedBindingApplied(current, binding, result)) return current;
    return prepareTransition(current, result, new Date().toISOString(), undefined, binding, ttScoreState).data;
  });
  return { teamMatch: published, assignment: teamAssignment(published) };
}

import { AppState } from '../types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || 'Request failed');
  }
  return res.json();
}

// ─── Full state (for polling) ───

export async function fetchState(): Promise<AppState> {
  return request<AppState>('/state');
}

// ─── Auth ───

export async function adminLogin(username: string, password: string): Promise<{ success: boolean; username?: string }> {
  return request('/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function participantLogin(id: string): Promise<{ success: boolean; participant?: any }> {
  return request('/auth/participant-login', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

// ─── Participants ───

export async function addParticipant(name: string, id: string) {
  return request('/participants', {
    method: 'POST',
    body: JSON.stringify({ id, name }),
  });
}

export async function updateParticipant(id: string, name: string) {
  return request(`/participants/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function deleteParticipant(id: string) {
  return request(`/participants/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ─── Admins ───

export async function addAdmin(username: string, password: string) {
  return request('/admins', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function updateAdmin(username: string, password: string) {
  return request(`/admins/${encodeURIComponent(username)}`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  });
}

export async function deleteAdmin(username: string) {
  return request(`/admins/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  });
}

// ─── Question Pool ───

export async function uploadToPool(imageUrl: string, contributorId: string) {
  return request('/question-pool', {
    method: 'POST',
    body: JSON.stringify({ imageUrl, contributorId }),
  });
}

export async function deleteFromPool(id: string) {
  return request(`/question-pool/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ─── Rounds ───

export async function createRound(roundNumber: number, participantIds: string[]) {
  return request('/rounds', {
    method: 'POST',
    body: JSON.stringify({ roundNumber, participantIds }),
  });
}

export async function revealAndStart(roundId: string) {
  return request(`/rounds/${encodeURIComponent(roundId)}/reveal`, {
    method: 'POST',
  });
}

export async function completeRound(roundId: string) {
  return request(`/rounds/${encodeURIComponent(roundId)}/complete`, {
    method: 'POST',
  });
}

// ─── Submissions ───

export async function updateSubmissionImage(roundId: string, participantId: string, imageUrl: string) {
  return request(`/submissions/${encodeURIComponent(roundId)}/${encodeURIComponent(participantId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ imageUrl }),
  });
}

export async function rateSubmission(submissionId: string, score: number, voterNickname: string) {
  return request(`/submissions/${encodeURIComponent(submissionId)}/rate`, {
    method: 'POST',
    body: JSON.stringify({ voterNickname, score }),
  });
}

const INGESTION_STORAGE_KEY = 'ontology-explorer-ingestion-jobs';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function shouldUseMock() {
  return import.meta.env.VITE_USE_MOCK_INGESTION === 'true' || !API_BASE_URL;
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

function readJobs() {
  return JSON.parse(localStorage.getItem(INGESTION_STORAGE_KEY) || '[]');
}

function writeJobs(jobs) {
  localStorage.setItem(INGESTION_STORAGE_KEY, JSON.stringify(jobs));
}

export async function submitIngestionJob(payload) {
  if (!shouldUseMock()) {
    return requestJson('/ingestion/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const jobs = readJobs();
  const job = {
    id: crypto.randomUUID(),
    status: 'queued',
    sourceType: payload.sourceType,
    sourceName: payload.sourceName,
    entitiesDetected: Math.max(1, payload.content.split(/\s+/).filter(Boolean).length % 17),
    createdAt: new Date().toISOString(),
  };

  jobs.unshift(job);
  writeJobs(jobs.slice(0, 50));
  return job;
}

export async function listIngestionJobs() {
  if (!shouldUseMock()) {
    const data = await requestJson('/ingestion/jobs');
    return Array.isArray(data) ? data : data.jobs || [];
  }

  return readJobs();
}

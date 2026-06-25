const INGESTION_STORAGE_KEY = 'ontology-explorer-ingestion-jobs';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function shouldUseMock() {
  return import.meta.env.VITE_USE_MOCK_INGESTION === 'true';
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

/**
 * Upload a CSV / XLSX / XLS / JSON file to the backend.
 * The backend parses it, writes nodes + relationships to Neo4j (super4j),
 * and returns an import summary.
 */
export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/ingestion/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    // Do NOT set Content-Type manually — browser sets it with boundary automatically
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  if (!response.ok) {
    if (data?.missing_columns || data?.unexpected_columns) {
      const err = new Error(data.error || 'Schema Validation Failed');
      err.validationDetails = data;
      throw err;
    }
    throw new Error(data?.error || `Upload failed with status ${response.status}`);
  }

  return data;
}

/**
 * Fetch the list of previously uploaded documents.
 */
export async function listUploadHistory() {
  const data = await requestJson('/ingestion/uploads');
  return Array.isArray(data) ? data : data.uploads || [];
}

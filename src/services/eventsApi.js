const EVENTS_STORAGE_KEY = 'ontology-explorer-events';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function shouldUseMock() {
  return import.meta.env.VITE_USE_MOCK_EVENTS === 'true' || !API_BASE_URL;
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

function readEvents() {
  return JSON.parse(localStorage.getItem(EVENTS_STORAGE_KEY) || '[]');
}

function writeEvents(events) {
  localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
}

export async function recordEvent(event) {
  if (!shouldUseMock()) {
    return requestJson('/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  const events = readEvents();
  const storedEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source: 'frontend',
    ...event,
  };

  events.unshift(storedEvent);
  writeEvents(events.slice(0, 250));
  return storedEvent;
}

export async function searchEvents({ query = '', type = 'all' } = {}) {
  if (!shouldUseMock()) {
    const params = new URLSearchParams({ q: query, type });
    const data = await requestJson(`/events/search?${params.toString()}`);
    return Array.isArray(data) ? data : data.events || [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  return readEvents()
    .filter((event) => {
      const typeMatches = type === 'all' || event.type === type;
      const textMatches =
        !normalizedQuery ||
        JSON.stringify(event).toLowerCase().includes(normalizedQuery);
      return typeMatches && textMatches;
    })
    .slice(0, 50);
}

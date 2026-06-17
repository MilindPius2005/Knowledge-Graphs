import {
  expandNodeMock,
  expandRecursiveMock,
  searchNodesMock,
  filterEmployeesMock,
  getDepartmentsMock,
  getSkillsMock,
} from './ontologyMock.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function shouldUseMock() {
  // Use mock when explicitly enabled, or when no backend URL is provided.
  const v = import.meta.env.VITE_USE_MOCK_ONTOLOGY;
  if (v === 'true') return true;
  if (!API_BASE_URL) return true;
  return false;
}

async function requestGraph(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  const data = await response.json();

  return {
    nodes: Array.isArray(data.nodes) ? data.nodes : [],
    links: Array.isArray(data.links) ? data.links : [],
  };
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

export function expandNode(node) {
  if (shouldUseMock()) {
    return Promise.resolve(expandNodeMock(node));
  }

  return requestGraph(`/expand/${encodeURIComponent(node)}`);
}

export function searchNode(node) {
  return expandNode(node);
}

export async function searchNodes(query) {
  if (shouldUseMock()) {
    return Promise.resolve(searchNodesMock(query));
  }

  const params = new URLSearchParams({ q: query });

  const data = await requestJson(`/search?${params.toString()}`);

  const results = Array.isArray(data) ? data : data.results;

  return Array.isArray(results)
    ? results.map((result) => ({
        id: result.id || result.name,
        type: result.type || 'Unknown',
        description: result.description || result.summary || '',
      }))
    : [];
}

/*
 * FIXED: Must return a Promise because SearchBar.jsx uses:
 * getDepartments().then(...)
 */
export function getDepartments() {
  if (shouldUseMock()) {
    return Promise.resolve(getDepartmentsMock());
  }

  // Replace with requestJson('/departments')
  // when Flask endpoint is implemented
  return Promise.resolve([]);
}

/*
 * FIXED: Must return a Promise because SearchBar.jsx uses:
 * getSkills().then(...)
 */
export function getSkills() {
  if (shouldUseMock()) {
    return Promise.resolve(getSkillsMock());
  }

  // Replace with requestJson('/skills')
  // when Flask endpoint is implemented
  return Promise.resolve([]);
}

export async function filterEmployees({ name, department, skill }) {
  if (shouldUseMock()) {
    return filterEmployeesMock({
      name,
      department,
      skill,
    });
  }

  // Replace with backend endpoint later if needed
  return [];
}

export function expandRecursive(node, depth = 2) {
  if (shouldUseMock()) {
    return Promise.resolve(expandRecursiveMock(node, depth));
  }

  return requestGraph(
    `/expand_recursive/${encodeURIComponent(node)}/${depth}`
  );
}
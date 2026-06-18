const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function userHeaders(username) {
  return username ? { 'X-Ontology-User': username } : {};
}

async function requestGraph(path, username) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: userHeaders(username),
  });

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
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export function expandNode(node, username) {
  return requestGraph(`/expand/${encodeURIComponent(node)}`, username);
}

export function searchNode(node) {
  return expandNode(node);
}

export async function searchNodes(query) {
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

export function getDepartments() {
  return requestJson('/departments');
}

export function getSkills() {
  return requestJson('/skills');
}

export async function filterEmployees({ name, department, skill }) {
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  if (department) params.set('department', department);
  if (skill) params.set('skill', skill);

  const data = await requestJson(`/employees?${params.toString()}`);
  const results = Array.isArray(data) ? data : data.results;
  return Array.isArray(results) ? results : [];
}

export function expandRecursive(node, depth = 2, username) {
  return requestGraph(
    `/expand_recursive/${encodeURIComponent(node)}/${depth}`,
    username
  );
}

export function getNodeOverride(node, username) {
  return requestJson(`/overrides/${encodeURIComponent(node)}`, {
    headers: userHeaders(username),
  });
}

export function saveNodeOverride(node, username, override) {
  return requestJson(`/overrides/${encodeURIComponent(node)}`, {
    method: 'PUT',
    headers: userHeaders(username),
    body: JSON.stringify(override),
  });
}

export function resetNodeOverride(node, username) {
  return requestJson(`/overrides/${encodeURIComponent(node)}`, {
    method: 'DELETE',
    headers: userHeaders(username),
  });
}

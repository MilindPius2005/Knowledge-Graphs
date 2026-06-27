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

function normalizeResult(result) {
  return {
    id: result.id || result.name,
    label: result.label || result.id || result.name,
    type: result.type || 'Unknown',
    description: result.description || result.summary || '',
  };
}

export async function searchNodes(query, username) {
  const params = new URLSearchParams({ q: query });

  const data = await requestJson(`/search?${params.toString()}`, {
    headers: userHeaders(username),
  });

  const results = Array.isArray(data) ? data : data.results;

  return Array.isArray(results) ? results.map(normalizeResult) : [];
}

export function getDepartments(username) {
  return requestJson('/departments', {
    headers: userHeaders(username),
  });
}

export function getSkills(username) {
  return requestJson('/skills', {
    headers: userHeaders(username),
  });
}

export function getFilterOptions(username) {
  return requestJson('/filter-options', {
    headers: userHeaders(username),
  });
}

export async function filterEmployees(filters = {}, username) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value).trim());
    }
  });

  const data = await requestJson(`/employees?${params.toString()}`, {
    headers: userHeaders(username),
  });
  const results = Array.isArray(data) ? data : data.results;
  return Array.isArray(results) ? results.map(normalizeResult) : [];
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

export function publishNodeOverride(node, username) {
  return requestJson('/admin-change-requests', {
    method: 'POST',
    headers: userHeaders(username),
    body: JSON.stringify({ node }),
  });
}

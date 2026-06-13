import { expandNodeMock, expandRecursiveMock } from './ontologyMock.js';

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

export function expandNode(node) {
  if (shouldUseMock()) return Promise.resolve(expandNodeMock(node));
  return requestGraph(`/expand/${encodeURIComponent(node)}`);
}

export function searchNode(node) {
  return expandNode(node);
}

export function expandRecursive(node, depth = 2) {
  if (shouldUseMock()) return Promise.resolve(expandRecursiveMock(node, depth));
  return requestGraph(`/expand_recursive/${encodeURIComponent(node)}/${depth}`);
}


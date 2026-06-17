const ontology = {
  Milind: { type: 'Employee', neighbors: ['Rahul', 'IT', 'Python', 'React'] },
  Rahul: { type: 'Employee', neighbors: ['Anjali', 'IT', 'Python', 'Neo4j'] },
  Anjali: { type: 'Employee', neighbors: ['IT', 'Management', 'PMP'] },
  Python: { type: 'Skill', neighbors: ['Azure Fundamentals', 'PCAP'] },
  React: { type: 'Skill', neighbors: ['Frontend Certification'] },
  Neo4j: { type: 'Skill', neighbors: ['Neo4j Professional'] },
  IT: { type: 'Department', neighbors: ['Milind', 'Rahul', 'Anjali'] },
  'Azure Fundamentals': { type: 'Certification', neighbors: ['Microsoft'] },
  PCAP: { type: 'Certification', neighbors: ['Python Institute'] },
  'Frontend Certification': { type: 'Certification', neighbors: ['Meta'] },
  'Neo4j Professional': { type: 'Certification', neighbors: ['Neo4j Inc'] },
  Management: { type: 'Skill', neighbors: ['PMP'] },
  PMP: { type: 'Certification', neighbors: ['PMI'] },
  Microsoft: { type: 'Company', neighbors: [] },
  'Python Institute': { type: 'Organization', neighbors: [] },
  Meta: { type: 'Company', neighbors: [] },
  'Neo4j Inc': { type: 'Company', neighbors: [] },
  PMI: { type: 'Organization', neighbors: [] },
};

function findCanonicalNodeName(input) {
  if (typeof input !== 'string') return null;
  const query = input.trim().toLowerCase();
  if (!query) return null;

  const match = Object.keys(ontology).find((k) => k.toLowerCase() === query);
  return match || null;
}

function generateGraph(nodeName) {
  const canonicalName = findCanonicalNodeName(nodeName) || nodeName;
  const node = ontology[canonicalName];
  if (!node) {
    return { nodes: [], links: [], error: `Node '${nodeName}' not found` };
  }

  const nodes = [{ id: canonicalName, type: node.type }];
  const links = [];

  for (const neighbor of node.neighbors) {
    const neighborData = ontology[neighbor];
    nodes.push({
      id: neighbor,
      type: neighborData ? neighborData.type : 'Unknown',
    });

    links.push({ source: nodeName, target: neighbor });
  }

  return { nodes, links };
}

function expandRecursive(nodeName, depth) {
  const canonicalName = findCanonicalNodeName(nodeName) || nodeName;
  const visited = new Set();
  const nodeMap = new Map();
  const links = [];
  const linkSet = new Set();

  function dfs(currentNode, currentDepth) {
    if (currentDepth > depth) return;

    const nodeData = ontology[currentNode];
    if (!nodeData) return;

    // Add current node once
    if (!nodeMap.has(currentNode)) {
      nodeMap.set(currentNode, {
        id: currentNode,
        type: nodeData.type,
      });
    }

    if (visited.has(currentNode)) return;
    visited.add(currentNode);

    for (const neighbor of nodeData.neighbors) {
      const neighborData = ontology[neighbor];

      // Skip invalid neighbors
      if (!neighborData) continue;

      // Add neighbor node immediately
      if (!nodeMap.has(neighbor)) {
        nodeMap.set(neighbor, {
          id: neighbor,
          type: neighborData.type,
        });
      }

      // Prevent duplicate links
      const linkKey = `${currentNode}->${neighbor}`;

      if (!linkSet.has(linkKey)) {
        linkSet.add(linkKey);

        links.push({
          source: currentNode,
          target: neighbor,
        });
      }

      dfs(neighbor, currentDepth + 1);
    }
  }

  dfs(canonicalName, 0);

  const nodes = Array.from(nodeMap.values());

  return {
    nodes,
    links,
  };
}
export function expandNodeMock(node) {
  return generateGraph(node);
}

export function expandRecursiveMock(node, depth = 2) {
  return expandRecursive(node, depth);
}

export function searchNodesMock(query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return [];

  return Object.entries(ontology)
    .filter(([id, node]) => {
      return id.toLowerCase().includes(normalizedQuery) || node.type.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 8)
    .map(([id, node]) => ({
      id,
      type: node.type,
      description: `${node.type} node`,
    }));
}


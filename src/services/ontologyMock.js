const ontology = {
  // =============================
  // Employees (10–15)
  // =============================
  'Milind Sharma': { type: 'Employee', neighbors: ['IT', 'Python', 'SQL', 'AWS', 'Docker', 'React'] },
  'Rahul Verma': { type: 'Employee', neighbors: ['IT', 'Java', 'SQL', 'AWS', 'Docker', 'Flask'] },
  'Anjali Mehta': { type: 'Employee', neighbors: ['IT', 'Python', 'Machine Learning', 'Data Analysis', 'AWS', 'SQL'] },
  'Suman Iyer': { type: 'Employee', neighbors: ['Data Science', 'Machine Learning', 'Python', 'Data Analysis', 'SQL', 'AWS'] },
  'Rohit Nair': { type: 'Employee', neighbors: ['Data Science', 'Neo4j', 'Data Analysis', 'SQL', 'Docker', 'AWS'] },
  'Priya Kulkarni': { type: 'Employee', neighbors: ['HR', 'React', 'Data Analysis', 'SQL', 'Docker'] },
  'Vikram Singh': { type: 'Employee', neighbors: ['Finance', 'SQL', 'Data Analysis', 'Docker', 'AWS'] },
  'Neha Gupta': { type: 'Employee', neighbors: ['Marketing', 'React', 'Docker', 'AWS', 'Data Analysis'] },
  'Karan Joshi': { type: 'Employee', neighbors: ['Operations', 'Docker', 'AWS', 'SQL', 'Python'] },
  'Meera Rao': { type: 'Employee', neighbors: ['Sales', 'SQL', 'React', 'Data Analysis', 'AWS'] },
  'Arjun Rao': { type: 'Employee', neighbors: ['IT', 'Java', 'React', 'Docker', 'AWS', 'SQL'] },
  'Tanya Patel': { type: 'Employee', neighbors: ['HR', 'Machine Learning', 'Data Analysis', 'SQL'] },
  'Aditya Roy': { type: 'Employee', neighbors: ['Finance', 'Python', 'Flask', 'SQL', 'Data Analysis'] },
  'Ishaan Banerjee': { type: 'Employee', neighbors: ['Operations', 'Python', 'Docker', 'AWS', 'Data Analysis'] },

  // =============================
  // Departments
  // =============================
  'IT': {
    type: 'Department',
    neighbors: [
      'Milind Sharma',
      'Rahul Verma',
      'Anjali Mehta',
      'Arjun Rao',
    ],
  },
  'HR': { type: 'Department', neighbors: ['Priya Kulkarni', 'Tanya Patel'] },
  'Finance': { type: 'Department', neighbors: ['Vikram Singh', 'Aditya Roy'] },
  'Marketing': { type: 'Department', neighbors: ['Neha Gupta'] },
  'Operations': { type: 'Department', neighbors: ['Karan Joshi', 'Ishaan Banerjee'] },
  'Sales': { type: 'Department', neighbors: ['Meera Rao'] },
  'Data Science': {
    type: 'Department',
    neighbors: ['Suman Iyer', 'Rohit Nair', 'Anjali Mehta'],
  },

  // =============================
  // Skills
  // =============================
  Python: { type: 'Skill', neighbors: ['Flask', 'Machine Learning', 'Data Analysis', 'AWS', 'Neo4j'] },
  Java: { type: 'Skill', neighbors: ['Docker', 'SQL', 'AWS', 'React'] },
  React: { type: 'Skill', neighbors: ['Docker', 'AWS'] },
  Flask: { type: 'Skill', neighbors: ['AWS', 'Docker'] },
  Neo4j: { type: 'Skill', neighbors: ['Neo4j Professional', 'Neo4j Inc'] },
  SQL: { type: 'Skill', neighbors: ['Data Analysis', 'AWS'] },
  Docker: { type: 'Skill', neighbors: ['AWS'] },
  AWS: { type: 'Skill', neighbors: ['Data Analysis'] },
  'Machine Learning': { type: 'Skill', neighbors: ['Python', 'Data Analysis', 'Azure Fundamentals'] },
  'Data Analysis': { type: 'Skill', neighbors: ['Azure Fundamentals', 'PCAP'] },

  // =============================
  // Certifications / Orgs / Companies (minimal realistic links)
  // =============================
  'Azure Fundamentals': { type: 'Certification', neighbors: ['Microsoft'] },
  PCAP: { type: 'Certification', neighbors: ['Python Institute'] },
  'Neo4j Professional': { type: 'Certification', neighbors: ['Neo4j Inc'] },
  'PMP': { type: 'Certification', neighbors: ['PMI'] },

  Microsoft: { type: 'Company', neighbors: [] },
  'Python Institute': { type: 'Organization', neighbors: [] },
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

function getAllDepartments() {
  return Array.from(new Set(Object.entries(ontology)
    .filter(([, node]) => node.type === 'Department')
    .map(([id]) => id)
  )).sort((a, b) => a.localeCompare(b));
}

function getAllSkills() {
  return Array.from(new Set(Object.entries(ontology)
    .filter(([, node]) => node.type === 'Skill')
    .map(([id]) => id)
  )).sort((a, b) => a.localeCompare(b));
}

function normalize(s) {
  return String(s ?? '').trim().toLowerCase();
}

function getCanonical(input) {
  const q = normalize(input);
  if (!q) return null;
  return Object.keys(ontology).find((k) => k.toLowerCase() === q) || null;
}

function isMatch(filters, employeeId) {
  const nameFilter = normalize(filters.name);
  const deptFilter = normalize(filters.department);
  const skillFilter = normalize(filters.skill);

  const employeeCanonical = getCanonical(employeeId);
  if (!employeeCanonical) return false;

  if (nameFilter && employeeCanonical.toLowerCase() !== nameFilter) return false;

  // AND across filters. For dept/skill we treat them as ontology node names.
  if (deptFilter) {
    const deptCanonical = getCanonical(filters.department);
    if (!deptCanonical) return false;

    const deptNode = ontology[deptCanonical];
    if (!deptNode || deptNode.type !== 'Department') return false;

    if (!deptNode.neighbors.map(normalize).includes(employeeCanonical.toLowerCase())) return false;
  }

  if (skillFilter) {
    const skillCanonical = getCanonical(filters.skill);
    if (!skillCanonical) return false;

    const skillNode = ontology[skillCanonical];
    if (!skillNode || skillNode.type !== 'Skill') return false;

    // Employee has the skill if their direct neighbors include the Skill node.
    const employeeNode = ontology[employeeCanonical];
    if (!employeeNode || employeeNode.type !== 'Employee') return false;

    if (!employeeNode.neighbors.map(normalize).includes(skillCanonical.toLowerCase())) return false;
  }


  return true;
}

export function getDepartmentsMock() {
  return getAllDepartments();
}

export function getSkillsMock() {
  return getAllSkills();
}

export function filterEmployeesMock(filters = {}) {
  const name = normalize(filters.name);
  const department = normalize(filters.department);
  const skill = normalize(filters.skill);

  const hasAny = Boolean(name || department || skill);
  if (!hasAny) return [];

  const employees = Object.entries(ontology)
    .filter(([, node]) => node.type === 'Employee')
    .map(([id]) => id);

  const matches = employees.filter((empId) => isMatch({ name, department, skill }, empId));

  // Return matching employees as graph roots. Keep shape consistent with SearchBar results.
  return matches.slice(0, 8).map((id) => ({
    id,
    type: ontology[id]?.type || 'Employee',
    description: `Employee in selected filters`,
  }));
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



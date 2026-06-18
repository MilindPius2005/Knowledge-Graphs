import { useEffect, useState } from 'react';
import { getDepartments, getSkills } from '../services/ontologyApi.js';


export default function SearchBar({
  onSearch,
  onSelectResult,
  onGenerateKnowledgeGraph,
  isLoading,
  isSearching,
  rootNode,
  results,
  pendingGraphRoot,
  hasPendingResult,
}) {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [skill, setSkill] = useState('');

  const [departments, setDepartments] = useState([]);
  const [skills, setSkills] = useState([]);

  useEffect(() => {
    // Populate dropdowns through the ontology API adapter.
    getDepartments().then(setDepartments).catch(() => setDepartments([]));
    getSkills().then(setSkills).catch(() => setSkills([]));
  }, []);

  useEffect(() => {
    if (rootNode) setName(rootNode);
  }, [rootNode]);

  const hasAnyFilter = Boolean(name.trim() || department || skill);

  const handleGenerate = () => {
    // Keep UX consistent if button is disabled; no-op otherwise.
    if (hasPendingResult) onGenerateKnowledgeGraph();
  };


  function handleSubmit(event) {
    event.preventDefault();
    if (!hasAnyFilter) return;

    onSearch({
      name: name.trim() || undefined,
      department: department || undefined,
      skill: skill || undefined,
    });
  }

  return (
    <div className="search-wrap">
      <form className="search-bar" onSubmit={handleSubmit}>
        <div className="filters-grid">
          <div className="search-field">
            <span className="search-icon" aria-hidden="true">N</span>
            <input
              type="text"
              value={name}
              placeholder="Employee Name"
              onChange={(event) => setName(event.target.value)}
              aria-label="Employee name filter"
            />
          </div>

          <div className="search-field">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              aria-label="Department filter"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="search-field">
            <select
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              aria-label="Skill filter"
            >
              <option value="">All Skills</option>
              {skills.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="primary-button"
          type="submit"
          disabled={isLoading || isSearching || !hasAnyFilter}
        >
          {isSearching ? 'Searching' : 'Search'}
        </button>
      </form>


      {results.length ? (
        <div className="search-results" role="listbox" aria-label="Search results">
          <div className="search-results-actions">
            <button
              type="button"
              className="primary-button"
              onClick={onGenerateKnowledgeGraph}
              disabled={isLoading || isSearching || !hasPendingResult}
              title="Generate graph for the selected result"
            >
              Generate Knowledge Graph
            </button>
          </div>

          {results.map((result) => (
            <button
              key={`${result.id}-${result.type}`}
              type="button"
              className={`search-result ${pendingGraphRoot === result.id ? 'selected' : ''}`}
              onClick={() => onSelectResult(result)}
              aria-selected={pendingGraphRoot === result.id}
            >
              <span>
                <strong>{result.id}</strong>
                <small>{result.description || 'Select to generate graph'}</small>
              </span>
              <em>{result.type}</em>
            </button>
          ))}
        </div>
      ) : null}


    </div>
  );
}

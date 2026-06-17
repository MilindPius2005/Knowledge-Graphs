import { useEffect, useState } from 'react';

export default function SearchBar({
  onSearch,
  onSelectResult,
  isLoading,
  isSearching,
  rootNode,
  results,
}) {
  const [query, setQuery] = useState(rootNode || '');

  useEffect(() => {
    if (rootNode) setQuery(rootNode);
  }, [rootNode]);

  function handleSubmit(event) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <div className="search-wrap">
      <form className="search-bar" onSubmit={handleSubmit}>
        <div className="search-field">
          <span className="search-icon" aria-hidden="true">S</span>
          <input
            type="search"
            value={query}
            placeholder="Search employees, skills, departments..."
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search ontology node"
          />
        </div>
        <button className="primary-button" type="submit" disabled={isLoading || isSearching || !query.trim()}>
          {isSearching ? 'Searching' : 'Find Nodes'}
        </button>
      </form>

      {results.length ? (
        <div className="search-results" role="listbox" aria-label="Search results">
          {results.map((result) => (
            <button
              key={`${result.id}-${result.type}`}
              type="button"
              className="search-result"
              onClick={() => onSelectResult(result)}
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

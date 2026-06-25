import { useEffect } from 'react';

export default function SearchBar({
  query = '',
  onQueryChange,
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
            type="text"
            value={query}
            placeholder="Search employees, skills, labels..."
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label="Search ontology"
          />
        </div>

        <button className="primary-button" type="submit" disabled={isLoading || isSearching}>
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

          {results.map((result) => {
            const displayName = result.label || result.id;
            return (
              <button
                key={`${result.id}-${result.type}`}
                type="button"
                className={`search-result ${pendingGraphRoot === result.id ? 'selected' : ''}`}
                onClick={() => onSelectResult(result)}
                aria-selected={pendingGraphRoot === result.id}
              >
                <span>
                  <strong>{displayName}</strong>
                  <small>
                    {displayName !== result.id ? `Original: ${result.id}` : result.description || 'Select to generate graph'}
                  </small>
                </span>
                <em>{result.type}</em>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

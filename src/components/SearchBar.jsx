import { useState } from 'react';

export default function SearchBar({ onSearch, isLoading, rootNode }) {
  const [query, setQuery] = useState(rootNode || '');

  function handleSubmit(event) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-field">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          value={query}
          placeholder="Search employees, skills, departments..."
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search ontology node"
        />
      </div>
      <button className="primary-button" type="submit" disabled={isLoading || !query.trim()}>
        {isLoading ? 'Searching' : 'Search'}
      </button>
    </form>
  );
}

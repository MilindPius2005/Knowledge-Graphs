import { useEffect, useState } from 'react';
import { searchEvents } from '../services/eventsApi.js';

export default function EventsPanel() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    searchEvents({ query, type })
      .then((results) => {
        if (isMounted) setEvents(results);
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message || 'Unable to load events.');
      });

    return () => {
      isMounted = false;
    };
  }, [query, type]);

  return (
    <section className="utility-panel">
      <div className="panel-header">
        <div>
          <div className="section-heading">Elastic Event Search</div>
          <h2>Event Handling and Storage</h2>
        </div>
        <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Event type">
          <option value="all">All events</option>
          <option value="search_performed">Searches</option>
          <option value="graph_expanded">Graph expansions</option>
          <option value="ingestion_submitted">Ingestion</option>
        </select>
      </div>

      <div className="search-field utility-search">
        <span className="search-icon" aria-hidden="true">S</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search indexed events..."
          aria-label="Search events"
        />
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="event-list">
        {events.length ? (
          events.map((event) => (
            <article className="event-row" key={event.id}>
              <div>
                <strong>{event.type}</strong>
                <span>{new Date(event.timestamp).toLocaleString()}</span>
              </div>
              <code>{JSON.stringify(event)}</code>
            </article>
          ))
        ) : (
          <p className="empty-copy">No events match the current filters.</p>
        )}
      </div>
    </section>
  );
}

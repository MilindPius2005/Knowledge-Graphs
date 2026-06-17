import { useEffect, useState } from 'react';
import { recordEvent } from '../services/eventsApi.js';
import { listIngestionJobs, submitIngestionJob } from '../services/ingestionApi.js';

export default function IngestionPanel() {
  const [sourceType, setSourceType] = useState('csv');
  const [sourceName, setSourceName] = useState('');
  const [content, setContent] = useState('');
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listIngestionJobs().then(setJobs).catch(() => setJobs([]));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const job = await submitIngestionJob({ sourceType, sourceName, content });
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      recordEvent({
        type: 'ingestion_submitted',
        jobId: job.id,
        sourceType,
        sourceName,
      }).catch(() => {});
      setContent('');
    } catch (requestError) {
      setError(requestError.message || 'Unable to submit ingestion job.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="utility-panel">
      <div className="panel-header">
        <div>
          <div className="section-heading">Ingestion Pipeline</div>
          <h2>Load Ontology Sources</h2>
        </div>
      </div>

      <form className="ingestion-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            <span>Source Type</span>
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="hris">HRIS Export</option>
              <option value="events">Event Stream</option>
            </select>
          </label>
          <label>
            <span>Source Name</span>
            <input
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              placeholder="employee-skills.csv"
              required
            />
          </label>
        </div>

        <label>
          <span>Payload</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Paste source rows, JSON, or event samples..."
            required
          />
        </label>

        {error ? <div className="error-banner">{error}</div> : null}

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting' : 'Submit Job'}
        </button>
      </form>

      <div className="job-list">
        {jobs.length ? (
          jobs.map((job) => (
            <article className="job-row" key={job.id}>
              <div>
                <strong>{job.sourceName}</strong>
                <span>{job.sourceType}</span>
              </div>
              <em>{job.status}</em>
              <small>{job.entitiesDetected} entities</small>
            </article>
          ))
        ) : (
          <p className="empty-copy">No ingestion jobs have been submitted.</p>
        )}
      </div>
    </section>
  );
}

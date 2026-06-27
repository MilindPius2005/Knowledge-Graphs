import { useCallback, useEffect, useRef, useState } from 'react';
import { recordEvent } from '../services/eventsApi.js';
import {
  listIngestionJobs,
  listUploadHistory,
  submitIngestionJob,
  uploadDocument,
} from '../services/ingestionApi.js';

const ACCEPTED_TYPES = '.csv,.xlsx,.xls,.json';
const ACCEPTED_MIME = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
];

function FileIcon({ ext }) {
  const colors = { csv: '#22d3a5', xlsx: '#34d399', xls: '#34d399', json: '#f59e0b' };
  const color = colors[ext] || '#8ea0b6';
  return (
    <span className="file-type-badge" style={{ color, borderColor: color }}>
      {ext?.toUpperCase() || 'FILE'}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString();
}

export default function IngestionPanel({ onUploadSuccess, username }) {
  // ── Upload tab state ──────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [schemaErrors, setSchemaErrors] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);
  const fileInputRef = useRef(null);

  // ── Legacy job form state ─────────────────────────────────────
  const [sourceType, setSourceType] = useState('csv');
  const [sourceName, setSourceName] = useState('');
  const [content, setContent] = useState('');
  const [jobs, setJobs] = useState([]);
  const [jobError, setJobError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Active sub-tab ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('upload');

  useEffect(() => {
    listIngestionJobs(username).then(setJobs).catch(() => setJobs([]));
    listUploadHistory(username).then(setUploadHistory).catch(() => setUploadHistory([]));
  }, [username]);

  // ── File selection helpers ────────────────────────────────────
  function validateFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const okExt = ['csv', 'xlsx', 'xls', 'json'].includes(ext);
    const okMime = ACCEPTED_MIME.includes(file.type) || file.type === '';
    if (!okExt) return `Unsupported file type ".${ext}". Use CSV, XLSX, XLS or JSON.`;
    return null;
  }

  function pickFile(file) {
    setUploadError('');
    setSchemaErrors(null);
    setUploadResult(null);
    const err = validateFile(file);
    if (err) { setUploadError(err); return; }
    setSelectedFile(file);
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) pickFile(file);
  }, []);

  const onDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);

  // ── Upload handler ────────────────────────────────────────────
  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');
    setSchemaErrors(null);
    setUploadResult(null);
    setUploadProgress(10);

    // Fake smooth progress while waiting for server
    const ticker = setInterval(() => {
      setUploadProgress((p) => Math.min(p + 8, 88));
    }, 300);

    try {
      const result = await uploadDocument(selectedFile, username);
      clearInterval(ticker);
      setUploadProgress(100);
      setUploadResult(result);
      setUploadHistory((prev) => [result, ...prev]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      recordEvent({
        type: 'document_uploaded',
        filename: result.filename,
        rows: result.totalRows,
        nodes: result.totalNodes,
        relationships: result.totalRelationships,
      }).catch(() => {});
      // Notify parent to refresh sidebar filters with new data
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      clearInterval(ticker);
      setUploadProgress(0);
      
      if (err.validationDetails) {
        setSchemaErrors(err.validationDetails);
        setUploadError('Schema Validation Failed');
      } else {
        let msg = err.message || 'Upload failed.';
        try { msg = JSON.parse(msg)?.error || msg; } catch { /* keep raw */ }
        setUploadError(msg);
      }
    } finally {
      setUploading(false);
    }
  }

  // ── Legacy job submit ─────────────────────────────────────────
  async function handleJobSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setJobError('');
    try {
      const job = await submitIngestionJob({ sourceType, sourceName, content }, username);
      setJobs((cur) => [job, ...cur.filter((j) => j.id !== job.id)]);
      recordEvent({ type: 'ingestion_submitted', jobId: job.id, sourceType, sourceName }).catch(() => {});
      setContent('');
    } catch (err) {
      setJobError(err.message || 'Unable to submit ingestion job.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const fileExt = selectedFile?.name.split('.').pop().toLowerCase();

  return (
    <section className="utility-panel ingestion-panel">
      <div className="panel-header">
        <div>
          <div className="section-heading">Ingestion Pipeline</div>
          <h2>Load Ontology Sources</h2>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="ingestion-tabs">
        <button
          className={`ingestion-tab${activeTab === 'upload' ? ' active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📁 Upload Document
        </button>
        <button
          className={`ingestion-tab${activeTab === 'manual' ? ' active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          ✏️ Manual Entry
        </button>
      </div>

      {/* ── UPLOAD TAB ─────────────────────────────────────────── */}
      {activeTab === 'upload' && (
        <div className="upload-tab">
          <p className="upload-description">
            Upload any <strong>CSV</strong>, <strong>Excel (.xlsx / .xls)</strong>, or{' '}
            <strong>JSON</strong> file. Rows are automatically converted into Neo4j nodes and
            relationships in <strong>super4j</strong> and become instantly searchable in the
            Explorer.
          </p>

          {/* Drop zone */}
          <div
            className={`upload-zone${dragOver ? ' drag-over' : ''}${selectedFile ? ' has-file' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
            />

            {selectedFile ? (
              <div className="upload-zone-file">
                <FileIcon ext={fileExt} />
                <div className="upload-zone-file-info">
                  <strong>{selectedFile.name}</strong>
                  <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
                <button
                  className="upload-zone-clear"
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setUploadResult(null); setUploadError(''); }}
                  title="Remove file"
                >✕</button>
              </div>
            ) : (
              <div className="upload-zone-prompt">
                <div className="upload-icon">⬆</div>
                <p><strong>Drag &amp; drop</strong> a file here, or <span className="upload-link">click to browse</span></p>
                <p className="upload-formats">Supported: CSV · XLSX · XLS · JSON</p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="upload-progress-wrap">
              <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
              <span className="upload-progress-label">
                {uploadProgress < 90 ? 'Parsing & writing to Neo4j…' : 'Finalising…'}
              </span>
            </div>
          )}

          {/* Error */}
          {uploadError && !schemaErrors && (
            <div className="upload-error">
              <span className="upload-error-icon">⚠</span>
              <span>{uploadError}</span>
            </div>
          )}

          {/* Schema Validation Error Details */}
          {schemaErrors && (
            <div className="schema-error">
              <div className="schema-error-header">
                <span className="schema-error-icon">✗</span>
                <strong>Schema Validation Failed</strong>
              </div>
              <p className="schema-error-text">Please upload a file that matches the approved ontology schema.</p>
              
              {schemaErrors.missing_columns?.length > 0 && (
                <div className="schema-error-section">
                  <strong>Missing Required Columns:</strong>
                  <ul>
                    {schemaErrors.missing_columns.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
              )}
              
              {schemaErrors.unexpected_columns?.length > 0 && (
                <div className="schema-error-section">
                  <strong>Unexpected Columns:</strong>
                  <ul>
                    {schemaErrors.unexpected_columns.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Success summary */}
          {uploadResult && (
            <div className="import-summary">
              <div className="import-summary-header">
                <span className="import-summary-icon">✓</span>
                <strong>Import complete — <em>{uploadResult.filename}</em></strong>
              </div>
              <div className="import-summary-grid">
                <div className="import-stat">
                  <span className="import-stat-value">{uploadResult.totalRows}</span>
                  <span className="import-stat-label">Rows processed</span>
                </div>
                <div className="import-stat">
                  <span className="import-stat-value">{uploadResult.totalNodes}</span>
                  <span className="import-stat-label">Nodes in Neo4j</span>
                </div>
                <div className="import-stat">
                  <span className="import-stat-value">{uploadResult.totalRelationships}</span>
                  <span className="import-stat-label">Relationships</span>
                </div>
              </div>
              <div className="import-columns">
                <span>Columns detected:</span>
                {uploadResult.columns?.map((c) => (
                  <span key={c} className="import-column-tag">{c}</span>
                ))}
              </div>
              <p className="import-hint">
                🔍 Switch to the <strong>Explorer</strong> tab and search for any value from
                the <strong>{uploadResult.primaryEntity}</strong> column to see the graph.
              </p>
            </div>
          )}

          {/* Process button */}
          <button
            className="primary-button upload-submit-btn"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? 'Importing…' : '⬆  Process & Import into Neo4j'}
          </button>

          {/* Upload history */}
          {uploadHistory.length > 0 && (
            <div className="upload-history">
              <h3 className="upload-history-title">Upload History</h3>
              <div className="upload-history-list">
                {uploadHistory.map((u) => (
                  <div className="upload-history-row" key={u.id}>
                    <FileIcon ext={u.filename?.split('.').pop()} />
                    <div className="upload-history-info">
                      <strong>{u.filename}</strong>
                      <span>{formatDate(u.uploadedAt)}</span>
                    </div>
                    <div className="upload-history-stats">
                      <span>{u.totalRows} rows</span>
                      <span>{u.totalNodes} nodes</span>
                      <span>{u.totalRelationships} rels</span>
                    </div>
                    <span className={`upload-status-badge ${u.status}`}>{u.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL ENTRY TAB ───────────────────────────────────── */}
      {activeTab === 'manual' && (
        <>
          <form className="ingestion-form" onSubmit={handleJobSubmit}>
            <div className="form-grid">
              <label>
                <span>Source Type</span>
                <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
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
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="employee-skills.csv"
                  required
                />
              </label>
            </div>
            <label>
              <span>Payload</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste source rows, JSON, or event samples…"
                required
              />
            </label>
            {jobError ? <div className="error-banner">{jobError}</div> : null}
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit Job'}
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
        </>
      )}
    </section>
  );
}

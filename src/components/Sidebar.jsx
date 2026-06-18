import NodeOverrideEditor from './NodeOverrideEditor.jsx';

const typeLabels = {
  Employee: 'Employee',
  Department: 'Department',
  Skill: 'Skill',
  Certification: 'Certification',
  Organization: 'Organization',
  Company: 'Company',
};

export default function Sidebar({
  selectedDetails,
  recursiveMode,
  onRecursiveModeChange,
  rootNode,
  graph,
  username,
  onOverrideChanged,
}) {
  const { node, connectedCount, parentNode } = selectedDetails;

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">OE</div>
        <div>
          <h1>Ontology Explorer</h1>
          <p>{rootNode ? `Root: ${rootNode}` : 'Ready to explore'}</p>
        </div>
      </div>

      <section className="sidebar-section">
        <div className="section-heading">Expansion</div>
        <div className="mode-toggle" role="group" aria-label="Expansion mode">
          <button
            type="button"
            className={!recursiveMode ? 'active' : ''}
            onClick={() => onRecursiveModeChange(false)}
          >
            Normal
          </button>
          <button
            type="button"
            className={recursiveMode ? 'active' : ''}
            onClick={() => onRecursiveModeChange(true)}
          >
            Recursive
          </button>
        </div>
      </section>

      <section className="sidebar-section">
        <div className="section-heading">Selected Node</div>
        {node ? (
          <>
            <div className="details-panel">
              <div>
                <span>Name</span>
                <strong>{node.label || node.id}</strong>
                {node.label && node.label !== node.id ? <small>Original: {node.id}</small> : null}
              </div>
              <div>
                <span>Type</span>
                <strong>{typeLabels[node.type] || node.type || 'Unknown'}</strong>
              </div>
              <div>
                <span>Connected Nodes</span>
                <strong>{connectedCount}</strong>
              </div>
              <div>
                <span>Parent Node</span>
                <strong>{parentNode || 'None'}</strong>
              </div>
            </div>
            <NodeOverrideEditor
              node={node}
              username={username}
              onChanged={onOverrideChanged}
            />
          </>
        ) : (
          <p className="empty-copy">Select a node to inspect its ontology context.</p>
        )}
      </section>

      <section className="sidebar-section">
        <div className="section-heading">Graph Summary</div>
        <div className="summary-grid">
          <div>
            <strong>{graph.nodes.length}</strong>
            <span>Nodes</span>
          </div>
          <div>
            <strong>{graph.links.length}</strong>
            <span>Links</span>
          </div>
        </div>
      </section>

      <section className="sidebar-section legend-section">
        <div className="section-heading">Types</div>
        {['Employee', 'Department', 'Skill', 'Certification', 'Organization', 'Company'].map((type) => (
          <div className="legend-item" key={type}>
            <span className={`legend-dot type-${type.toLowerCase()}`} />
            <span>{type}</span>
          </div>
        ))}
      </section>
    </aside>
  );
}

import NodeOverrideEditor from './NodeOverrideEditor.jsx';
import DatasetFilters from './DatasetFilters.jsx';
import SearchBar from './SearchBar.jsx';

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
  filters,
  onFiltersChange,
  searchProps,
  rootNode,
  graph,
  username,
  onOverrideChanged,
  filterRefreshKey,
  onResetGraph,
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

      {searchProps ? (
        <section className="sidebar-section sidebar-search-section">
          <div className="section-heading">Search</div>
          <SearchBar {...searchProps} />
        </section>
      ) : null}

      <DatasetFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        refreshKey={filterRefreshKey}
        username={username}
        onResetGraph={onResetGraph}
      />

      {graph && graph.nodes && graph.nodes.length > 0 ? (
        <>
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

          <section className="sidebar-section legend-section">
            <div className="section-heading">Types</div>
            {['Employee', 'Department', 'Skill', 'Certification', 'Organization', 'Company'].map((type) => (
              <div className="legend-item" key={type}>
                <span className={`legend-dot type-${type.toLowerCase()}`} />
                <span>{type}</span>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </aside>
  );
}

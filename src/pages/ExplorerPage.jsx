import { useRef, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import OntologyGraph from '../components/OntologyGraph.jsx';
import GraphControls from '../components/GraphControls.jsx';
import AppNavigation from '../components/AppNavigation.jsx';
import EventsPanel from '../components/EventsPanel.jsx';
import IngestionPanel from '../components/IngestionPanel.jsx';
import UserPage from '../components/UserPage.jsx';
import { useOntologyExplorer } from '../hooks/useOntologyExplorer.js';

export default function ExplorerPage({ user, onLogout }) {
  const graphRef = useRef(null);
  const [activeView, setActiveView] = useState('explorer');
  const [filterRefreshKey, setFilterRefreshKey] = useState(0);
  const explorer = useOntologyExplorer(user.email);

  function renderWorkspace() {
    if (activeView === 'events') return <EventsPanel />;
    if (activeView === 'ingestion') return (
      <IngestionPanel
        username={user.email}
        onUploadSuccess={() => setFilterRefreshKey((k) => k + 1)}
      />
    );
    if (activeView === 'user') return <UserPage user={user} onLogout={onLogout} />;

    return (
      <div className="graph-shell">
        <GraphControls
          onCenter={() => graphRef.current?.centerGraph()}
          onResetZoom={() => graphRef.current?.resetZoom()}
          onExpandSelected={explorer.expandSelected}
          onBack={explorer.goBack}
          onForward={explorer.goForward}
          canGoBack={explorer.canGoBack}
          canGoForward={explorer.canGoForward}
          hasSelection={Boolean(explorer.selectedNode)}
        />
        <OntologyGraph
          ref={graphRef}
          graph={explorer.graph}
          selectedNode={explorer.selectedNode}
          rootNode={explorer.rootNode}
          onNodeSelect={explorer.setSelectedNode}
          onNodeExpand={(node) => explorer.expandNodeInGraph(node.id)}
          onNodeCollapse={(node) => explorer.collapseNodeInGraph(node.id)}
          expandedNodeIds={explorer.expandedNodeIds}
          isLoading={explorer.isLoading}
        />
      </div>
    );
  }

  return (
    <main className="app-shell">
      <Sidebar
        selectedDetails={explorer.selectedDetails}
        filters={explorer.filters}
        onFiltersChange={explorer.setFilters}
        searchProps={{
          query: explorer.searchQuery,
          onQueryChange: explorer.setSearchQuery,
          onSearch: explorer.handleSearch,
          onSelectResult: explorer.selectSearchResult,
          isLoading: explorer.isLoading,
          isSearching: explorer.isSearching,
          rootNode: explorer.rootDisplayName,
          results: explorer.searchResults,
          pendingGraphRoot: explorer.pendingGraphRoot,
          onGenerateKnowledgeGraph: explorer.generateKnowledgeGraph,
          hasPendingResult: Boolean(explorer.pendingGraphRoot),
        }}
        rootNode={explorer.rootNode}
        graph={explorer.graph}
        username={user.email}
        filterRefreshKey={filterRefreshKey}
        onOverrideChanged={() => {
          if (explorer.rootNode) {
            explorer.loadGraph(explorer.rootNode, { pushHistory: false });
          }
        }}
      />

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-main">
            <AppNavigation activeView={activeView} onViewChange={setActiveView} user={user} />
          </div>
          {explorer.error ? <div className="error-banner">{explorer.error}</div> : null}
        </header>

        {renderWorkspace()}
      </section>
    </main>
  );
}

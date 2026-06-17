import { useRef, useState } from 'react';
import SearchBar from '../components/SearchBar.jsx';
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
  const explorer = useOntologyExplorer();

  function renderWorkspace() {
    if (activeView === 'events') return <EventsPanel />;
    if (activeView === 'ingestion') return <IngestionPanel />;
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
          onNodeExpand={(node) => explorer.loadGraph(node.id)}
          isLoading={explorer.isLoading}
        />
      </div>
    );
  }

  return (
    <main className="app-shell">
      <Sidebar
        selectedDetails={explorer.selectedDetails}
        recursiveMode={explorer.recursiveMode}
        onRecursiveModeChange={explorer.setRecursiveMode}
        rootNode={explorer.rootNode}
        graph={explorer.graph}
      />

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-main">
            <AppNavigation activeView={activeView} onViewChange={setActiveView} user={user} />
            {activeView === 'explorer' ? (
              <SearchBar
                onSearch={explorer.handleSearch}
                onSelectResult={explorer.selectSearchResult}
                isLoading={explorer.isLoading}
                isSearching={explorer.isSearching}
                rootNode={explorer.rootNode}
                results={explorer.searchResults}
              />
            ) : null}
          </div>
          {explorer.error ? <div className="error-banner">{explorer.error}</div> : null}
        </header>

        {renderWorkspace()}
      </section>
    </main>
  );
}

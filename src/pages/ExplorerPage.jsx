import { useRef } from 'react';
import SearchBar from '../components/SearchBar.jsx';
import Sidebar from '../components/Sidebar.jsx';
import OntologyGraph from '../components/OntologyGraph.jsx';
import GraphControls from '../components/GraphControls.jsx';
import { useOntologyExplorer } from '../hooks/useOntologyExplorer.js';

export default function ExplorerPage() {
  const graphRef = useRef(null);
  const explorer = useOntologyExplorer();

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
          <SearchBar
            onSearch={explorer.handleSearch}
            isLoading={explorer.isLoading}
            rootNode={explorer.rootNode}
          />
          {explorer.error ? <div className="error-banner">{explorer.error}</div> : null}
        </header>

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
      </section>
    </main>
  );
}

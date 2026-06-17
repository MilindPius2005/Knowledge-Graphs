import { useCallback, useMemo, useState } from 'react';
import { expandNode, expandRecursive, searchNodes } from '../services/ontologyApi.js';
import { recordEvent } from '../services/eventsApi.js';

function getNodeId(value) {
  return typeof value === 'object' ? value.id : value;
}

function getParentNode(graph, selectedNode) {
  if (!selectedNode) return null;
  const selectedId = selectedNode.id;
  const incoming = graph.links.find((link) => getNodeId(link.target) === selectedId);
  return incoming ? getNodeId(incoming.source) : null;
}

function getConnectedCount(graph, selectedNode) {
  if (!selectedNode) return 0;
  const selectedId = selectedNode.id;

  return graph.links.filter((link) => {
    const source = getNodeId(link.source);
    const target = getNodeId(link.target);
    return source === selectedId || target === selectedId;
  }).length;
}

export function useOntologyExplorer() {
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [rootNode, setRootNode] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [recursiveMode, setRecursiveMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState('');

  const loadGraph = useCallback(
    async (nodeId, options = {}) => {
      const cleanNode = nodeId.trim();
      if (!cleanNode) return;

      const useRecursive = options.recursiveMode ?? recursiveMode;
      setIsLoading(true);
      setError('');

      try {
        const data = useRecursive ? await expandRecursive(cleanNode, 2) : await expandNode(cleanNode);

        setGraph(data);
        setRootNode(data.nodes[0]?.id || cleanNode);
        setSelectedNode(
          data.nodes.find((node) => String(node.id).toLowerCase() === cleanNode.toLowerCase()) ||
            data.nodes[0] ||
            null
        );

        if (options.pushHistory !== false) {
          setHistory((current) => {
            const next = current.slice(0, historyIndex + 1);
            next.push({ nodeId: cleanNode, recursiveMode: useRecursive });
            return next;
          });
          setHistoryIndex((index) => index + 1);
        }

        recordEvent({
          type: 'graph_expanded',
          nodeId: cleanNode,
          recursiveMode: useRecursive,
          nodeCount: data.nodes.length,
          linkCount: data.links.length,
        }).catch(() => {});
      } catch (requestError) {
        setError(requestError.message || 'Unable to load ontology graph.');
      } finally {
        setIsLoading(false);
      }
    },
    [historyIndex, recursiveMode]
  );

  const handleSearch = useCallback(
    async (query) => {
      const cleanQuery = query.trim();
      if (!cleanQuery) return;

      setIsSearching(true);
      setError('');

      try {
        const results = await searchNodes(cleanQuery);
        setSearchResults(results);
        recordEvent({
          type: 'search_performed',
          query: cleanQuery,
          resultCount: results.length,
        }).catch(() => {});
      } catch (requestError) {
        setError(requestError.message || 'Unable to search ontology nodes.');
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  const selectSearchResult = useCallback(
    (result) => {
      setSearchResults([]);
      loadGraph(result.id, { recursiveMode: false });
    },
    [loadGraph]
  );

  const expandSelected = useCallback(() => {
    if (selectedNode) {
      loadGraph(selectedNode.id);
    }
  }, [loadGraph, selectedNode]);

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    const entry = history[nextIndex];
    setHistoryIndex(nextIndex);
    setRecursiveMode(entry.recursiveMode);
    loadGraph(entry.nodeId, {
      recursiveMode: entry.recursiveMode,
      pushHistory: false,
    });
  }, [history, historyIndex, loadGraph]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const entry = history[nextIndex];
    setHistoryIndex(nextIndex);
    setRecursiveMode(entry.recursiveMode);
    loadGraph(entry.nodeId, {
      recursiveMode: entry.recursiveMode,
      pushHistory: false,
    });
  }, [history, historyIndex, loadGraph]);

  const selectedDetails = useMemo(
    () => ({
      node: selectedNode,
      connectedCount: getConnectedCount(graph, selectedNode),
      parentNode: getParentNode(graph, selectedNode),
    }),
    [graph, selectedNode]
  );

  return {
    graph,
    rootNode,
    selectedNode,
    selectedDetails,
    recursiveMode,
    isLoading,
    isSearching,
    searchResults,
    error,
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < history.length - 1,
    setSelectedNode,
    setRecursiveMode,
    loadGraph,
    handleSearch,
    selectSearchResult,
    expandSelected,
    goBack,
    goForward,
  };
}

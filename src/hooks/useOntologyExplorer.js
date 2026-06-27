import { useCallback, useEffect, useMemo, useState } from 'react';
import { expandNode, searchNodes, filterEmployees } from '../services/ontologyApi.js';
import { recordEvent } from '../services/eventsApi.js';

function getNodeId(value) {
  return typeof value === 'object' ? value.id : value;
}

function getParentNode(graph, selectedNode) {
  if (!selectedNode) return null;
  const selectedId = selectedNode.id;
  const links = Array.isArray(graph?.links) ? graph.links : [];
  const incoming = links.find((link) => getNodeId(link.target) === selectedId);

  return incoming ? getNodeId(incoming.source) : null;
}

function getConnectedCount(graph, selectedNode) {
  if (!selectedNode) return 0;
  const selectedId = selectedNode.id;

  const links = Array.isArray(graph?.links) ? graph.links : [];

  return links
    .filter((link) => {
      const source = getNodeId(link.source);
      const target = getNodeId(link.target);
      return source === selectedId || target === selectedId;
    })
    .length;
}

function hasValue(value) {
  if (typeof value === 'boolean') return value;
  return Boolean(String(value ?? '').trim());
}

function normalizeGraph(data) {
  return {
    nodes: Array.isArray(data?.nodes) ? data.nodes : [],
    links: Array.isArray(data?.links) ? data.links : [],
  };
}

function mergeGraphs(currentGraph, nextGraph) {
  const nodeMap = new Map();
  const linkMap = new Map();

  [...(currentGraph.nodes || []), ...(nextGraph.nodes || [])].forEach((node) => {
    nodeMap.set(node.id, { ...(nodeMap.get(node.id) || {}), ...node });
  });

  [...(currentGraph.links || []), ...(nextGraph.links || [])].forEach((link) => {
    const source = getNodeId(link.source);
    const target = getNodeId(link.target);
    if (!source || !target) return;
    const key = `${source}->${target}`;
    linkMap.set(key, { ...(linkMap.get(key) || {}), ...link, source, target });
  });

  return {
    nodes: Array.from(nodeMap.values()),
    links: Array.from(linkMap.values()),
  };
}

export function useOntologyExplorer(username) {
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [rootNode, setRootNode] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState(() => new Set());
  const [filters, setFilters] = useState({
    ssl: false,
    benchMin: '',
    benchMax: '',
    clientName: '',
    deploymentStatus: '',
    employee: '',
    campusLateral: '',
    skillGroup: '',
    skill: '',
  });
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState('');

  const [pendingGraphRoot, setPendingGraphRoot] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (rootNode) {
      const root = graph.nodes.find((node) => node.id === rootNode);
      setSearchQuery(root?.label || rootNode);
    }
  }, [rootNode, graph.nodes]);

  const handleDatabaseEmptyError = useCallback((message) => {
    if (message && message.includes('Database is empty')) {
      setGraph({ nodes: [], links: [] });
      setRootNode('');
      setSelectedNode(null);
      setExpandedNodeIds(new Set());
      setHistory([]);
      setHistoryIndex(-1);
      setSearchResults([]);
      setPendingGraphRoot(null);
    }
  }, []);

  const loadGraph = useCallback(
    async (nodeId, options = {}) => {
      const cleanNode = nodeId.trim();
      if (!cleanNode) return;

      setIsLoading(true);
      setError('');

      try {
        const data = await expandNode(cleanNode, username);
        const normalizedGraph = normalizeGraph(data);

        setGraph(normalizedGraph);
        setRootNode(normalizedGraph.nodes[0]?.id || cleanNode);
        setExpandedNodeIds(new Set([normalizedGraph.nodes[0]?.id || cleanNode]));


        setSelectedNode(
          data.nodes.find((node) => String(node.id).toLowerCase() === cleanNode.toLowerCase()) ||
            data.nodes[0] ||
            null
        );

        if (options.pushHistory !== false) {
          setHistory((current) => {
            const next = current.slice(0, historyIndex + 1);
            next.push({ nodeId: cleanNode });
            return next;
          });
          setHistoryIndex((index) => index + 1);
        }

        recordEvent({
          type: 'graph_expanded',
          nodeId: cleanNode,
          recursiveMode: false,
          nodeCount: normalizedGraph.nodes.length,
          linkCount: normalizedGraph.links.length,
        }).catch(() => {});
      } catch (requestError) {
        const msg = requestError.message || 'Unable to load ontology graph.';
        setError(msg);
        handleDatabaseEmptyError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [historyIndex, username, handleDatabaseEmptyError]
  );

  const handleSearch = useCallback(async (query = '') => {
    setIsSearching(true);
    setError('');
    setPendingGraphRoot(null);

    try {
      const cleanQuery = query.trim();
      const activeFilters = {
        ...filters,
        ssl: filters.ssl ? 'true' : '',
        query: cleanQuery || undefined,
      };
      const hasActiveFilters = Object.values(activeFilters).some(hasValue);
      const hasSidebarFilters = Object.values(filters).some(hasValue);

      if (!hasActiveFilters) {
        setSearchResults([]);
        setPendingGraphRoot(null);
        return;
      }

      if (cleanQuery && !hasSidebarFilters) {
        const results = await searchNodes(cleanQuery, username);
        setSearchResults(results);
        setPendingGraphRoot(results[0]?.id ?? null);
        recordEvent({
          type: 'search_performed',
          query: cleanQuery,
          resultCount: results.length,
        }).catch(() => {});
        return;
      }

      const results = await filterEmployees(activeFilters, username);
      setSearchResults(results);
      setPendingGraphRoot(results[0]?.id ?? null);

      recordEvent({
        type: 'filter_search_performed',
        filters: activeFilters,
        resultCount: results.length,
      }).catch(() => {});
    } catch (requestError) {
      const msg = requestError.message || 'Unable to search ontology nodes.';
      setError(msg);
      handleDatabaseEmptyError(msg);
    } finally {
      setIsSearching(false);
    }
  }, [filters, username, handleDatabaseEmptyError]);

  const selectSearchResult = useCallback((result) => {
    setPendingGraphRoot(result?.id ?? null);
  }, []);

  // Trigger search automatically when filters or searchQuery changes
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, searchQuery, handleSearch]);

  const expandNodeInGraph = useCallback(
    async (nodeId) => {
      const cleanNode = String(nodeId || '').trim();
      if (!cleanNode) return;

      if (expandedNodeIds.has(cleanNode)) {
        setSelectedNode((current) => {
          if (current?.id === cleanNode) return current;
          return graph.nodes.find((node) => node.id === cleanNode) || { id: cleanNode, label: cleanNode, type: 'Unknown' };
        });
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const data = await expandNode(cleanNode, username);
        const nextGraph = normalizeGraph(data);

        setGraph((currentGraph) => mergeGraphs(currentGraph, nextGraph));
        setExpandedNodeIds((current) => new Set([...current, cleanNode]));
        setSelectedNode(nextGraph.nodes.find((node) => node.id === cleanNode) || null);

        recordEvent({
          type: 'graph_expanded',
          nodeId: cleanNode,
          recursiveMode: false,
          nodeCount: nextGraph.nodes.length,
          linkCount: nextGraph.links.length,
        }).catch(() => {});
      } catch (requestError) {
        const msg = requestError.message || 'Unable to expand ontology node.';
        setError(msg);
        handleDatabaseEmptyError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [expandedNodeIds, graph.nodes, username]
  );

  /**
   * Collapse a previously-expanded node:
   * - The node itself STAYS in the graph.
   * - ALL descendants (children, grandchildren, …) that are only reachable
   *   through this node are removed recursively.
   * - The node goes back to "unexpanded" state so it can be re-expanded later.
   */
  const collapseNodeInGraph = useCallback(
    (nodeId) => {
      const cleanNode = String(nodeId || '').trim();
      if (!cleanNode) return;

      setGraph((currentGraph) => {
        const { nodes, links } = currentGraph;

        // Build a directed-outgoing adjacency map (source → targets)
        // to find all descendants of cleanNode
        const outgoing = new Map(nodes.map((n) => [n.id, []]));
        links.forEach((link) => {
          const s = getNodeId(link.source);
          const t = getNodeId(link.target);
          outgoing.get(s)?.push(t);
          // treat links as bidirectional for descendant detection
          outgoing.get(t)?.push(s);
        });

        // BFS from cleanNode to collect all its descendants
        const descendants = new Set();
        const q = [...(outgoing.get(cleanNode) || [])];
        while (q.length) {
          const cur = q.shift();
          if (cur === cleanNode || descendants.has(cur)) continue;
          descendants.add(cur);
          (outgoing.get(cur) || []).forEach((nb) => {
            if (!descendants.has(nb) && nb !== cleanNode) q.push(nb);
          });
        }

        // Now determine which of those descendants are EXCLUSIVELY reachable
        // through cleanNode (i.e. have no path from root that bypasses cleanNode).
        // Build adjacency ignoring cleanNode and all its outgoing edges.
        const adjacency = new Map(nodes.map((n) => [n.id, []]));
        links.forEach((link) => {
          const s = getNodeId(link.source);
          const t = getNodeId(link.target);
          // Cut every edge that involves cleanNode
          if (s === cleanNode || t === cleanNode) return;
          adjacency.get(s)?.push(t);
          adjacency.get(t)?.push(s);
        });

        // BFS from root with cleanNode isolated
        const reachableWithoutCollapsed = new Set();
        const bfsQ = [rootNode];
        reachableWithoutCollapsed.add(rootNode);
        while (bfsQ.length) {
          const cur = bfsQ.shift();
          (adjacency.get(cur) || []).forEach((nb) => {
            if (!reachableWithoutCollapsed.has(nb)) {
              reachableWithoutCollapsed.add(nb);
              bfsQ.push(nb);
            }
          });
        }

        // Nodes to remove: descendants that are NOT reachable without cleanNode
        const toRemove = new Set(
          [...descendants].filter((id) => !reachableWithoutCollapsed.has(id))
        );

        // Always keep cleanNode itself
        toRemove.delete(cleanNode);

        const survivingNodes = nodes.filter((n) => !toRemove.has(n.id));
        const survivingIds = new Set(survivingNodes.map((n) => n.id));
        const survivingLinks = links.filter((link) => {
          const s = getNodeId(link.source);
          const t = getNodeId(link.target);
          return survivingIds.has(s) && survivingIds.has(t);
        });

        return { nodes: survivingNodes, links: survivingLinks };
      });

      // Mark cleanNode AND all nodes it expanded as unexpanded
      // so clicking any of them again expands fresh
      setExpandedNodeIds((current) => {
        const next = new Set(current);
        next.delete(cleanNode);
        return next;
      });

      recordEvent({ type: 'graph_collapsed', nodeId: cleanNode }).catch(() => {});
    },
    [rootNode]
  );


  const generateKnowledgeGraph = useCallback(() => {
    if (!pendingGraphRoot) return;
    const graphRoot = pendingGraphRoot;
    setError('');
    setSearchResults([]);
    setPendingGraphRoot(null);
    loadGraph(graphRoot);
  }, [loadGraph, pendingGraphRoot]);

  const expandSelected = useCallback(() => {
    if (selectedNode) {
      expandNodeInGraph(selectedNode.id);
    }
  }, [expandNodeInGraph, selectedNode]);

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    const entry = history[nextIndex];
    setHistoryIndex(nextIndex);
    loadGraph(entry.nodeId, {
      pushHistory: false,
    });
  }, [history, historyIndex, loadGraph]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const entry = history[nextIndex];
    setHistoryIndex(nextIndex);
    loadGraph(entry.nodeId, {
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

  const rootDisplayName = useMemo(() => {
    const root = graph.nodes.find((node) => node.id === rootNode);
    return root?.label || rootNode;
  }, [graph.nodes, rootNode]);

  return {
    graph,
    rootNode,
    rootDisplayName,
    selectedNode,
    selectedDetails,
    pendingGraphRoot,
    filters,
    isLoading,
    isSearching,
    searchResults,
    error,
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < history.length - 1,
    expandedNodeIds,
    searchQuery,

    setSelectedNode,
    setFilters,
    setSearchQuery,
    loadGraph,
    expandNodeInGraph,
    collapseNodeInGraph,
    handleSearch,
    selectSearchResult,
    expandSelected,
    goBack,
    goForward,
    generateKnowledgeGraph,
  };
}

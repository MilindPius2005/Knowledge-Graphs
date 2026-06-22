import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as d3 from 'd3';

const NODE_STYLES = {
  Employee: { color: '#58a6ff', radius: 18 },
  Department: { color: '#a78bfa', radius: 15 },
  Skill: { color: '#36d399', radius: 13 },
  Certification: { color: '#f6c85f', radius: 12 },
  Organization: { color: '#ff7a90', radius: 16 },
  Company: { color: '#2dd4bf', radius: 16 },
  default: { color: '#94a3b8', radius: 12 },
};

function getStyle(type) {
  return NODE_STYLES[type] || NODE_STYLES.default;
}

function normalizeGraph(graph) {
  return {
    nodes: graph.nodes.map((node) => ({ ...node })),
    links: graph.links.map((link) => ({ ...link })),
  };
}

function getLinkNodeId(value) {
  return typeof value === 'object' ? value.id : value;
}

function buildStructuredLayout(nodes, links, rootNode, width, height) {
  const validNodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map(nodes.map((node) => [node.id, []]));

  links.forEach((link) => {
    const source = getLinkNodeId(link.source);
    const target = getLinkNodeId(link.target);
    if (!validNodeIds.has(source) || !validNodeIds.has(target)) return;
    adjacency.get(source).push(target);
    adjacency.get(target).push(source);
  });

  const start = validNodeIds.has(rootNode) ? rootNode : nodes[0]?.id;
  const depthById = new Map();
  const queue = [];

  if (start) {
    depthById.set(start, 0);
    queue.push(start);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const currentDepth = depthById.get(current);
    adjacency.get(current).forEach((neighbor) => {
      if (depthById.has(neighbor)) return;
      depthById.set(neighbor, currentDepth + 1);
      queue.push(neighbor);
    });
  }

  nodes.forEach((node) => {
    if (!depthById.has(node.id)) {
      depthById.set(node.id, Math.max(1, depthById.size));
    }
  });

  const columns = new Map();
  nodes.forEach((node) => {
    const depth = depthById.get(node.id) || 0;
    columns.set(depth, [...(columns.get(depth) || []), node]);
  });

  const orderedDepths = Array.from(columns.keys()).sort((a, b) => a - b);
  const horizontalGap = width / Math.max(orderedDepths.length + 1, 2);
  const positions = new Map();

  orderedDepths.forEach((depth, depthIndex) => {
    const columnNodes = columns.get(depth).sort((a, b) => {
      if (a.id === start) return -1;
      if (b.id === start) return 1;
      return (a.label || a.id).localeCompare(b.label || b.id);
    });
    const verticalGap = height / Math.max(columnNodes.length + 1, 2);
    const x = horizontalGap * (depthIndex + 1);

    columnNodes.forEach((node, nodeIndex) => {
      positions.set(node.id, {
        x,
        y: verticalGap * (nodeIndex + 1),
      });
    });
  });

  return positions;
}

const OntologyGraph = forwardRef(function OntologyGraph(
  { graph, selectedNode, rootNode, onNodeSelect, onNodeExpand, isLoading },
  ref
) {
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const layoutRef = useRef(new Map());

  useImperativeHandle(ref, () => ({
    centerGraph() {
      centerGraph();
    },
    resetZoom() {
      resetZoom();
    },
  }));

  function resetZoom() {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(450).call(zoomRef.current.transform, d3.zoomIdentity);
  }

  function centerGraph() {
    const wrapper = wrapperRef.current;
    if (!wrapper || !graph.nodes.length) return;

    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    const positions = Array.from(layoutRef.current.values());
    if (!positions.length) return;

    const bounds = positions.reduce(
      (acc, node) => ({
        minX: Math.min(acc.minX, node.x),
        maxX: Math.max(acc.maxX, node.x),
        minY: Math.min(acc.minY, node.y),
        maxY: Math.max(acc.maxY, node.y),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );

    const graphWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const graphHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const scale = Math.min(1.4, Math.max(0.35, 0.82 / Math.max(graphWidth / width, graphHeight / height)));
    const x = width / 2 - scale * (bounds.minX + graphWidth / 2);
    const y = height / 2 - scale * (bounds.minY + graphHeight / 2);

    d3.select(svgRef.current)
      .transition()
      .duration(600)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(x, y).scale(scale));
  }

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const svgElement = svgRef.current;
    if (!wrapper || !svgElement) return undefined;

    const svg = d3.select(svgElement);
    const { nodes, links } = normalizeGraph(graph);
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const defs = svg.append('defs');
    defs
      .append('filter')
      .attr('id', 'node-glow')
      .append('feGaussianBlur')
      .attr('stdDeviation', 4)
      .attr('result', 'coloredBlur');

    const container = svg.append('g').attr('class', 'zoom-layer');
    const linkLayer = container.append('g').attr('class', 'link-layer');
    const nodeLayer = container.append('g').attr('class', 'node-layer');
    const labelLayer = container.append('g').attr('class', 'label-layer');

    zoomRef.current = d3
      .zoom()
      .scaleExtent([0.25, 3])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoomRef.current);

    if (!nodes.length) {
      layoutRef.current = new Map();
      return undefined;
    }

    const nodeIds = new Set(nodes.map((n) => n.id));

    const validLinks = links.filter((link) => {
      const source = getLinkNodeId(link.source);
      const target = getLinkNodeId(link.target);

      return nodeIds.has(source) && nodeIds.has(target);
    });

    const positions = buildStructuredLayout(nodes, validLinks, rootNode, width, height);
    layoutRef.current = positions;

    function handleNodeClick(event, d) {
      event.stopPropagation();
      onNodeSelect(d);
      onNodeExpand(d);
    }

    const link = linkLayer
      .selectAll('line')
      .data(validLinks)
      .join('line')
      .attr('class', 'graph-link')
      .attr('x1', (d) => positions.get(getLinkNodeId(d.source))?.x || 0)
      .attr('y1', (d) => positions.get(getLinkNodeId(d.source))?.y || 0)
      .attr('x2', (d) => positions.get(getLinkNodeId(d.target))?.x || 0)
      .attr('y2', (d) => positions.get(getLinkNodeId(d.target))?.y || 0);

    const node = nodeLayer
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('class', (d) => {
        const classes = ['graph-node'];
        if (d.id === selectedNode?.id) classes.push('selected');
        if (d.id === rootNode) classes.push('root');
        return classes.join(' ');
      })
      .attr('r', (d) => getStyle(d.type).radius)
      .attr('fill', (d) => getStyle(d.type).color)
      .attr('cx', (d) => positions.get(d.id)?.x || 0)
      .attr('cy', (d) => positions.get(d.id)?.y || 0)
      .on('click', handleNodeClick);

    const label = labelLayer
      .selectAll('text')
      .data(nodes)
      .join('text')
      .attr('class', 'graph-label')
      .attr('dx', (d) => getStyle(d.type).radius + 8)
      .attr('dy', 4)
      .attr('x', (d) => positions.get(d.id)?.x || 0)
      .attr('y', (d) => positions.get(d.id)?.y || 0)
      .text((d) => d.label || d.id)
      .on('click', handleNodeClick);

    const statusBadge = labelLayer
      .selectAll('g.graph-status-badge')
      .data(nodes.filter((d) => d.type === 'Employee' && d.deploymentStatus))
      .join('g')
      .attr('class', 'graph-status-badge')
      .attr('transform', (d) => {
        const pos = positions.get(d.id) || { x: 0, y: 0 };
        return `translate(${pos.x + getStyle(d.type).radius + 8}, ${pos.y + 14})`;
      });

    statusBadge
      .append('rect')
      .attr('width', (d) => Math.max(78, String(d.deploymentStatus).length * 8 + 18))
      .attr('height', 20)
      .attr('rx', 5);

    statusBadge
      .append('text')
      .attr('x', 9)
      .attr('y', 14)
      .text((d) => `[${d.deploymentStatus}]`);

    statusBadge.on('click', handleNodeClick);

    const centerTimer = window.setTimeout(centerGraph, 650);

    return () => {
      window.clearTimeout(centerTimer);
    };
  }, [graph, onNodeExpand, onNodeSelect, rootNode, selectedNode?.id]);

  return (
    <div ref={wrapperRef} className="graph-stage">
      <svg ref={svgRef} className="graph-svg" role="img" aria-label="Ontology force-directed graph" />
      {!graph.nodes.length && !isLoading ? (
        <div className="graph-empty">
          <h2>Search a node to begin</h2>
          <p>Explore employees, skills, departments, certifications, and company relationships.</p>
        </div>
      ) : null}
      {isLoading ? <div className="graph-loading">Loading ontology...</div> : null}
    </div>
  );
});

export default OntologyGraph;

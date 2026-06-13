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

const OntologyGraph = forwardRef(function OntologyGraph(
  { graph, selectedNode, rootNode, onNodeSelect, onNodeExpand, isLoading },
  ref
) {
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const simulationRef = useRef(null);

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
    const nodes = simulationRef.current?.nodes() || [];
    const bounds = nodes.reduce(
      (acc, node) => ({
        minX: Math.min(acc.minX, node.x || 0),
        maxX: Math.max(acc.maxX, node.x || 0),
        minY: Math.min(acc.minY, node.y || 0),
        maxY: Math.max(acc.maxY, node.y || 0),
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

    simulationRef.current?.stop();
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
  return undefined;
}

const nodeIds = new Set(nodes.map((n) => n.id));

const validLinks = links.filter((link) => {
  const source =
    typeof link.source === 'object'
      ? link.source.id
      : link.source;

  const target =
    typeof link.target === 'object'
      ? link.target.id
      : link.target;

  return (
    nodeIds.has(source) &&
    nodeIds.has(target)
  );
});

const link = linkLayer
  .selectAll('line')
  .data(validLinks)
  .join('line')
  .attr('class', 'graph-link');
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
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeSelect(d);
        onNodeExpand(d);
      })
      .call(
        d3
          .drag()
          .on('start', (event, d) => {
            if (!event.active) simulationRef.current.alphaTarget(0.24).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulationRef.current.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    const label = labelLayer
      .selectAll('text')
      .data(nodes)
      .join('text')
      .attr('class', 'graph-label')
      .attr('dx', (d) => getStyle(d.type).radius + 8)
      .attr('dy', 4)
      .text((d) => d.id);

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(validLinks)
          .id((d) => d.id)
          .distance((d) => {
            const sourceType = typeof d.source === 'object' ? d.source.type : '';
            const targetType = typeof d.target === 'object' ? d.target.type : '';
            return sourceType === 'Employee' || targetType === 'Employee' ? 132 : 108;
          })
          .strength(0.72)
      )
      .force('charge', d3.forceManyBody().strength(-560))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d) => getStyle(d.type).radius + 18).iterations(3))
      .force('x', d3.forceX(width / 2).strength(0.035))
      .force('y', d3.forceY(height / 2).strength(0.035));

    simulationRef.current = simulation;

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);

      node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
      label.attr('x', (d) => d.x).attr('y', (d) => d.y);
    });

    const centerTimer = window.setTimeout(centerGraph, 650);

    return () => {
      window.clearTimeout(centerTimer);
      simulation.stop();
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

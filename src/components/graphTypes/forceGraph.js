// Grafo de fuerza (force-directed)
import * as d3 from 'd3';

export function renderForceGraph({ nodes, links }, container, width, height, onNodeClick) {
  d3.select(container).selectAll('*').remove();
  const genColor = d3.scaleLinear()
    .domain([0, d3.max(nodes, d => d.generation)])
    .range([0.2, 1]);
  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .call(d3.zoom().on('zoom', (event) => {
      g.attr('transform', event.transform);
    }));
  const g = svg.append('g');
  const link = g.append('g')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke-width', d => d.type === 'spouse' ? 2 : 1);
  const node = g.append('g')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', 7)
    .attr('fill', d => d.generation >= 0 ? d3.interpolateRainbow(genColor(d.generation)) : '#ccc')
    .call(d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      })
    )
    .on('click', (event, d) => {
      if (onNodeClick) onNodeClick(d);
    });
  const label = g.append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .attr('font-size', 12)
    .attr('dx', 10)
    .attr('dy', 4)
    .text(d => d.name);
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(d => d.type === 'spouse' ? 40 : 80))
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .on('tick', ticked);
  function ticked() {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);
    label
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  }
  return simulation;
}
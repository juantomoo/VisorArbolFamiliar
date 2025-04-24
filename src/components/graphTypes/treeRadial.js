// Árbol radial con D3
import * as d3 from 'd3';

export function renderTreeRadial(rootData, container, width, height, onNodeClick) {
  d3.select(container).selectAll('*').remove();
  const nodeCount = d3.hierarchy(rootData).descendants().length;
  const radius = Math.max(200, Math.min(width, height) / 2 - 60, nodeCount * 4);
  const tree = d3.tree().size([2 * Math.PI, radius]);
  const root = d3.hierarchy(rootData);
  tree(root);
  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .call(d3.zoom().on('zoom', (event) => {
      g.attr('transform', event.transform);
    }));
  const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);
  g.append('g')
    .attr('fill', 'none')
    .attr('stroke', '#555')
    .attr('stroke-opacity', 0.4)
    .attr('stroke-width', 1.2)
    .selectAll('path')
    .data(root.links())
    .join('path')
    .attr('d', d3.linkRadial().angle(d => d.x).radius(d => d.y));
  const node = g.append('g')
    .selectAll('g')
    .data(root.descendants())
    .join('g')
    .attr('transform', d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`);
  node.append('circle')
    // Use Vuetify theme colors or standard SVG fills
    .attr('fill', d => d.children ? 'var(--v-theme-primary)' : '#999')
    .attr('stroke', 'var(--v-theme-surface)')
    .attr('r', 7)
    .on('click', (event, d) => {
      if (onNodeClick) onNodeClick(d);
    });
  node.append('text')
    // Use Vuetify theme colors or standard SVG fills
    .attr('fill', 'var(--v-theme-on-surface)')
    .attr('dy', '0.31em')
    .attr('x', d => d.x < Math.PI === !d.children ? 8 : -8)
    .attr('text-anchor', d => d.x < Math.PI === !d.children ? 'start' : 'end')
    .attr('transform', d => d.x >= Math.PI ? 'rotate(180)' : null)
    .text(d => d.data.name);
}
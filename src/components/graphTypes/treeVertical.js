// Árbol vertical con D3
import * as d3 from 'd3';

export function renderTreeVertical(rootData, container, width, height, onNodeClick) {
  d3.select(container).selectAll('*').remove();
  const dx = 120, dy = 16;
  const tree = d3.tree().nodeSize([dx, dy]);
  const root = d3.hierarchy(rootData);
  tree(root);
  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .call(d3.zoom().on('zoom', (event) => {
      g.attr('transform', event.transform);
    }));
  const g = svg.append('g').attr('transform', `translate(${width / 2},40)`);
  g.append('g')
    .attr('fill', 'none')
    .attr('stroke', '#555')
    .attr('stroke-opacity', 0.4)
    .attr('stroke-width', 1.2)
    .selectAll('path')
    .data(root.links())
    .join('path')
    // Note: D3 linkHorizontal generates paths for vertical trees when x/y are swapped
    .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y));
  const node = g.append('g')
    .selectAll('g')
    .data(root.descendants())
    .join('g')
    .attr('transform', d => `translate(${d.x},${d.y})`);
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
    .attr('y', d => d.children ? -12 : 12)
    // Adjust text anchor based on position (not just children)
    .attr('text-anchor', 'middle') // Center text below/above node
    .text(d => d.data.name);
}
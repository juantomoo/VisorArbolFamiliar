// Árbol tipo reloj de arena (Hourglass)
import * as d3 from 'd3';

// Este layout muestra ancestros hacia arriba y descendientes hacia abajo desde un nodo central
export function renderHourglassGraph(centerNode, container, width, height, onNodeClick) {
  d3.select(container).selectAll('*').remove();
  // Se asume que centerNode tiene propiedades .ancestors y .descendants (debes construirlas en tu lógica)
  // Por simplicidad, aquí solo se muestra el nodo central
  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height);
  const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);
  // Nodo central
  g.append('circle')
    .attr('r', 14)
    .attr('fill', '#f90')
    .on('click', () => { if (onNodeClick) onNodeClick(centerNode); });
  g.append('text')
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--v-theme-on-surface)')
    .text(centerNode.name);
  // Aquí deberías dibujar los ancestros hacia arriba y descendientes hacia abajo
  // usando layouts de árbol vertical invertido y normal, conectando al nodo central
  // Este es solo un esqueleto para que completes la lógica según tu modelo de datos
}
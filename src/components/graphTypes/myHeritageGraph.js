// Gráfico estilo MyHeritage con D3
import * as d3 from 'd3';

/**
 * Renderiza un Árbol Reloj de Arena vertical (ascendientes arriba, descendientes abajo)
 * El nodo central es el individuo seleccionado.
 */
export function renderMyHeritageGraph(hierarchyRoot, container, width, height, onNodeClick) {
  d3.select(container).selectAll('*').remove();
  if (!hierarchyRoot || !hierarchyRoot.data) {
    container.innerHTML = '<p style="color: red; padding: 10px;">Error: Datos inválidos para el árbol genealógico.</p>';
    return;
  }
  const margin = { top: 40, right: 20, bottom: 40, left: 20 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  // --- Utilidades ---
  function getHermanos(node) {
    if (!node._parents || node._parents.length === 0) return [];
    const siblings = [];
    node._parents.forEach(parent => {
      if (parent.children) {
        parent.children.forEach(child => {
          if (child.id !== node.id && !siblings.some(s => s.id === child.id)) {
            siblings.push(child);
          }
        });
      }
    });
    return siblings;
  }
  function getConyuges(node) {
    return node.spouses || [];
  }
  // --- Construir subárboles ascendentes y descendentes ---
  function buildAscTree(node, visited = new Set()) {
    if (!node || !node._parents || visited.has(node.id)) return null;
    visited.add(node.id);
    return {
      name: node.name,
      id: node.id,
      raw: node.raw,
      children: node._parents.map(p => buildAscTree(p, visited)).filter(Boolean)
    };
  }
  function buildDescTree(node, visited = new Set()) {
    if (!node || !node.children || visited.has(node.id)) return null;
    visited.add(node.id);
    return {
      name: node.name,
      id: node.id,
      raw: node.raw,
      children: node.children.map(c => buildDescTree(c, visited)).filter(Boolean)
    };
  }
  // --- Preparar datos ---
  const central = hierarchyRoot.data;
  const hermanos = getHermanos(central);
  const conyuges = getConyuges(central);
  const ascRoot = buildAscTree(central, new Set([central.id]));
  const descRoot = buildDescTree(central, new Set([central.id]));
  // Layouts ascendentes y descendentes
  const ascLayout = ascRoot ? d3.tree().size([innerWidth * 0.5, innerHeight/2 - 40])(d3.hierarchy(ascRoot)) : null;
  const descLayout = descRoot ? d3.tree().size([innerWidth * 0.5, innerHeight/2 - 40])(d3.hierarchy(descRoot)) : null;
  // SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', [0, 0, width, height])
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('background-color', 'var(--graph-background)');
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  // --- Enlaces ascendentes ---
  if (ascLayout) {
    g.append('g')
      .selectAll('path')
      .data(ascLayout.links())
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', 'var(--graph-parent-link)')
      .attr('stroke-width', 1.5)
      .attr('d', d3.linkVertical()
        .x(d => d.x + innerWidth/4)
        .y(d => (innerHeight/2 - 40) - d.y)
      );
  }
  // --- Enlaces descendentes ---
  if (descLayout) {
    g.append('g')
      .selectAll('path')
      .data(descLayout.links())
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', 'var(--graph-child-link)')
      .attr('stroke-width', 1.5)
      .attr('d', d3.linkVertical()
        .x(d => d.x + innerWidth/4)
        .y(d => (innerHeight/2 + 40) + d.y)
      );
  }
  // --- Nodos ascendentes ---
  if (ascLayout) {
    const nodes = g.append('g')
      .selectAll('g')
      .data(ascLayout.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.x + innerWidth/4},${(innerHeight/2 - 40) - d.y})`);
    nodes.append('rect')
      .attr('width', 120)
      .attr('height', 40)
      .attr('x', -60)
      .attr('y', -20)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('fill', 'var(--graph-parent-node)')
      .attr('stroke', 'var(--graph-node-stroke)');
    nodes.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 0)
      .attr('fill', 'var(--graph-text)')
      .attr('font-weight', 'bold')
      .attr('font-size', '12px')
      .text(d => d.data.name || 'Desconocido');
  }
  // --- Nodos descendentes ---
  if (descLayout) {
    const nodes = g.append('g')
      .selectAll('g')
      .data(descLayout.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.x + innerWidth/4},${(innerHeight/2 + 40) + d.y})`);
    nodes.append('rect')
      .attr('width', 120)
      .attr('height', 40)
      .attr('x', -60)
      .attr('y', -20)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('fill', 'var(--graph-child-node)')
      .attr('stroke', 'var(--graph-node-stroke)');
    nodes.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 0)
      .attr('fill', 'var(--graph-text)')
      .attr('font-weight', 'bold')
      .attr('font-size', '12px')
      .text(d => d.data.name || 'Desconocido');
  }
  // --- Nodo central ---
  const centerY = innerHeight/2;
  const centerX = innerWidth/2;
  const centerGroup = g.append('g').attr('transform', `translate(${centerX},${centerY})`);
  centerGroup.append('rect')
    .attr('width', 130)
    .attr('height', 50)
    .attr('x', -65)
    .attr('y', -25)
    .attr('rx', 7)
    .attr('ry', 7)
    .attr('fill', 'var(--graph-primary-node)')
    .attr('stroke', 'var(--graph-node-stroke)');
  centerGroup.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 5)
    .attr('fill', 'var(--graph-text)')
    .attr('font-weight', 'bold')
    .attr('font-size', '14px')
    .text(central.name || 'Desconocido');
  // --- Hermanos (a la izquierda) ---
  hermanos.forEach((hermano, idx) => {
    const hx = centerX - 160 - idx*140;
    const hy = centerY;
    const hGroup = g.append('g').attr('transform', `translate(${hx},${hy})`);
    hGroup.append('rect')
      .attr('width', 120)
      .attr('height', 40)
      .attr('x', -60)
      .attr('y', -20)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('fill', 'var(--graph-sibling-node)')
      .attr('stroke', 'var(--graph-node-stroke)');
    hGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 0)
      .attr('fill', 'var(--graph-text)')
      .attr('font-weight', 'bold')
      .attr('font-size', '12px')
      .text(hermano.name || 'Desconocido');
    // Línea de padres a hermano
    if (central._parents && central._parents.length > 0) {
      g.append('path')
        .attr('fill', 'none')
        .attr('stroke', 'var(--graph-parent-link)')
        .attr('stroke-width', 1.2)
        .attr('d', `M${hx},${hy-20} Q${(hx+centerX)/2},${hy-60} ${centerX},${centerY-25}`);
    }
  });
  // --- Cónyuges (a la derecha) ---
  conyuges.forEach((conyuge, idx) => {
    const sx = centerX + 160 + idx*140;
    const sy = centerY;
    const sGroup = g.append('g').attr('transform', `translate(${sx},${sy})`);
    sGroup.append('rect')
      .attr('width', 120)
      .attr('height', 40)
      .attr('x', -60)
      .attr('y', -20)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('fill', 'var(--graph-spouse-node)')
      .attr('stroke', 'var(--graph-node-stroke)');
    sGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 0)
      .attr('fill', 'var(--graph-text)')
      .attr('font-weight', 'bold')
      .attr('font-size', '12px')
      .text(conyuge.name || 'Desconocido');
    // Línea horizontal de matrimonio
    g.append('line')
      .attr('x1', centerX+65)
      .attr('y1', centerY)
      .attr('x2', sx-65)
      .attr('y2', sy)
      .attr('stroke', 'var(--graph-spouse-link)')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,4');
  });
  // --- Zoom y pan ---
  const zoom = d3.zoom().scaleExtent([0.2, 2]).on('zoom', (event) => {
    g.attr('transform', event.transform);
  });
  svg.call(zoom);
  svg.call(zoom.transform, d3.zoomIdentity);
}

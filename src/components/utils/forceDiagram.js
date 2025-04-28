// Importa D3.js
import * as d3 from 'd3';

/**
 * Renderiza un diagrama de fuerzas genealógico interactivo usando D3.js
 * @param {Object} options
 *   svg: elemento SVG,
 *   individuals: objeto de individuos,
 *   families: objeto de familias,
 *   centralId: id del nodo central,
 *   onNodeClick: función para abrir modal
 */
export function renderForceDiagram({ svg, individuals, families, centralId, onNodeClick }) {
  if (!svg || !individuals || !centralId) return;
  d3.select(svg).selectAll('*').remove();

  // --- Construye nodos y enlaces ---
  // Determina roles para colores
  const central = individuals[centralId];
  const spouseIds = new Set();
  const exSpouseIds = new Set();
  const childIds = new Set();
  const parentIds = new Set();
  if (central) {
    // Cónyuges y ex-cónyuges
    (central._spouses||[]).forEach(s => spouseIds.add(s.id));
    (central._exSpouses||[]).forEach(s => exSpouseIds.add(s.id));
    // Hijos
    (central._children||[]).forEach(c => childIds.add(c.id));
    // Padres
    (central._parents||[]).forEach(p => parentIds.add(p.id));
  }
  const nodes = Object.values(individuals).map(i => ({
    id: i.id,
    label: i.name,
    raw: i,
    isCentral: i.id === centralId,
    role: i.id === centralId ? 'central'
      : spouseIds.has(i.id) ? 'conyuge'
      : exSpouseIds.has(i.id) ? 'exconyuge'
      : childIds.has(i.id) ? 'hijo'
      : parentIds.has(i.id) ? 'ancestro'
      : 'otro'
  }));
  const links = [];
  Object.values(families).forEach(fam => {
    if (fam.husb && fam.wife) {
      links.push({ source: fam.husb, target: fam.wife, type: 'spouse' });
    }
    fam.chil.forEach(childId => {
      if (fam.husb) links.push({ source: fam.husb, target: childId, type: 'parent' });
      if (fam.wife) links.push({ source: fam.wife, target: childId, type: 'parent' });
    });
  });

  const width = svg.width.baseVal.value;
  const height = svg.height.baseVal.value;

  // --- Zoom y pan ---
  const g = d3.select(svg).append('g');
  d3.select(svg).call(
    d3.zoom()
      .scaleExtent([0.2, 2])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      })
  );

  // --- Enlaces ---
  const link = g.selectAll('.link')
    .data(links)
    .enter().append('line')
    // Add class based on link type
    .attr('class', d => `link ${d.type}`)
    // Remove direct stroke styling, let CSS handle it via class
    // .attr('stroke', d => { ... })
    // .attr('stroke-width', 2)
    // .attr('opacity', 0.85);

  // --- Nodos ---
  const node = g.selectAll('.node')
    .data(nodes)
    .enter().append('g')
    // Add role class to the group
    .attr('class', d => `node ${d.role}`)
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
    );

  node.append('circle')
    .attr('r', d => d.isCentral ? 38 : 28)
    // Remove direct fill/stroke styling, let CSS handle it via class
    // .attr('fill', d => { ... })
    // .attr('stroke', d => d.isCentral ? 'var(--color-central-border, #6f6f6f)' : '#fff')
    // .attr('stroke-width', d => d.isCentral ? 4 : 2)
    .on('click', (event, d) => onNodeClick(d));

  node.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 5)
    .attr('font-size', d => d.isCentral ? 18 : 14)
    .attr('fill', 'var(--graph-text, #222)') // Keep text fill or use CSS
    .text(d => d.label);

  // --- Simulación de fuerzas ---
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120).strength(1))
    .force('charge', d3.forceManyBody().strength(-350))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide(60))
    .on('tick', ticked);

  // Fija el nodo central en el centro
  const centralNode = nodes.find(n => n.id === centralId);
  if (centralNode) {
    centralNode.fx = width / 2;
    centralNode.fy = height / 2;
  }

  function ticked() {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    node
      .attr('transform', d => `translate(${d.x},${d.y})`);
  }

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    if (!d.isCentral) {
      d.fx = null;
      d.fy = null;
    }
  }
}
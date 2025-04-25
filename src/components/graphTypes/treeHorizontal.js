// Árbol horizontal con D3 (Tidy Tree Layout)
import * as d3 from 'd3';

/**
 * Renderiza un gráfico de árbol horizontal (Tidy Tree).
 * Espera datos ya procesados por d3.hierarchy().
 *
 * @param {object} hierarchyRoot - El nodo raíz resultante de d3.hierarchy().
 * @param {HTMLElement} container - Elemento contenedor del SVG.
 * @param {number} width - Ancho del contenedor.
 * @param {number} height - Alto del contenedor.
 * @param {function} onNodeModal - Callback al hacer clic en un nodo (para abrir modal). Recibe los datos originales del nodo (d.data).
 */
export function renderTreeHorizontal(hierarchyRoot, container, width, height, onNodeModal) {
  // Limpiar contenedor previo
  d3.select(container).selectAll('*').remove();
  console.log("renderTreeHorizontal: Iniciando renderizado.");

  // Validaciones básicas
  if (!hierarchyRoot || typeof hierarchyRoot.descendants !== 'function') {
      console.error("renderTreeHorizontal: Se esperaba un nodo raíz de jerarquía D3.", hierarchyRoot);
      container.innerHTML = '<p style="color: red; padding: 10px;">Error: Datos inválidos para Árbol Horizontal.</p>';
      return;
  }
   if (!width || !height || width <= 0 || height <= 0) {
      console.error(`renderTreeHorizontal: Dimensiones inválidas (${width}x${height}). Abortando.`);
      // Intenta mostrar un mensaje en el contenedor si es posible
      try {
          container.innerHTML = `<p style="color: orange; padding: 10px;">Esperando dimensiones válidas (${width}x${height})...</p>`;
      } catch (e) { /* Ignora si el contenedor no está listo */ }
      return; // No renderizar sin dimensiones válidas
  }
  console.log(`renderTreeHorizontal: Dimensiones ${width}x${height}`);

  // --- Configuración del Layout y SVG ---
  const dx = 25; // Aumenta separación vertical entre nodos
  // Separación horizontal dinámica, asegurando mínimo y considerando profundidad
  const dy = Math.max(120, width / Math.max(1, hierarchyRoot.height + 1));
  // Márgenes para dejar espacio alrededor del árbol
  const margin = { top: 20, right: 150, bottom: 20, left: 60 }; // Aumenta márgenes

  // Crear el layout de árbol (tidy tree)
  const treeLayout = d3.tree().nodeSize([dx, dy]);

  // Aplicar el layout a la jerarquía recibida
  const rootNode = treeLayout(hierarchyRoot);
  console.log("renderTreeHorizontal: Layout de árbol calculado.", rootNode);

  // Calcular la extensión vertical real para centrar mejor
  let x0 = d3.min(rootNode.descendants(), d => d.x);
  let x1 = d3.max(rootNode.descendants(), d => d.x);

  // Crear el SVG
  const svg = d3.select(container)
    .append('svg')
      .attr('width', '100%') // Ocupa todo el ancho disponible
      .attr('height', '100%') // Ocupa todo el alto disponible
      // viewBox se ajusta al ancho y alto del *contenedor*
      .attr('viewBox', [0, 0, width, height])
      .attr('preserveAspectRatio', 'xMidYMid meet') // Centra y escala
      .style('font', '10px sans-serif')
      // CORRECCIÓN: Quitado overflow: visible para contener el pan
      .style('background-color', 'var(--v-theme-background, #f5f5f5)'); // Fondo para ver límites

  // Grupo principal para aplicar márgenes y transformaciones de zoom/pan
  // CORRECCIÓN: Centrado vertical inicial más robusto
  const initialTranslateY = (height / 2) - ((x1 + x0) / 2); // Centra la extensión vertical del árbol
  const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${initialTranslateY})`);

  // Configurar comportamiento de zoom y pan
  const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 4]) // Rango de zoom ajustado
      // CORRECCIÓN: Limitar el área de paneo (opcional pero útil)
      // .translateExtent([[minX, minY], [maxX, maxY]]) // Define los límites si conoces la extensión total
      .on('zoom', (event) => {
          // Aplica la transformación al grupo 'g'
          g.attr('transform', event.transform);
      });

  // Aplica el comportamiento de zoom al SVG principal
  // CORRECCIÓN: No llamar a .transform() aquí, dejar que el usuario inicie el zoom/pan
  svg.call(zoomBehavior);
  // Opcional: Establecer una transformación inicial si se desea un zoom/posición por defecto
  // svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(margin.left, initialTranslateY).scale(0.8));


  // --- Dibujar Enlaces ---
  const linkGroup = g.append('g')
      .attr('class', 'links')
      .attr('fill', 'none')
      // CORRECCIÓN DEBUG: Usar color teal y opacidad 1 temporalmente
      .attr('stroke', 'teal') // <-- DEBUG: Color teal brillante
      .attr('stroke-opacity', 0.6) // <-- DEBUG: Totalmente opaco
      .attr('stroke-width', 1.5);

  // Generador de enlaces horizontales curvos (más suave que recto)
  const linkGenerator = d3.linkHorizontal()
      .x(d => d.y) // Posición horizontal es la profundidad (y)
      .y(d => d.x); // Posición vertical es x

  // Obtener los datos de los enlaces
  const linksData = rootNode.links();
  console.log(`renderTreeHorizontal: Número de enlaces a dibujar: ${linksData.length}`);
  if (linksData.length === 0 && rootNode.descendants().length > 1) {
      console.warn("renderTreeHorizontal: No se generaron enlaces, verifica la estructura jerárquica.");
  }

  // Dibuja los paths para cada enlace
  linkGroup.selectAll('path')
    .data(linksData)
    .join('path')
      .attr('d', d => {
          // DEBUG: Verificar coordenadas antes de generar el path
          if (isNaN(d.source.x) || isNaN(d.source.y) || isNaN(d.target.x) || isNaN(d.target.y)) {
              console.error("Coords inválidas para enlace:", d);
              return null; // No dibujar si hay NaN
          }
          try {
              return linkGenerator(d);
          } catch (e) {
              console.error("Error generando path para enlace:", d, e);
              return null;
          }
      })
      // Añadir un ID para depuración si es necesario
      // .attr('id', d => `link-${d.source.id}-${d.target.id}`);

  // --- Dibujar Nodos ---
  const nodeGroup = g.append('g')
      .attr('class', 'nodes')
      .attr('stroke-linejoin', 'round')
      .attr('stroke-width', 3);

  // Obtener descendientes
  const descendantsData = rootNode.descendants();
  console.log(`renderTreeHorizontal: Número de nodos a dibujar: ${descendantsData.length}`);

  // Crea un grupo 'g' para cada nodo descendiente
  const nodeSelection = nodeGroup.selectAll('g')
    .data(descendantsData)
    .join('g')
      // Posiciona cada grupo de nodo
      .attr('transform', d => {
          // DEBUG: Verificar coordenadas
          if (isNaN(d.x) || isNaN(d.y)) {
              console.error("Coords inválidas para nodo:", d);
              // Posicionar en origen para que sea visible el error
              return `translate(0,0)`;
          }
          return `translate(${d.y},${d.x})`;
      })
      // Añadir un ID para depuración
      .attr('id', d => `node-${d.data.id || d.id || 'undefined'}`);


  // Dibuja un círculo para cada nodo
  nodeSelection.append('circle')
      .attr('fill', d => d.children ? 'var(--v-theme-primary, #6200ea)' : 'var(--v-theme-secondary, #999)')
      .attr('stroke', 'var(--v-theme-surface, white)')
      .attr('r', 5.5) // Ligeramente más grande
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
          event.stopPropagation();
          if (onNodeModal && typeof onNodeModal === 'function') {
              onNodeModal(d.data); // Pasa datos originales
          } else {
              console.warn("onNodeModal no es una función válida.");
          }
      });

  // Añade texto (nombre) a cada nodo
  nodeSelection.append('text')
      .attr('fill', 'var(--v-theme-on-surface)')
      .attr('dy', '0.31em')
      .attr('x', d => d.children ? -9 : 9) // Más separación del círculo
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .text(d => d.data.name || d.data.id || '??') // Texto de fallback
      .style('paint-order', 'stroke')
      .attr('stroke', 'var(--v-theme-surface)')
      .attr('stroke-width', 3)
      .style('pointer-events', 'none'); // Evita que el texto interfiera con clic en círculo

  // Añadir tooltips (título nativo)
  nodeSelection.select('circle').append('title')
      .text(d => `${d.data.name || d.data.id}\n(Clic para detalles)`);
  // No es necesario en el texto si ya está en el círculo
  // nodeSelection.select('text').append('title')
  //     .text(d => `${d.data.name || d.data.id}\n(Clic para detalles)`);

  console.log("renderTreeHorizontal: Renderizado completado.");
  // --- Limpieza ---
  // No se necesita devolver función de limpieza si Vue maneja clearTree()
}

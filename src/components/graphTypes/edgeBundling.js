// Hierarchical Edge Bundling con D3 (Adaptado para estructura {nodes, links})
import * as d3 from 'd3';

/**
 * Renderiza un gráfico de Agrupamiento Relacional (Hierarchical Edge Bundling).
 * Espera datos en formato { nodes: [], links: [] }, donde los nodos
 * tienen propiedades `id`, `name`, `_parents`, `children`, `spouses`.
 *
 * @param {object} graphData - Objeto con { nodes: array, links: array }.
 * @param {HTMLElement} container - Elemento contenedor del SVG.
 * @param {number} width - Ancho del contenedor.
 * @param {number} height - Alto del contenedor.
 * @param {function} onNodeFocus - Callback al hacer clic en un nodo (para enfocar). Recibe el nodo D3.
 * @param {function} onNodeModal - Callback secundario (ej. dblclick) para abrir modal. Recibe el nodo D3.
 */
export function renderAgrupamientoRelacional(graphData, container, width, height, onNodeFocus, onNodeModal) {
  // Limpiar contenedor previo
  d3.select(container).selectAll('*').remove();

  // Validaciones básicas de datos
  if (!graphData || !graphData.nodes || !graphData.links) {
    console.error('renderAgrupamientoRelacional: Datos inválidos (se esperan {nodes, links}).', graphData);
    container.innerHTML = '<p style="color: red; padding: 10px;">Error: Datos inválidos para el gráfico radial.</p>';
    return;
  }
  if (graphData.nodes.length === 0) {
    console.warn('renderAgrupamientoRelacional: No hay nodos para mostrar.');
    container.innerHTML = '<p style="padding: 10px;">No hay datos para mostrar en el gráfico.</p>';
    return;
  }

  // Determinar si es una vista de familia enfocada (para título)
  const isFamilyFocus = graphData._isFamilyFocus || false;
  const focusName = graphData._focusPersonName || 'Árbol Genealógico';

  // Calcular radio basado en tamaño del contenedor y número de nodos
  // Ajusta estos factores según sea necesario para tu estética
  const nodeCountFactor = Math.max(1, Math.log10(graphData.nodes.length + 1)); // Factor logarítmico
  const baseRadius = Math.min(width, height) / 2 * 0.85; // Radio base
  const dynamicRadius = Math.min(width, height) / 2 * 0.95 - (50 * nodeCountFactor); // Ajusta el radio dinámicamente
  const radius = Math.max(50, dynamicRadius); // Asegura un radio mínimo

  // Crear mapa ID -> Nodo para búsqueda rápida
  // Clona los nodos para añadirles propiedades x, y sin modificar los originales
  const nodeMap = new Map();
  const nodes = graphData.nodes.map(n => {
      // Crea una copia superficial para añadir propiedades de layout (x, y)
      // Guarda la referencia al nodo original en 'data' para los callbacks
      const nodeCopy = { ...n, data: n };
      nodeMap.set(n.id, nodeCopy);
      return nodeCopy;
  });

  // Asignar posiciones circulares (x: ángulo, y: radio)
  const N = nodes.length;
  nodes.forEach((node, i) => {
    node.x = (2 * Math.PI * i) / N; // Ángulo en radianes
    node.y = radius; // Radio constante
  });

  // Procesar enlaces: Asegura que source y target sean referencias a los nodos clonados con x,y
  const links = graphData.links.map(link => {
      // Busca los nodos clonados (con x,y) correspondientes a los IDs del enlace
      const sourceNode = nodeMap.get(typeof link.source === 'object' ? link.source.id : link.source);
      const targetNode = nodeMap.get(typeof link.target === 'object' ? link.target.id : link.target);
      // Si alguno de los nodos no se encuentra (puede pasar si hay IDs rotos), ignora el enlace
      if (!sourceNode || !targetNode) {
          console.warn("Enlace inválido, no se encontraron nodos en el mapa:", link);
          return null; // Ignora enlaces inválidos
      }
      // Devuelve un nuevo objeto enlace con referencias a los nodos clonados y el tipo
      return {
          source: sourceNode, // Referencia al nodo clonado fuente
          target: targetNode, // Referencia al nodo clonado destino
          type: link.type || 'related' // Asigna un tipo por defecto si falta
      };
  }).filter(link => link !== null); // Filtra los enlaces nulos que resultaron de nodos no encontrados

  // Colores para tipos de enlace (ajusta según tu paleta)
  const colorParent = '#ff7f0e'; // Naranja
  const colorChild = '#2ca02c'; // Verde
  const colorSpouse = '#1f77b4'; // Azul
  const colorOther = '#9467bd'; // Púrpura (para otros tipos o por defecto)

  function getColorByType(type) {
    switch (type) {
      case 'parent': return colorParent;
      case 'child': return colorChild;
      case 'spouse': return colorSpouse;
      default: return colorOther;
    }
  }

  // Generador de caminos radiales con curvatura (Bundle)
  // Usa curveBundle que crea curvas suaves entre puntos
  const lineGenerator = d3.lineRadial()
    .curve(d3.curveBundle.beta(0.85)) // Ajusta beta para más/menos curvatura (0=recto, 1=muy curvo)
    .radius(d => d.y) // El radio es la propiedad 'y' del nodo
    .angle(d => d.x); // El ángulo es la propiedad 'x' del nodo

  // Función para generar el atributo 'd' del path
  // Para curveBundle, simplemente pasamos los puntos source y target
  function getPathData(d) {
    return lineGenerator([d.source, d.target]);
  }

  // Crear SVG y grupo principal con zoom/pan
  const svg = d3.select(container)
    .append('svg')
      .attr('width', '100%') // Ocupa todo el ancho del contenedor
      .attr('height', '100%') // Ocupa todo el alto del contenedor
      // viewBox permite escalar el contenido manteniendo relación de aspecto
      // Centrado en [0,0] usando (-width/2, -height/2) como esquina superior izquierda
      .attr('viewBox', [-width / 2, -height / 2, width, height])
      .attr('preserveAspectRatio', 'xMidYMid meet') // Centra y escala el contenido
      .style('font', '10px sans-serif'); // Tamaño de fuente base más pequeño

  const g = svg.append('g'); // Grupo para aplicar transformaciones de zoom/pan

  // Configurar comportamiento de zoom y pan
  const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 8]) // Rango de escala permitido (zoom in/out)
      .on('zoom', (event) => {
        // Aplica la transformación (escala y traslación) al grupo 'g'
        g.attr('transform', event.transform);
      });
  // Aplica el comportamiento de zoom al elemento SVG principal
  svg.call(zoomBehavior);

  // Dibujar enlaces (paths) dentro del grupo 'g'
  const linkPaths = g.append('g')
      .attr('class', 'links') // Clase para agrupar enlaces
      .attr('fill', 'none') // Los enlaces no tienen relleno
      .attr('stroke-width', 1.5) // Ancho del trazo por defecto
    .selectAll('path')
    .data(links) // Asocia los datos de enlaces procesados
    .join('path') // Crea un 'path' por cada enlace
      .attr('d', getPathData) // Genera el camino usando la función y el generador
      .attr('stroke', d => getColorByType(d.type)) // Color según tipo de relación
      .attr('stroke-opacity', 0.2) // Opacidad inicial baja para no saturar
      // Guarda una referencia al elemento path en los datos del enlace para fácil acceso en interacciones
      .each(function(d) { d.pathElement = this; });

  // Dibujar nodos (grupo por nodo) dentro del grupo 'g'
  const nodeGroups = g.append('g')
      .attr('class', 'nodes') // Clase para agrupar nodos
      .attr('stroke-linejoin', 'round') // Estilo de unión de trazos
      .attr('stroke-width', 3) // Ancho del borde (para posible highlight con stroke)
    .selectAll('g')
    .data(nodes) // Asocia los datos de nodos clonados (con x,y)
    .join('g') // Crea un grupo 'g' por cada nodo
      // Aplica rotación y traslación para posicionar cada grupo de nodo en el círculo
      .attr('transform', d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`);

  // Añadir texto a cada grupo de nodo
  const nodeTexts = nodeGroups.append('text')
      .attr('fill', 'var(--v-theme-on-surface)')
      .attr('dy', '0.31em')
      .attr('x', d => d.x < Math.PI ? 8 : -8)
      .attr('text-anchor', d => d.x < Math.PI ? 'start' : 'end')
      .attr('transform', d => d.x >= Math.PI ? 'rotate(180)' : null)
      .text(d => d.name || d.id)
      .style('paint-order', 'stroke')
      .attr('stroke', 'var(--v-theme-surface)')
      .attr('stroke-width', 3)
      .style('cursor', 'pointer')
      .on('mouseover', handleMouseOver)
      .on('mouseout', handleMouseOut)
      .on('click', (event, d) => {
          if (event.detail === 2 && onNodeModal) onNodeModal(d);
          else if (onNodeFocus) onNodeFocus(d);
      })
      .each(function(d) { d.textElement = this; });

  // Añadir tooltip básico (título nativo del navegador)
  nodeTexts.append('title').text(d => `${d.name || d.id}`);

  // --- Funciones de Interacción (Highlighting) ---

  // Resalta el nodo 'd' y sus conexiones directas
  function handleMouseOver(event, d) {
    // Baja opacidad de todos los enlaces y textos para empezar
    linkPaths.attr('stroke-opacity', 0.05); // Muy transparentes
    nodeTexts.attr('fill-opacity', 0.3); // Textos semi-transparentes

    // Encuentra enlaces conectados al nodo 'd' (source o target)
    const connectedLinks = links.filter(l => l.source === d || l.target === d);
    // Crea un Set con los nodos conectados (incluyendo 'd')
    const connectedNodes = new Set([d]);
    connectedLinks.forEach(l => {
        // Resalta el path del enlace conectado
        d3.select(l.pathElement)
            .attr('stroke-opacity', 0.7) // Más opaco
            .attr('stroke-width', 2.5) // Más grueso
            .raise(); // Lo trae al frente visualmente
        // Añade los nodos conectados al Set
        connectedNodes.add(l.source);
        connectedNodes.add(l.target);
    });

    // Resalta los textos de los nodos conectados
    nodeGroups.filter(n => connectedNodes.has(n)) // Filtra los grupos de nodo
        .select('text') // Selecciona el texto dentro del grupo
        .attr('fill-opacity', 1) // Totalmente opaco
        .attr('font-weight', 'bold'); // Negrita

    // Asegura que el nodo actual (sobre el que está el cursor) esté resaltado
    d3.select(d.textElement)
        .attr('font-weight', 'bold')
        .attr('fill-opacity', 1)
        .raise(); // Trae al frente el texto actual
  }

  // Restaura la apariencia normal de todos los elementos
  function handleMouseOut(event, d) {
    linkPaths.attr('stroke-opacity', 0.2).attr('stroke-width', 1.5); // Opacidad y grosor por defecto
    nodeTexts.attr('fill-opacity', 1).attr('font-weight', null); // Opacidad y peso normal
  }


  // --- Leyenda ---
  const legendGroup = svg.append('g')
      .attr('class', 'legend') // Clase para la leyenda
      // Posiciona la leyenda (esquina superior izquierda con margen)
      .attr('transform', `translate(${-width / 2 + 20}, ${-height / 2 + 20})`);

  legendGroup.append('text')
      .attr('class', 'legend-title')
      .attr('y', 0)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', 'var(--v-theme-on-surface)')
      .text(focusName); // Muestra nombre de enfoque o título general

  legendGroup.append('text')
      .attr('class', 'legend-subtitle')
      .attr('y', 20)
      .attr('font-size', '11px')
      .attr('fill', 'var(--v-theme-on-surface)')
      .attr('fill-opacity', 0.8)
      .text('Clic: Enfocar | Doble Clic: Detalles'); // Instrucciones básicas

  // Elementos de la leyenda para tipos de enlace
  const legendItems = [
      { label: 'Padre/Madre', color: colorParent, type: 'parent' },
      { label: 'Hijo/Hija', color: colorChild, type: 'child' },
      { label: 'Cónyuge', color: colorSpouse, type: 'spouse' },
      { label: 'Otro', color: colorOther, type: 'other' }
  ];

  // Crea un grupo por cada item de la leyenda
  const legendItemGroup = legendGroup.selectAll('.legend-item')
      .data(legendItems)
      .join('g')
          .attr('class', 'legend-item')
          .attr('transform', (d, i) => `translate(0, ${40 + i * 18})`); // Espaciado vertical

  // Línea de color para cada item
  legendItemGroup.append('line')
      .attr('x1', 0).attr('x2', 20) // Longitud de la línea
      .attr('y1', 0).attr('y2', 0)
      .attr('stroke', d => d.color) // Color del tipo de enlace
      .attr('stroke-width', 3); // Grosor de la línea

  // Texto para cada item
  legendItemGroup.append('text')
      .attr('x', 25) // Posición a la derecha de la línea
      .attr('y', 4) // Alineación vertical con la línea
      .attr('font-size', '10px')
      .attr('fill', 'var(--v-theme-on-surface)')
      .text(d => d.label); // Texto del tipo de enlace

  // CORRECCIÓN: ResizeObserver eliminado de aquí. Se maneja en Vue.

  // Opcional: Devolver alguna referencia si es necesario fuera de esta función
  // return { svg: svg.node(), nodes, links };
}

// Hierarchical Edge Bundling con D3
import * as d3 from 'd3';

export function renderTreeRadial(rootData, container, width, height, onNodeClick) {
  d3.select(container).selectAll('*').remove();
  
  // Configuración del gráfico
  const radius = Math.min(width, height) / 2 * 0.85; // 85% del espacio disponible
  
  // Preprocesar datos para Edge Bundling
  const root = d3.hierarchy(rootData);
  
  // Función para generar ID único basado en el nombre
  const getId = (name) => name.replace(/\s+/g, '_').toLowerCase();
  
  // Transformamos los datos para incluir ID y links
  let nodeById = new Map();
  let links = [];
  
  // Procesamos los nodos para crear un mapa por ID
  root.descendants().forEach((node) => {
    const id = node.data.id || getId(node.data.name);
    node.id = id;
    node.data.id = id; // Asegurarnos que existe el ID
    nodeById.set(id, node);
    
    // Agregar enlaces padre-hijo y entre hermanos (opcional)
    if (node.parent) {
      // Enlace hijo a padre
      links.push({
        source: node.id,
        target: node.parent.id,
        type: "child-parent"
      });
      
      // Enlaces entre hermanos para crear una red más densa (opcional)
      if (node.parent.children && node.parent.children.length > 1) {
        const siblings = node.parent.children.filter(sibling => sibling !== node);
        if (siblings.length > 0) {
          // Limitar cantidad de enlaces entre hermanos para evitar sobrecarga visual
          const maxSiblingLinks = Math.min(2, siblings.length);
          for (let i = 0; i < maxSiblingLinks; i++) {
            const randomIndex = Math.floor(Math.random() * siblings.length);
            const randomSibling = siblings[randomIndex];
            links.push({
              source: node.id,
              target: randomSibling.id,
              type: "sibling"
            });
            // Evitar duplicados
            siblings.splice(randomIndex, 1);
            if (siblings.length === 0) break;
          }
        }
      }
    }
  });
  
  // Crear cluster layout
  const cluster = d3.cluster()
    .size([2 * Math.PI, radius - 100]);
  
  cluster(root);
  
  // Crear SVG y grupo principal centrado con preserveAspectRatio
  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', [-width / 2, -height / 2, width, height])
    .attr('preserveAspectRatio', 'xMidYMid meet');
  
  // Agregar zoom y pan para mejor interacción
  const zoom = d3.zoom()
    .scaleExtent([0.5, 5]) // Limitar zoom entre 0.5x y 5x
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
    
  svg.call(zoom);
  
  // Grupo principal
  const g = svg.append('g');
  
  // Determinar tamaño de texto base según cantidad de nodos
  const nodeCount = root.descendants().length;
  let baseFontSize = 10;
  if (nodeCount > 100) {
    baseFontSize = 8;
  } else if (nodeCount > 200) {
    baseFontSize = 7;
  }
  
  // Dibujar enlaces con curvas (edge bundling)
  const line = d3.lineRadial()
    .curve(d3.curveBundle.beta(0.85))
    .radius(d => d.y)
    .angle(d => d.x);
  
  // Colores para los diferentes tipos de enlaces
  const linkColor = (type) => type === "child-parent" ? "#555" : "#ddd";
  
  // Dibujamos los enlaces
  g.append("g")
    .attr("stroke-opacity", 0.6)
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("class", "link")
    .attr("stroke", d => linkColor(d.type))
    .attr("stroke-width", d => d.type === "child-parent" ? 1.5 : 0.7)
    .attr("fill", "none")
    .attr("d", d => {
      const source = nodeById.get(d.source);
      const target = nodeById.get(d.target);
      
      if (!source || !target) return null;
      
      // Crear puntos para la curva
      const path = [
        [source.x, source.y], 
        [target.x, target.y]
      ];
      
      return line(path.map(p => ({ x: p[0], y: p[1] })));
    });
  
  // Dibujamos los nodos
  const node = g.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(root.descendants())
    .join("g")
    .attr("transform", d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0) rotate(${d.x < Math.PI ? 0 : 180})`);
  
  // Círculos para los nodos
  node.append("circle")
    .attr("class", "node")
    .attr("fill", d => d.children ? "var(--v-theme-primary)" : "#999")
    .attr("stroke", "var(--v-theme-surface)")
    .attr("stroke-width", 1.5)
    .attr("r", d => d.children ? 5 : 3.5)
    .on("click", (event, d) => {
      if (onNodeClick) onNodeClick(d);
    });
  
  // Función para determinar si debe mostrar texto basado en densidad de nodos
  const shouldShowText = (node) => {
    if (!node.parent) return true; // Mostrar siempre el nodo raíz
    if (!node.parent.children) return true;
    
    // Si hay muchos hermanos, omitir algunas etiquetas
    const siblingCount = node.parent.children.length;
    if (siblingCount > 10) {
      // Mostrar solo 1 de cada X etiquetas basado en densidad
      const modulo = Math.ceil(siblingCount / 10);
      const nodeIndex = node.parent.children.indexOf(node);
      return nodeIndex % modulo === 0;
    }
    return true;
  };
  
  // Etiquetas de texto adaptativas
  node.append('text')
    .attr('class', 'node-label')
    .attr('dy', '0.31em')
    .attr('x', d => d.x < Math.PI ? 8 : -8)
    .attr('text-anchor', d => d.x < Math.PI ? 'start' : 'end')
    .attr('fill', 'var(--v-theme-on-surface)')
    .attr('font-size', d => {
      const depthFactor = Math.max(0.7, 1 - d.depth * 0.1);
      return `${baseFontSize * depthFactor}px`;
    })
    .attr('opacity', d => shouldShowText(d) ? 1 : 0)
    .text(d => d.data.name)
    .each(function(d) {
      const self = d3.select(this);
      let text = d.data.name;
      try {
        const maxLength = d.depth === 0 ? 30 : (20 - d.depth * 3);
        if (text.length > maxLength) {
          text = text.slice(0, maxLength - 3) + '...';
          self.text(text);
        }
        if (text !== d.data.name) {
          self.append('title').text(d.data.name);
        }
      } catch (e) {
        if (text.length > 10) {
          self.text(text.slice(0, 7) + '...');
          self.append('title').text(d.data.name);
        }
      }
    });
    
  // Interactividad mejorada: resaltar enlaces y nodos relacionados
  node.on("mouseover", (event, d) => {
      const relatedLinks = links.filter(link => 
        link.source === d.id || link.target === d.id
      );
      
      const relatedNodeIds = new Set([
        d.id,
        ...relatedLinks.map(link => link.source),
        ...relatedLinks.map(link => link.target)
      ]);
      
      // Destacar enlaces relacionados
      svg.selectAll(".link")
        .style("stroke", link => 
          (link.source === d.id || link.target === d.id) 
            ? "#ff7700" 
            : "#ddd"
        )
        .style("stroke-opacity", link => 
          (link.source === d.id || link.target === d.id) 
            ? 0.9 
            : 0.2
        )
        .style("stroke-width", link => 
          (link.source === d.id || link.target === d.id) 
            ? 2 
            : 0.5
        );
      
      // Destacar nodos relacionados
      svg.selectAll(".node")
        .style("fill", node => 
          relatedNodeIds.has(node.id) 
            ? "var(--v-theme-secondary)" 
            : (node.children ? "var(--v-theme-primary)" : "#999")
        )
        .style("r", node => 
          relatedNodeIds.has(node.id) 
            ? (node.children ? 7 : 5)
            : (node.children ? 5 : 3.5)
        );
      
      // Destacar etiquetas de texto de nodos relacionados
      svg.selectAll(".node-label")
        .style("font-weight", node => 
          relatedNodeIds.has(node.id) 
            ? "bold" 
            : "normal"
        )
        .style("fill-opacity", node => 
          relatedNodeIds.has(node.id) 
            ? 1
            : 0.5
        )
        .style("opacity", node => 
          (relatedNodeIds.has(node.id) || shouldShowText(node))
            ? 1
            : 0
        );
    })
    .on("mouseout", () => {
      // Restaurar estilos originales
      svg.selectAll(".link")
        .style("stroke", d => linkColor(d.type))
        .style("stroke-opacity", 0.6)
        .style("stroke-width", d => d.type === "child-parent" ? 1.5 : 0.7);
      
      svg.selectAll(".node")
        .style("fill", d => d.children ? "var(--v-theme-primary)" : "#999")
        .style("r", d => d.children ? 5 : 3.5);
      
      svg.selectAll(".node-label")
        .style("font-weight", "normal")
        .style("fill-opacity", 1)
        .style("opacity", d => shouldShowText(d) ? 1 : 0);
    });
    
  // Manejador de redimensión para ajustarse automáticamente al contenedor
  const resizeObserver = new ResizeObserver(() => {
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    if (containerWidth > 0 && containerHeight > 0) {
      const newViewBox = `${-containerWidth / 2} ${-containerHeight / 2} ${containerWidth} ${containerHeight}`;
      svg.attr('viewBox', newViewBox);
    }
  });
  
  resizeObserver.observe(container);
  
  // Limpieza cuando se desmonta
  return () => {
    resizeObserver.disconnect();
  };
}
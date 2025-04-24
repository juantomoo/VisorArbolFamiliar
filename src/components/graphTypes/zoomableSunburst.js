// Zoomable Sunburst con D3
import * as d3 from 'd3';

export function renderResplandorRadial(rootData, container, width, height, onNodeClick) {
  d3.select(container).selectAll('*').remove();
  
  // Configuración del gráfico
  const radius = Math.min(width, height) / 6;
  
  // Variables para detectar pulsación larga en dispositivos táctiles
  let touchTimer = null;
  const longPressDelay = 500; // medio segundo para detectar presión larga
  
  // Crear escala de color
  const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, 10));
  
  // Crear la jerarquía
  const hierarchy = d3.hierarchy(rootData)
    .sum(d => 1) // Cada nodo tiene el mismo valor para una visualización uniforme
    .sort((a, b) => b.value - a.value);
    
  // Aplicar el layout de partición
  const root = d3.partition()
    .size([2 * Math.PI, hierarchy.height + 1])
    (hierarchy);
  
  // Inicializar el estado actual para cada nodo
  root.each(d => d.current = d);
  
  // Crear el generador de arcos
  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius * 1.5)
    .innerRadius(d => d.y0 * radius)
    .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));
  
  // Crear el contenedor SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', [-width / 2, -height / 2, width, height])
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('font', '10px sans-serif');
  
  // Dibujar los arcos para cada nodo descendiente (excepto raíz)
  const path = svg.append('g')
    .selectAll('path')
    .data(root.descendants().slice(1))
    .join('path')
      .attr('fill', d => {
        while (d.depth > 1) d = d.parent;
        return color(d.data.name);
      })
      .attr('fill-opacity', d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
      .attr('pointer-events', d => arcVisible(d.current) ? 'auto' : 'none')
      .attr('d', d => arc(d.current));
  
  // Hacer que los arcos con hijos sean clickeables
  path
    .style('cursor', 'pointer')
    .on('click', clicked)
    // Añadir eventos táctiles para detectar presión larga
    .on('touchstart', (event, d) => {
      event.preventDefault(); // Prevenir el comportamiento por defecto
      touchTimer = setTimeout(() => {
        if (onNodeClick) onNodeClick(d);
        touchTimer = null;
      }, longPressDelay);
    })
    .on('touchend', () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    })
    .on('touchmove', () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    });
  
  // Añadir títulos/tooltips para mostrar la ruta completa
  path.append('title')
    .text(d => `${d.ancestors().map(d => d.data.name).reverse().join(' > ')}\n${d.data.id || ''}\n(Ctrl+click para detalles)`);
    
  // Añadir etiquetas de texto
  const label = svg.append('g')
    .attr('pointer-events', 'none')
    .attr('text-anchor', 'middle')
    .style('user-select', 'none')
    .selectAll('text')
    .data(root.descendants().slice(1))
    .join('text')
      .attr('dy', '0.35em')
      .attr('fill-opacity', d => +labelVisible(d.current))
      .attr('transform', d => labelTransform(d.current))
      .text(d => d.data.name)
      .each(function(d) {
        // Truncar texto si es muy largo
        const self = d3.select(this);
        const text = d.data.name;
        if (text.length > 15) {
          self.text(text.slice(0, 12) + '...');
          self.append('title').text(text);
        }
      });
  
  // Crear el círculo central para retroceder
  const parent = svg.append('circle')
    .datum(root)
    .attr('r', radius)
    .attr('fill', 'var(--v-theme-primary)')
    .attr('opacity', 0.5)
    .attr('pointer-events', 'all')
    .on('click', clicked);
  
  // Añadir texto al círculo central
  svg.append('text')
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .attr('fill', 'white')
    .attr('pointer-events', 'none')
    .text('Inicio');
  
  // Añadir instrucciones
  svg.append("text")
    .attr("x", -width / 2 + 20)
    .attr("y", -height / 2 + 20)
    .attr("font-size", "12px")
    .attr("fill", "var(--v-theme-on-surface)")
    .text("Haz clic para explorar ramas. Ctrl+clic para ver detalles.");
  
  // Función para manejar el clic
  function clicked(event, p) {
    // Si se presiona la tecla Control (o Command en Mac), mostrar el modal
    if ((event.ctrlKey || event.metaKey) && onNodeClick) {
      onNodeClick(p);
      return;
    }
    
    // Para clic simple, navegar por el diagrama
    parent.datum(p.parent || root);
    
    // Actualizar los "targets" para la animación
    root.each(d => d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth),
      y1: Math.max(0, d.y1 - p.depth)
    });
    
    // Crear transición
    const t = svg.transition().duration(750);
    
    // Transición de los arcos
    path.transition(t)
      .tween("data", d => {
        const i = d3.interpolate(d.current, d.target);
        return t => d.current = i(t);
      })
      .filter(function(d) {
        return +this.getAttribute("fill-opacity") || arcVisible(d.target);
      })
      .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
      .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none")
      .attrTween("d", d => () => arc(d.current));
    
    // Transición de las etiquetas
    label.filter(function(d) {
        return +this.getAttribute("fill-opacity") || labelVisible(d.target);
      })
      .transition(t)
      .attr("fill-opacity", d => +labelVisible(d.target))
      .attrTween("transform", d => () => labelTransform(d.current));
  }
  
  // Determina si un arco debe ser visible
  function arcVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
  }
  
  // Determina si una etiqueta debe ser visible
  function labelVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
  }
  
  // Calcula la transformación para las etiquetas
  function labelTransform(d) {
    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
    const y = (d.y0 + d.y1) / 2 * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }
  
  // Manejar redimensionamiento
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
// Zoomable Sunburst con D3
import * as d3 from 'd3';

/**
 * Renderiza un gráfico Zoomable Sunburst (Resplandor Radial).
 * Espera datos ya procesados por d3.hierarchy().
 *
 * @param {object} hierarchyRoot - El nodo raíz resultante de d3.hierarchy().sum().sort().
 * @param {HTMLElement} container - Elemento contenedor del SVG.
 * @param {number} width - Ancho del contenedor.
 * @param {number} height - Alto del contenedor.
 * @param {function} onNodeModal - Callback al hacer Ctrl+clic o pulsación larga (para abrir modal). Recibe los datos originales del nodo (d.data).
 */
export function renderResplandorRadial(hierarchyRoot, container, width, height, onNodeModal) {
  // Limpiar contenedor previo
  d3.select(container).selectAll('*').remove();

  // Validaciones básicas
  if (!hierarchyRoot || typeof hierarchyRoot.descendants !== 'function') {
      console.error("renderResplandorRadial: Se esperaba un nodo raíz de jerarquía D3.", hierarchyRoot);
      container.innerHTML = '<p style="color: red; padding: 10px;">Error: Datos inválidos para Sunburst.</p>';
      return;
  }
  if (!width || !height || width <= 0 || height <= 0) {
      console.error(`renderResplandorRadial: Dimensiones inválidas (${width}x${height}).`);
      return; // No renderizar sin dimensiones válidas
  }

  // --- Configuración del Gráfico ---
  // Ajusta el radio base. Dividir entre 6 da bastante espacio alrededor.
  // Puedes experimentar con valores como / 4 o / 5 para un gráfico más grande.
  const baseRadius = Math.min(width, height) / 6;

  // Variables para detectar pulsación larga en dispositivos táctiles
  let touchTimer = null;
  const longPressDelay = 500; // medio segundo para detectar presión larga

  // Crear escala de color (usando nombres como clave si existen)
  // Usar d3.schemeCategory10 o d3.schemeTableau10 para colores distintivos
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

  // Aplicar el layout de partición radial (Sunburst)
  // El tamaño es [ángulo total, radio total]
  // hierarchyRoot.height + 1 asegura que cada nivel tenga espacio radial
  const partitionLayout = d3.partition()
    .size([2 * Math.PI, baseRadius * (hierarchyRoot.height + 1)]); // Ajusta el radio total aquí

  // Aplica el layout a la jerarquía recibida
  const rootNode = partitionLayout(hierarchyRoot);

  // Inicializar el estado 'current' para las transiciones (necesario para animación de zoom)
  rootNode.each(d => d.current = d);

  // Crear el generador de arcos D3
  const arcGenerator = d3.arc()
    .startAngle(d => d.x0) // Ángulo inicial del arco
    .endAngle(d => d.x1)   // Ángulo final del arco
    // Añade un pequeño padding entre arcos para separarlos visualmente
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005)) // Padding angular
    .padRadius(baseRadius * 0.5) // Padding radial (distancia entre niveles) - ajusta si es necesario
    // Radios interno y externo del arco
    .innerRadius(d => Math.max(0, d.y0)) // Asegura radio >= 0
    .outerRadius(d => Math.max(0, d.y1 - 1)); // Pequeño espacio entre anillos

  // --- Creación del SVG ---
  const svg = d3.select(container)
    .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      // Centra el viewBox en [0,0]
      .attr('viewBox', [-width / 2, -height / 2, width, height])
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('font', '10px sans-serif');

  // Grupo principal para los arcos
  const pathGroup = svg.append('g')
      .attr('class', 'slices');

  // Dibuja los arcos (paths) para cada nodo descendiente (excepto la raíz misma)
  const pathSelection = pathGroup
    .selectAll('path')
    // Usa rootNode.descendants() que incluye la raíz, slice(1) la quita
    .data(rootNode.descendants().slice(1))
    .join('path')
      // Asigna color basado en el ancestro de nivel 1 (hijos de la raíz)
      .attr('fill', d => {
        let ancestor = d;
        while (ancestor.depth > 1) ancestor = ancestor.parent; // Sube hasta el nivel 1
        // Usa el nombre (o id) del ancestro para el color, o el nodo mismo si es nivel 1
        return colorScale(ancestor.data.name || ancestor.data.id || 'default');
      })
      // Opacidad basada en si el arco es visible y si tiene hijos
      .attr('fill-opacity', d => arcVisible(d.current) ? (d.children ? 0.7 : 0.5) : 0) // Más opaco si tiene hijos
      // Desactiva eventos de puntero si el arco no es visible (optimización)
      .attr('pointer-events', d => arcVisible(d.current) ? 'auto' : 'none')
      // Dibuja el arco usando el generador y el estado 'current'
      .attr('d', d => arcGenerator(d.current));

  // --- Interacciones ---
  pathSelection
    .style('cursor', 'pointer') // Cursor de mano para indicar que es clickeable
    // --- Click Handler ---
    .on('click', (event, p) => { // 'p' es el nodo de datos D3 clickeado
        // Si se presiona Ctrl (o Cmd en Mac), llama a onNodeModal con los datos originales
        if ((event.ctrlKey || event.metaKey) && onNodeModal) {
            event.stopPropagation(); // Evita el zoom si se abre el modal
            console.log("Ctrl+Click detectado, llamando onNodeModal para:", p.data.name);
            onNodeModal(p.data); // *** CORRECCIÓN: Pasa p.data ***
        } else {
            // Si es un clic simple, navega/zoomea en el sunburst
            clicked(event, p);
        }
    })
    // --- Touch Handlers (Long Press para Modal) ---
    .on('touchstart', (event, d) => {
        event.preventDefault(); // Previene scroll u otros comportamientos por defecto
        // Inicia un temporizador para detectar pulsación larga
        touchTimer = setTimeout(() => {
            console.log("Pulsación larga detectada, llamando onNodeModal para:", d.data.name);
            if (onNodeModal) {
                onNodeModal(d.data); // *** CORRECCIÓN: Pasa d.data ***
            }
            touchTimer = null; // Resetea el temporizador
        }, longPressDelay);
    }, { passive: false }) // Necesario para preventDefault
    .on('touchend', (event) => {
        // Si se levanta el dedo antes del delay, cancela el temporizador
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
            // Podríamos llamar a clicked() aquí si queremos que un toque corto también haga zoom
            // clicked(event, d3.select(event.currentTarget).datum()); // Necesitaría obtener 'd' de otra forma
        }
        // Previene posible 'click' fantasma después de touchend
        event.preventDefault();
    })
    .on('touchmove', () => {
        // Si el dedo se mueve, cancela la detección de pulsación larga
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
    });

  // Añadir tooltips (títulos nativos) para mostrar la ruta completa al nodo
  pathSelection.append('title')
    .text(d => `${d.ancestors().map(node => node.data.name || node.data.id).reverse().join(' > ')}\n(${d.value} elementos)`); // Muestra jerarquía y valor

  // --- Etiquetas de Texto ---
  const labelGroup = svg.append('g')
      .attr('class', 'labels')
      .attr('pointer-events', 'none') // Las etiquetas no deben interceptar clics
      .attr('text-anchor', 'middle') // Centra el texto horizontalmente
      .style('user-select', 'none'); // Evita selección de texto accidental

  const labelSelection = labelGroup
    .selectAll('text')
    .data(rootNode.descendants().slice(1)) // Datos para las etiquetas (sin la raíz)
    .join('text')
      .attr('dy', '0.35em') // Ajuste vertical fino
      .attr('fill', 'var(--v-theme-on-surface)')
      // Opacidad inicial basada en visibilidad
      .attr('fill-opacity', d => +labelVisible(d.current)) // Convierte booleano a 0 o 1
      // Transformación inicial para posicionar y rotar la etiqueta
      .attr('transform', d => labelTransform(d.current))
      .text(d => d.data.name || d.data.id) // Texto de la etiqueta
      // Truncamiento de texto largo (opcional)
      .each(function(d) {
        const self = d3.select(this);
        const text = d.data.name || d.data.id;
        const maxLength = 15; // Máximo número de caracteres a mostrar
        if (text && text.length > maxLength) {
          self.text(text.slice(0, maxLength - 3) + '...'); // Añade puntos suspensivos
          // Añade tooltip completo si se truncó
          self.append('title').text(text);
        }
      });

  // --- Círculo Central (para retroceder/ir al padre) ---
  const parentCircle = svg.append('circle')
    .datum(rootNode) // Asocia el nodo raíz al círculo
    .attr('r', baseRadius) // Radio base (cubre el primer nivel)
    .attr('fill', 'var(--v-theme-primary, #6200ea)') // Color primario del tema (con fallback)
    .attr('fill-opacity', 0.75) // Semi-transparente
    .style('cursor', 'pointer')
    .attr('pointer-events', 'all') // Asegura que sea clickeable
    .on('click', (event, p) => { // 'p' es el nodo asociado (inicialmente la raíz)
        // Al hacer clic en el centro, navega al padre del nodo actual
        clicked(event, p); // Llama a la función de navegación/zoom
    });

  // Texto para el círculo central
  const parentLabel = svg.append('text')
    .attr('class', 'parent-label')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em') // Centrado vertical
    .attr('fill', 'white') // Color de texto legible sobre el fondo
    .attr('pointer-events', 'none') // No intercepta clics
    .datum(rootNode) // Asocia el nodo raíz
    .text(d => d.data.name || d.data.id || 'Inicio'); // Texto inicial

  // --- Instrucciones (Opcional) ---
  svg.append("text")
    .attr("x", -width / 2 + 15) // Posición esquina superior izquierda
    .attr("y", -height / 2 + 25)
    .attr("font-size", "11px")
    .attr("fill", "var(--v-theme-on-surface)")
    .attr("fill-opacity", 0.7)
    .text("Clic: Zoom | Ctrl+Clic / Pulsación larga: Detalles");

  // --- Funciones Auxiliares ---

  // Función principal que maneja el zoom/navegación al hacer clic
  function clicked(event, p) { // 'p' es el nodo D3 clickeado
    // Actualiza el nodo asociado al círculo central (será el padre del nodo 'p' clickeado)
    // Si se hace clic en la raíz (p.depth === 0), no hay padre, se queda en la raíz.
    parentCircle.datum(p.parent || rootNode);
    parentLabel.datum(p.parent || rootNode).text(d => d.data.name || d.data.id || 'Inicio');

    // Calcula las nuevas posiciones 'target' para cada nodo en la jerarquía
    // basado en el nodo 'p' que fue clickeado (este se convierte en el nuevo centro/raíz visual)
    rootNode.each(d => d.target = {
      // Normaliza los ángulos x0 y x1 al rango del nodo 'p' y escala a 2*PI
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      // Ajusta los radios y0 y y1 restando la profundidad de 'p' para "subir" los niveles
      y0: Math.max(0, d.y0 - p.depth * baseRadius), // Ajusta por baseRadius
      y1: Math.max(0, d.y1 - p.depth * baseRadius)
    });

    // --- Transición Animada ---
    const transitionDuration = 750; // Duración de la animación en ms
    const t = svg.transition().duration(transitionDuration);

    // Transición de los arcos (paths)
    pathSelection.transition(t)
      // 'tween' interpola el estado 'current' desde el valor actual al 'target'
      .tween("data", d => {
        const i = d3.interpolate(d.current, d.target); // Interpolador para las propiedades del arco
        return time => d.current = i(time); // Actualiza d.current en cada paso de la animación
      })
      // Filtra para animar solo los arcos que son o serán visibles
      .filter(function(d) {
        // `this` es el elemento path. Verifica opacidad actual o si será visible en el target.
        return +this.getAttribute("fill-opacity") || arcVisible(d.target);
      })
      // Anima la opacidad de llenado
      .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.7 : 0.5) : 0)
      // Activa/desactiva eventos de puntero según visibilidad
      .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none")
      // Anima el atributo 'd' (forma del arco) usando el interpolador
      .attrTween("d", d => () => arcGenerator(d.current));

    // Transición de las etiquetas (texts)
    labelSelection.filter(function(d) {
        // Anima solo las etiquetas que son o serán visibles
        return +this.getAttribute("fill-opacity") || labelVisible(d.target);
      })
      .transition(t)
      // Anima la opacidad de la etiqueta
      .attr("fill-opacity", d => +labelVisible(d.target))
      // Anima la transformación (posición y rotación)
      .attrTween("transform", d => () => labelTransform(d.current));
  }

  // Determina si un arco debe ser visible basado en sus radios y ángulos
  // Ajusta los límites (y1 <= 3, y0 >= 1) según cuántos niveles quieras ver a la vez
  function arcVisible(d) {
    // Muestra arcos que están entre el radio 1*baseRadius y 3*baseRadius
    // y tienen un ángulo > 0
    return d.y1 <= baseRadius * 3 && d.y0 >= baseRadius && d.x1 > d.x0;
  }

  // Determina si una etiqueta debe ser visible
  // Similar a arcVisible, pero también considera el área angular para evitar solapamientos
  function labelVisible(d) {
    // Visible si está en los niveles correctos y el área angular es suficientemente grande
    return d.y1 <= baseRadius * 3 && d.y0 >= baseRadius && (d.x1 - d.x0) > 0.03; // Ajusta 0.03 si es necesario
  }

  // Calcula la transformación (posición y rotación) para una etiqueta
  function labelTransform(d) {
    // Calcula el ángulo medio y el radio medio del arco
    const angle = (d.x0 + d.x1) / 2 * 180 / Math.PI; // Ángulo en grados
    const radius = (d.y0 + d.y1) / 2; // Radio medio
    // Aplica rotación para alinear con el radio, traslada al radio correcto,
    // y rota 180 grados si está en la mitad inferior para que no quede invertido.
    return `rotate(${angle - 90}) translate(${radius},0) rotate(${angle < 180 ? 0 : 180})`;
  }

  // --- Limpieza ---
  // CORRECCIÓN: ResizeObserver eliminado. El componente Vue se encarga.
  // No se necesita devolver una función de limpieza aquí si el componente Vue
  // llama a clearTree() antes de re-renderizar.

} // Fin de renderResplandorRadial

// Hierarchical Edge Bundling con D3
import * as d3 from 'd3';

// Update signature to accept new handlers
export function renderAgrupamientoRelacional(rootData, container, width, height, onNodeFocus, onNodeModal) {
  d3.select(container).selectAll('*').remove();

  // Validar y convertir rootData a jerarquía de D3 si no lo es
  if (!rootData.descendants) {
    try {
      rootData = d3.hierarchy(rootData, d => (d && d.children) || []); // Validar existencia de children
    } catch (error) {
      console.error("Error al convertir rootData a jerarquía de D3:", error);
      return;
    }
  }

  // Calcular el radio dinámico basado en el número de nodos
  const nodeCount = rootData.nodes ? rootData.nodes.length : rootData.descendants().length;
  const baseRadius = Math.min(width, height) / 2 * 0.85; // Radio base
  const dynamicRadius = Math.min(baseRadius + nodeCount * 2, baseRadius * 2); // Ajustar con límites

  // Configuración del gráfico
  const radius = dynamicRadius;

  // Verificar si los datos provienen de una selección de familia (formato { nodes, links })
  const isFamilySelection = rootData.nodes !== undefined;

  // Preprocesar datos para Edge Bundling
  let root, nodes;

  if (isFamilySelection) {
    // Ya tenemos nodos preseleccionados de una familia específica
    const uniqueNodesMap = new Map();
    rootData.nodes.forEach(node => {
      if (node && node.id && !uniqueNodesMap.has(node.id)) {
        // Asegura que children, _parents y spouses sean arrays válidos
        uniqueNodesMap.set(node.id, {
          ...node,
          children: Array.isArray(node.children) ? node.children : [],
          _parents: Array.isArray(node._parents) ? node._parents : [],
          spouses: Array.isArray(node.spouses) ? node.spouses : []
        });
      }
    });

    // Reconstruir relaciones (padres, hijos, cónyuges)
    uniqueNodesMap.forEach(node => {
      // children
      node.children = Array.isArray(node.children)
        ? node.children
            .filter(child => child && typeof child === 'object' && child.id && uniqueNodesMap.has(child.id))
            .map(child => uniqueNodesMap.get(child.id))
        : [];
      // _parents
      node._parents = Array.isArray(node._parents)
        ? node._parents
            .filter(parent => parent && typeof parent === 'object' && parent.id && uniqueNodesMap.has(parent.id))
            .map(parent => uniqueNodesMap.get(parent.id))
        : [];
      // spouses
      node.spouses = Array.isArray(node.spouses)
        ? node.spouses
            .filter(spouse => spouse && typeof spouse === 'object' && spouse.id && uniqueNodesMap.has(spouse.id))
            .map(spouse => uniqueNodesMap.get(spouse.id))
        : [];
    });

    nodes = Array.from(uniqueNodesMap.values());

    // Crear un nodo raíz artificial para agrupar todos los nodos de la familia seleccionada
    root = { 
      name: "Familia seleccionada", 
      children: nodes 
    };
    
    // Convertir a estructura jerárquica para D3
    root = d3.hierarchy(root);
  } else {
    // --- NUEVO: Construir un mapa único de personas por id ---
    function buildUniqueNodeMap(data) {
      const map = new Map();
      function visit(person) {
        if (!person || !person.id) return;
        if (!map.has(person.id)) {
          // Clonar solo los datos básicos, sin hijos ni padres aún
          map.set(person.id, {
            ...person,
            children: [],
            _parents: person._parents ? [...person._parents] : [],
            spouses: person.spouses ? [...person.spouses] : [],
          });
          // Recorrer hijos y padres
          if (person.children) person.children.forEach(visit);
          if (person._parents) person._parents.forEach(visit);
          if (person.spouses) person.spouses.forEach(visit);
        }
      }
      visit(data);
      return map;
    }

    // --- NUEVO: Construir la jerarquía usando nodos únicos ---
    function buildHierarchy(rootData, uniqueMap) {
      function buildNode(person) {
        const node = uniqueMap.get(person.id);
        // Evitar loops infinitos
        if (!node || node._visited) return null;
        node._visited = true;
        // Construir hijos usando nodos únicos
        node.children = (person.children || [])
          .map(child => buildNode(uniqueMap.get(child.id) || child))
          .filter(Boolean);
        return node;
      }
      // Limpiar marcas de visitado
      uniqueMap.forEach(n => { delete n._visited; });
      return buildNode(rootData);
    }

    // --- NUEVO: Crear nodos d3.hierarchy solo para nodos únicos ---
    function hierarchyFromUnique(rootNode) {
      // Asegura que todos los nodos tengan children como array (aunque sea vacío)
      function ensureChildren(node) {
        if (!Array.isArray(node.children)) node.children = [];
        node.children.forEach(child => {
          if (child) ensureChildren(child);
        });
      }
      ensureChildren(rootNode);
      return d3.hierarchy(rootNode, d => Array.isArray(d.children) ? d.children : []);
    }

    // --- NUEVO: Usar el sistema de nodos únicos en todo el flujo ---
    // Solo para el modo árbol completo (no familia seleccionada)
    let uniqueMap;
    if (!isFamilySelection) {
      uniqueMap = buildUniqueNodeMap(rootData);
      root = buildHierarchy(rootData, uniqueMap);
      root = hierarchyFromUnique(root);
    } else {
      // Datos completos del árbol, usar estructura jerárquica normal
      root = d3.hierarchy(rootData);
      nodes = root.descendants().filter(n => !n.children || n.children.length === 0);
    }
  }
  
  // Función para generar ID único basado en el nombre e ID
  const getId = (node) => {
    const id = node.data.id || '';
    const name = node.data.name || '';
    return `${id}-${name}`;
  };
  
  // Crear un mapa de nodos por ID para referencia rápida
  function createNodeMap(root) {
    const idMap = new Map();
    // Usar todos los nodos únicos
    root.descendants().forEach(node => {
      if (node.data.id) {
        idMap.set(node.data.id, node);
      }
    });
    return idMap;
  }

  // Transformar los datos para el formato de Edge Bundling
  function bilink(root) {
    const idMap = createNodeMap(root);
    const allConnections = [];

    // --- NUEVO: Inicializar incoming/outgoing para todos los nodos primero ---
    root.descendants().forEach(node => {
      node.incoming = [];
      node.outgoing = [];
      node.connections = []; // También inicializar conexiones aquí
    });

    // Usar todos los nodos, no solo hojas
    for (const d of root.descendants()) {
      if (isFamilySelection) {
        // Procesar directamente los enlaces proporcionados
        if (rootData.links && rootData.links.length > 0) {
          rootData.links.forEach(link => {
            const sourceNode = idMap.get(link.source);
            const targetNode = idMap.get(link.target);
            
            if (sourceNode && targetNode) {
              // Determinar el tipo de relación
              const relationType = link.type || 'other';
              
              // Crear la conexión
              const connection = {
                source: sourceNode,
                target: targetNode,
                type: relationType
              };
              
              // Almacenar la conexión
              allConnections.push(connection);
              
              // Añadir a las listas de conexiones salientes/entrantes
              sourceNode.outgoing.push([sourceNode, targetNode, relationType]);
              targetNode.incoming.push([sourceNode, targetNode, relationType]);
            }
          });
        }
      } else {
        // Datos normales del árbol - procesar relaciones padres-hijos

        // Enlaces de persona a hijos (outgoing)
        if (d.data.children && d.data.children.length) {
          d.data.children.forEach(child => {
            const childNode = idMap.get(child.id);
            if (childNode) {
              // Crear conexión padre -> hijo
              const connection = {
                source: d,
                target: childNode,
                type: 'child'
              };
              
              allConnections.push(connection);
              
              // Añadir a listas
              d.outgoing.push([d, childNode, 'child']);
              childNode.incoming.push([d, childNode, 'parent']); // childNode.incoming ya está inicializado
            }
          });
        }
        
        // Enlaces de persona a padres
        if (d.data._parents && d.data._parents.length) {
          d.data._parents.forEach(parent => {
            const parentNode = idMap.get(parent.id);
            if (parentNode) {
              // Crear conexión hijo -> padre
              const connection = {
                source: d,
                target: parentNode,
                type: 'parent'
              };
              
              allConnections.push(connection);
              
              // Añadir a listas
              d.outgoing.push([d, parentNode, 'parent']);
              parentNode.incoming.push([d, parentNode, 'child']); // parentNode.incoming ya está inicializado
              
              // También crear la conexión inversa padre -> hijo
              const reverseConnection = {
                source: parentNode,
                target: d,
                type: 'child'
              };
              
              allConnections.push(reverseConnection);
              
              parentNode.outgoing.push([parentNode, d, 'child']); // parentNode.outgoing ya está inicializado
            }
          });
        }
        
        // Si hay parejas/cónyuges, también crear esas conexiones
        if (d.data.spouses && d.data.spouses.length) {
          d.data.spouses.forEach(spouse => {
            const spouseNode = idMap.get(spouse.id);
            if (spouseNode) {
              // Crear conexión bidireccional entre cónyuges
              const connection = {
                source: d,
                target: spouseNode,
                type: 'spouse'
              };
              
              allConnections.push(connection);
              
              // Añadir a listas
              d.outgoing.push([d, spouseNode, 'spouse']);
              spouseNode.incoming.push([d, spouseNode, 'spouse']); // spouseNode.incoming ya está inicializado
              
              // Conexión en dirección opuesta
              const reverseConnection = {
                source: spouseNode,
                target: d,
                type: 'spouse'
              };
              
              allConnections.push(reverseConnection);
              
              spouseNode.outgoing.push([spouseNode, d, 'spouse']); // spouseNode.outgoing ya está inicializado
            }
          });
        }
      }
    }
    
    // Almacenar todas las conexiones para uso posterior
    root.connections = allConnections;
    
    return root;
  }
  
  // Aplicar layout de cluster para disposición radial
  const cluster = d3.cluster()
    .size([2 * Math.PI, radius - 100]); // Usar el radio dinámico

  const linkedRoot = bilink(cluster(root.sort((a, b) => 
    d3.ascending(a.height, b.height) || d3.ascending(a.data.name, b.data.name)
  )));
  
  // Crear SVG y grupo principal centrado con preserveAspectRatio
  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', [-width / 2, -height / 2, width, height])
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('style', 'max-width: 100%; height: auto; font: 12px sans-serif;');
  
  // Agregar zoom y pan para mejor interacción
  const zoom = d3.zoom()
    .scaleExtent([0.5, 5]) // Limitar zoom entre 0.5x y 5x
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
    
  svg.call(zoom);
  
  // Grupo principal
  const g = svg.append('g');
  
  // Definir colores para las conexiones
  const colorParent = "#ff7700"; // Color anaranjado para padres
  const colorChild = "#00aa00";  // Color verde para hijos
  const colorSpouse = "#7777ff";  // Color azul para cónyuges
  const colorOther = "#9966cc";  // Color para otras relaciones
  const colornone = "#ccc";      // Color de las líneas por defecto
  
  // Función para líneas curvas radiales
  const line = d3.lineRadial()
    .curve(d3.curveBundle.beta(0.85))
    .radius(d => d.y)
    .angle(d => d.x);
  
  // Función para determinar si dos nodos deben conectarse
  function shouldConnect(source, target) {
    // No hay conexión consigo mismo
    if (source === target) return false;
    
    // Comprobar si existe alguna relación entre los nodos
    const hasDirectRelation = source.outgoing && source.outgoing.some(link => link[1] === target);
    if (hasDirectRelation) return true;
    
    // Si no hay relación directa, verificar padres e hijos
    const isDirectFamily = 
      (source.data._parents && source.data._parents.some(p => p.id === target.data.id)) ||
      (source.data.children && source.data.children.some(c => c.id === target.data.id)) ||
      (target.data._parents && target.data._parents.some(p => p.id === source.data.id)) ||
      (target.data.children && target.data.children.some(c => c.id === source.data.id));
    
    return isDirectFamily;
  }
  
  // Eliminar duplicados de conexiones
  function getUniqueConnections(connections) {
    const uniqueConnections = [];
    const seenConnections = new Set();
    
    connections.forEach(conn => {
      if (!conn.source || !conn.target) return;
      
      // Crear una clave única para la conexión
      const sourceId = conn.source.data.id;
      const targetId = conn.target.data.id;
      const key = `${Math.min(sourceId, targetId)}-${Math.max(sourceId, targetId)}-${conn.type}`;

      if (!seenConnections.has(key)) {
        seenConnections.add(key);
        uniqueConnections.push(conn);
      }
    });
    
    return uniqueConnections;
  }
  
  // Obtener las conexiones
  const connections = linkedRoot.connections || [];
  
  // Si no hay conexiones explícitas, crear las básicas basadas en la estructura
  if (connections.length === 0 && !isFamilySelection) {
    linkedRoot.leaves().forEach(source => {
      linkedRoot.leaves().forEach(target => {
        if (shouldConnect(source, target)) {
          // Determinar tipo de relación
          let relationType = 'other';
          if (source.data.children && source.data.children.some(c => c.id === target.data.id)) {
            relationType = 'child';
          } else if (source.data._parents && source.data._parents.some(p => p.id === target.data.id)) {
            relationType = 'parent';
          } else if (source.data.spouses && source.data.spouses.some(s => s.id === target.data.id)) {
            relationType = 'spouse';
          }
          
          connections.push({
            source,
            target,
            type: relationType
          });
        }
      });
    });
  }
  
  // Filtrar conexiones duplicadas
  const uniqueConnections = getUniqueConnections(connections);
  
  // Dibujar enlaces
  const link = g.append("g")
    .attr("fill", "none")
    .selectAll("path")
    .data(uniqueConnections)
    .join("path")
    .attr("class", d => `link ${d.type}`)
    .attr("stroke", colornone)
    .attr("stroke-width", 1)
    .attr("stroke-opacity", 0.5)
    .style("mix-blend-mode", "multiply")
    .attr("d", d => {
      if (!d.source || !d.target) return null;
      
      // Crear puntos para la curva usando la jerarquía de D3
      // Usar el método path para obtener los ancestros comunes
      const path = d.source.path(d.target);
      if (!path || path.length === 0) {
        // Fallback si path falla (puede pasar con nodos no directamente conectados en la jerarquía cluster)
        // Intentar construir un camino simple
        const points = [];
        let node = d.source;
        while (node) {
          points.push([node.x, node.y]);
          node = node.parent;
          if (node === d.target.parent) break; // Stop near common ancestor
        }
        
        let node2 = d.target;
        const points2 = [];
        while (node2 && node2 !== node) {
          points2.push([node2.x, node2.y]);
          node2 = node2.parent;
        }
        
        const simplePath = [...points, ...points2.reverse()];
        if (simplePath.length < 2) return null; // Necesita al menos 2 puntos
        return line(simplePath.map(p => ({ x: p[0], y: p[1] })));
      }
      
      // Usar el path de D3 si está disponible
      return line(path.map(n => ({ x: n.x, y: n.y })));
    })
    .each(function(d) { 
      d.path = this; 
      
      // Almacenar referencia a la conexión en ambos nodos
      d.source.connections.push(d);
      d.target.connections.push(d);
    });
  
  // Dibujar nodos (textos)
  const node = g.append("g")
    .selectAll("g")
    .data(linkedRoot.descendants()) // Usar todos los nodos
    .join("g")
    .attr("class", "node")
    .attr("transform", d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
    .append("text")
    .attr("dy", "0.31em")
    .attr("x", d => d.x < Math.PI ? 6 : -6)
    .attr("text-anchor", d => d.x < Math.PI ? "start" : "end")
    .attr("transform", d => d.x >= Math.PI ? "rotate(180)" : null)
    .attr("fill", "var(--v-theme-on-surface)")
    .text(d => d.data.name)
    .each(function(d) { d.text = this; })
    .on("mouseover", overed)
    .on("mouseout", outed)
    // Update click handler - Remove console logs
    .on("click", (event, d) => {
      if (event.ctrlKey) {
        // Ctrl+Click: Open modal (call new prop)
        if (onNodeModal) {
          onNodeModal(d.data);
        }
      } else {
        // Normal Click: Focus on family (call new prop)
        if (onNodeFocus) {
          onNodeFocus(d.data);
        }
      }
      // TODO: Add long-press detection for touch devices here or in parent component
    })
    .call(text => text.append("title").text(d => {
      // Mostrar información más detallada en el tooltip
      const parents = d.data._parents ? d.data._parents.length : 0;
      const children = d.data.children ? d.data.children.length : 0;
      const spouses = d.data.spouses ? d.data.spouses.length : 0;
      
      return `${d.data.name} (ID: ${d.data.id || 'N/A'})
Padres: ${parents}
Hijos: ${children}
Cónyuges: ${spouses}`;
    }));
  
  // Funciones para interactividad al pasar el ratón
  function overed(event, d) {
    link.style("mix-blend-mode", null);
    d3.select(this).attr("font-weight", "bold");
    
    // Mostrar todas las conexiones relacionadas con este nodo
    if (d.connections) {
      d.connections.forEach(conn => {
        let color;
        if (conn.type === 'parent' && conn.target === d) {
          color = colorParent;
        } else if (conn.type === 'child' && conn.source === d) {
          color = colorChild;
        } else if (conn.type === 'parent' && conn.source === d) {
          color = colorChild;
        } else if (conn.type === 'child' && conn.target === d) {
          color = colorParent;
        } else {
          color = colorOther;
        }
        d3.select(conn.path)
          .attr("stroke", color)
          .attr("stroke-width", 2.5)
          .attr("stroke-opacity", 0.9)
          .raise();
        d3.select(otherNodeText(conn, d))
          .attr("font-weight", "bold")
          .attr("fill", color);
      });
    }
  }
  
  function outed(event, d) {
    link.style("mix-blend-mode", "multiply")
        .attr("stroke", colornone)
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.5);
    
    // Restaurar estilos
    d3.select(this).attr("font-weight", null);
    
    // Restaurar todas las conexiones relacionadas con este nodo
    if (d.connections) {
      d.connections.forEach(conn => {
        d3.select(conn.path)
          .attr("stroke", colornone)
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0.5);
        
        // Restaurar el otro nodo conectado
        const otherNode = conn.source === d ? conn.target : conn.source;
        d3.select(otherNode.text)
          .attr("font-weight", null)
          .attr("fill", "var(--v-theme-on-surface)");
      });
    }
  }
  
  function otherNodeText(conn, d) {
    return conn.source === d ? conn.target.text : conn.source.text;
  }
  
  // Añadir leyenda y instrucciones
  const legendGroup = svg.append("g")
    .attr("transform", `translate(${-width / 2 + 20}, ${-height / 2 + 20})`);
    
  legendGroup.append("text")
    .attr("font-size", "14px")
    .attr("font-weight", "bold")
    .attr("fill", "var(--v-theme-on-surface)")
    .text(isFamilySelection ? "Familia seleccionada" : "Árbol Genealógico");
    
  legendGroup.append("text")
    .attr("y", 25)
    .attr("font-size", "12px")
    .attr("fill", "var(--v-theme-on-surface)")
    .text("Pasa el cursor sobre un nombre para ver conexiones");
    
  const legend = legendGroup.append("g")
    .attr("transform", "translate(0, 45)");
    
  // Conexión a padres
  legend.append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 20)
    .attr("y2", 0)
    .attr("stroke", colorParent)
    .attr("stroke-width", 2);
    
  legend.append("text")
    .attr("x", 25)
    .attr("y", 4)
    .attr("font-size", "10px")
    .attr("fill", "var(--v-theme-on-surface)")
    .text("Padres");
    
  // Conexión a hijos
  legend.append("line")
    .attr("x1", 0)
    .attr("y1", 15)
    .attr("x2", 20)
    .attr("y2", 15)
    .attr("stroke", colorChild)
    .attr("stroke-width", 2);
    
  legend.append("text")
    .attr("x", 25)
    .attr("y", 19)
    .attr("font-size", "10px")
    .attr("fill", "var(--v-theme-on-surface)")
    .text("Hijos");
    
  // Conexión a cónyuges
  legend.append("line")
    .attr("x1", 0)
    .attr("y1", 30)
    .attr("x2", 20)
    .attr("y2", 30)
    .attr("stroke", colorSpouse)
    .attr("stroke-width", 2);
    
  legend.append("text")
    .attr("x", 25)
    .attr("y", 34)
    .attr("font-size", "10px")
    .attr("fill", "var(--v-theme-on-surface)")
    .text("Cónyuges");

  // En caso de filtrado por familia, aplicar un zoom inicial para que se vea mejor
  if (isFamilySelection && linkedRoot.leaves().length < 10) {
    const initialScale = 2;
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(initialScale));
  }
  
  // Manejador de redimensión para ajustarse automáticamente
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
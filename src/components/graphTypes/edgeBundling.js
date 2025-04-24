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
  const totalNodes = rootData.descendants ? rootData.descendants().length : (rootData.nodes ? rootData.nodes.length : 1);
  // Radio base más un factor por nodo, con un máximo para evitar que se salga del SVG
  const baseRadius = Math.min(width, height) / 2 * 0.85;
  const dynamicRadius = Math.min(baseRadius + totalNodes * 10, Math.max(width, height) * 0.95);
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
    // --- NUEVO: Normalizar input si ya es un d3.hierarchy Node ---
    function isD3HierarchyNode(obj) {
      return obj && typeof obj === 'object' && 'data' in obj && 'depth' in obj && 'height' in obj && 'children' in obj;
    }

    if (isD3HierarchyNode(rootData)) {
      // El input ya es un nodo d3.hierarchy, úsalo directamente
      root = rootData;
      nodes = root.leaves ? root.leaves() : [];
    } else {
      // ...pipeline de construcción de jerarquía existente...
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
            .filter(Boolean); // <-- FILTRA hijos nulos AQUÍ
          return node;
        }
        // Limpiar marcas de visitado
        uniqueMap.forEach(n => { delete n._visited; });
        const rootNode = buildNode(rootData);
        // Limpieza extra: elimina hijos nulos en toda la estructura
        function cleanNullChildren(node) {
          if (!node || typeof node !== 'object') return;
          if (!Array.isArray(node.children)) node.children = [];
          node.children = node.children.filter(child => child && typeof child === 'object');
          node.children.forEach(child => cleanNullChildren(child));
        }
        cleanNullChildren(rootNode);
        return rootNode;
      }

      // --- NUEVO: Crear nodos d3.hierarchy solo para nodos únicos ---
      function hierarchyFromUnique(rootNode) {
        // Solución robusta: ignora hijos nulos y asegura children siempre es array
        function ensureChildrenSafe(node) {
          if (!node || typeof node !== 'object') return;
          // Si children es null o no array, pon array vacío
          if (!Array.isArray(node.children)) node.children = [];
          // Filtra hijos nulos o no-objeto
          node.children = node.children.filter(child => child && typeof child === 'object');
          node.children.forEach(child => ensureChildrenSafe(child));
        }
        ensureChildrenSafe(rootNode);
        // Si rootNode es null, abortar y mostrar error
        if (!rootNode) {
          console.error('Error: rootNode es null o inválido antes de pasar a d3.hierarchy.');
          return null;
        }
        // El callback de d3.hierarchy también filtra hijos nulos
        return d3.hierarchy(rootNode, d => Array.isArray(d.children) ? d.children.filter(c => c && typeof c === 'object') : []);
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
    
    // Si rootData.nodes existe, usar directamente estos datos (vista de familia)
    if (isFamilySelection && rootData.nodes) {
      rootData.nodes.forEach(node => {
        if (node && node.id) {
          idMap.set(node.id, {
            data: node,
            depth: 0,
            height: 0
          });
        }
      });
      return idMap;
    }

    // Usar todos los nodos únicos - modificación importante: usar datos originales si están disponibles
    if (rootData.nodes && !isFamilySelection) {
      // Si rootData tiene un array de nodos (datos originales), úsalos directamente
      rootData.nodes.forEach(node => {
        if (node && node.id) {
          // Crear un pseudo-nodo de jerarquía con la estructura que bilink espera
          idMap.set(node.id, {
            data: node,
            depth: 0,
            height: 0
          });
        }
      });
    } else {
      // Usar el enfoque de descendientes como fallback
      root.descendants().forEach(node => {
        if (node.data && node.data.id) {
          idMap.set(node.data.id, node);
        }
      });
    }
    
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
  
  // Obtener todas las relaciones posibles (padres, hijos, cónyuges) entre todos los nodos reales (no raíz artificial)
  function getAllRelations(root) {
    const idMap = createNodeMap(root);
    const relations = [];
    // Saltar el nodo raíz artificial (el primero, que no tiene id real)
    const nodes = root.descendants().filter(d => d.data && d.data.id);
    nodes.forEach(d => {
      // Hijos
      if (d.data.children && d.data.children.length) {
        d.data.children.forEach(child => {
          const childNode = idMap.get(child.id);
          // Solo conectar si ambos son personas reales
          if (childNode && childNode.data && childNode.data.id) {
            relations.push({ source: d, target: childNode, type: 'child' });
          }
        });
      }
      // Padres
      if (d.data._parents && d.data._parents.length) {
        d.data._parents.forEach(parent => {
          const parentNode = idMap.get(parent.id);
          if (parentNode && parentNode.data && parentNode.data.id) {
            relations.push({ source: d, target: parentNode, type: 'parent' });
          }
        });
      }
      // Cónyuges
      if (d.data.spouses && d.data.spouses.length) {
        d.data.spouses.forEach(spouse => {
          const spouseNode = idMap.get(spouse.id);
          if (spouseNode && spouseNode.data && spouseNode.data.id) {
            relations.push({ source: d, target: spouseNode, type: 'spouse' });
          }
        });
      }
    });
    return relations;
  }

  // NUEVO: Recorrer todos los nodos únicos, no solo root.descendants()
  function getAllRelationsFromAllNodes(root) {
    // Construir un mapa de todos los nodos únicos por id
    const idMap = createNodeMap(root);
    const allNodes = Array.from(idMap.values());
    const relations = [];
    allNodes.forEach(d => {
      // Hijos
      if (d.data.children && d.data.children.length) {
        d.data.children.forEach(child => {
          const childNode = idMap.get(child.id);
          if (childNode && childNode.data && childNode.data.id) {
            relations.push({ source: d, target: childNode, type: 'child' });
          }
        });
      }
      // Padres
      if (d.data._parents && d.data._parents.length) {
        d.data._parents.forEach(parent => {
          const parentNode = idMap.get(parent.id);
          if (parentNode && parentNode.data && parentNode.data.id) {
            relations.push({ source: d, target: parentNode, type: 'parent' });
          }
        });
      }
      // Cónyuges
      if (d.data.spouses && d.data.spouses.length) {
        d.data.spouses.forEach(spouse => {
          const spouseNode = idMap.get(spouse.id);
          if (spouseNode && spouseNode.data && spouseNode.data.id) {
            // Solo una dirección para evitar duplicados
            if (d.data.id < spouseNode.data.id) {
              relations.push({ source: d, target: spouseNode, type: 'spouse' });
            }
          }
        });
      }
    });
    return relations;
  }

  // Aplicar layout de cluster para disposición radial
  const cluster = d3.cluster()
    .size([2 * Math.PI, radius - 100]); // Usar el radio dinámico

  // --- NUEVO: Verificar si root es null antes de continuar ---
  if (!root) {
    console.error('Error: root es null después de la construcción de la jerarquía. Abortando renderizado.');
    return;
  }

  // Importante: Aplicar el layout de cluster para calcular posiciones
  const linkedRoot = bilink(cluster(root.sort((a, b) => 
    d3.ascending(a.height, b.height) || d3.ascending(a.data.name, b.data.name)
  )));

  // NUEVO: Guardar un mapa de posiciones para los nodos reales
  const nodePositions = new Map();
  
  // Recorrer los nodos del árbol y guardar sus posiciones
  linkedRoot.descendants().forEach(node => {
    if (node.data && node.data.id) {
      nodePositions.set(node.data.id, {
        x: node.x,
        y: node.y
      });
    }
  });
  
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
  
  // Filtrar conexiones - versión ULTRA permisiva
  function getUniqueConnections(connections) {
    console.log("Analizando conexiones para filtrar duplicados");
    console.log(`Conexiones totales antes de filtrar: ${connections.length}`);

    // Simplemente mantener todas las conexiones directas entre nodos
    // Más adelante sólo filtraremos casos obvios como NULL o self-links
    const validConnections = connections.filter(conn => {
      // Validar que source y target existan y no sean el mismo nodo
      if (!conn.source || !conn.target) return false;
      if (!conn.source.data || !conn.target.data) return false;
      if (!conn.source.data.id || !conn.target.data.id) return false;
      
      // No permitir conexiones de un nodo a sí mismo
      if (conn.source.data.id === conn.target.data.id) return false;
      
      // Si pasa todas las validaciones, es una conexión válida
      return true;
    });
    
    console.log(`Conexiones válidas después de filtrar casos inválidos: ${validConnections.length}`);
    
    // Opcional: visualizar algunos ejemplos de conexiones para debug
    if (validConnections.length > 0) {
      const samples = validConnections.slice(0, Math.min(5, validConnections.length));
      samples.forEach((conn, i) => {
        console.log(`Ejemplo conexión ${i+1}: ${conn.source.data.id} → ${conn.target.data.id} (${conn.type})`);
      });
    }
    
    return validConnections;
  }
  
  // Obtener las conexiones - COMPLETAMENTE REDISEÑADO
  let connections = [];
  
  console.log("Procesando conexiones directamente de los datos originales");
  
  // IMPORTANTE: Usando directamente rootData.nodes si es un array
  const allNodes = rootData.nodes && Array.isArray(rootData.nodes) 
    ? rootData.nodes 
    : (rootData.descendants ? rootData.descendants().map(d => d.data) : []);
  
  console.log(`Total de nodos encontrados: ${allNodes.length}`);
  
  // Crear un mapa simple de nodos por ID
  const nodeMap = new Map();
  const nodeObjectMap = new Map();
  
  // Primero mapear todos los nodos
  allNodes.forEach(node => {
    if (node && node.id) {
      // Crear un pseudo-nodo jerárquico si no existe
      // Este es esencialmente un nodo que D3 puede usar para el layout
      const hierarchyNode = {
        data: node,
        x: Math.random() * Math.PI * 2,  // Posición aleatoria 
        y: radius * 0.9,
        depth: 0,
        height: 0,
        incoming: [],
        outgoing: [],
        connections: []
      };
      
      nodeMap.set(node.id, hierarchyNode);
      nodeObjectMap.set(node.id, node);
    }
  });
  
  // Ahora procesar todas las relaciones posibles
  allNodes.forEach(node => {
    if (!node || !node.id) return;
    
    const sourceNode = nodeMap.get(node.id);
    if (!sourceNode) return;
    
    // Procesar hijos - explícito
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => {
        if (!child || !child.id) return;
        
        const targetNode = nodeMap.get(child.id);
        if (!targetNode) return;
        
        connections.push({
          source: sourceNode,
          target: targetNode,
          type: 'child'
        });
      });
    }
    
    // Procesar padres - explícito
    if (node._parents && Array.isArray(node._parents)) {
      node._parents.forEach(parent => {
        if (!parent || !parent.id) return;
        
        const targetNode = nodeMap.get(parent.id);
        if (!targetNode) return;
        
        connections.push({
          source: sourceNode,
          target: targetNode,
          type: 'parent'
        });
      });
    }
    
    // Procesar cónyuges - explícito
    if (node.spouses && Array.isArray(node.spouses)) {
      node.spouses.forEach(spouse => {
        if (!spouse || !spouse.id) return;
        
        // Solo agregar en una dirección para evitar duplicados
        if (node.id < spouse.id) {
          const targetNode = nodeMap.get(spouse.id);
          if (!targetNode) return;
          
          connections.push({
            source: sourceNode,
            target: targetNode,
            type: 'spouse'
          });
        }
      });
    }
  });
  
  console.log(`Conexiones antes de filtrar: ${connections.length}`);
  
  // Filtrar conexiones duplicadas con el método existente
  const uniqueConnections = getUniqueConnections(connections);
  
  // Actualizamos las listas incoming/outgoing para cada nodo
  uniqueConnections.forEach(conn => {
    if (!conn.source || !conn.target) return;
    
    // Para referencias cruzadas durante la interactividad
    conn.source.connections = conn.source.connections || [];
    conn.target.connections = conn.target.connections || [];
    
    conn.source.connections.push(conn);
    conn.target.connections.push(conn);
    
    // Para el layout (opcional)
    conn.source.outgoing = conn.source.outgoing || [];
    conn.target.incoming = conn.target.incoming || [];
    
    const type = conn.type;
    conn.source.outgoing.push([conn.source, conn.target, type]);
    conn.target.incoming.push([conn.source, conn.target, type]);
    
    // Si es esposo/a, crear referencia bidireccional
    if (type === 'spouse') {
      conn.source.incoming = conn.source.incoming || [];
      conn.target.outgoing = conn.target.outgoing || [];
      
      conn.source.incoming.push([conn.target, conn.source, type]);
      conn.target.outgoing.push([conn.target, conn.source, type]);
    }
  });
  
  // Log para depuración
  console.log(`Total de conexiones únicas procesadas: ${uniqueConnections.length}`);
  
  // Debugging
  console.log(`Total de conexiones únicas: ${uniqueConnections.length}`);
  
  // SECCIÓN MEJORADA: Colorear las líneas según el tipo de conexión
  const parentColor = "#ff7700";  // Naranja para padres
  const childColor = "#00aa00";   // Verde para hijos
  const spouseColor = "#7777ff";  // Azul para cónyuges
  const defaultColor = "#ccc";    // Gris para líneas sin tipo

  // Función mejorada para determinar el color según el tipo de conexión
  function getConnectionColor(type) {
    switch(type) {
      case 'parent': return parentColor;
      case 'child': return childColor;
      case 'spouse': return spouseColor;
      default: return defaultColor;
    }
  }

  // Dibujar enlaces - completamente revisado para usar colores correctos
  const link = g.append("g")
    .attr("fill", "none")
    .selectAll("path")
    .data(uniqueConnections)
    .join("path")
    .attr("class", d => `link ${d.type || 'undefined'}`)
    .attr("stroke", d => getConnectionColor(d.type))
    .attr("stroke-width", 1.5)  // Líneas más gruesas para mejor visualización
    .attr("stroke-opacity", 0.7)  // Mayor opacidad para mejor visibilidad
    .style("mix-blend-mode", "multiply")
    .attr("d", d => {
      // Si falta source o target, no dibujar nada
      if (!d.source || !d.target) return null;
      
      // Si no hay datos en source o target, no dibujar nada
      if (!d.source.data || !d.target.data) return null;
      
      // Obtener los IDs de los nodos conectados
      const sourceId = d.source.data.id;
      const targetId = d.target.data.id;

      // NO usar nodos artificiales o virtuales
      if (sourceId === '__virtual_root__' || targetId === '__virtual_root__') {
        return null; // No dibujamos conexiones a/desde el nodo raíz virtual
      }
      
      // Buscar los nodos reales en el árbol para obtener posiciones correctas
      const sourceNode = linkedRoot.descendants().find(node => node.data && node.data.id === sourceId);
      const targetNode = linkedRoot.descendants().find(node => node.data && node.data.id === targetId);
      
      // Si no encontramos las posiciones, no dibujar nada
      if (!sourceNode || !targetNode) return null;
      
      // Crear una curva suave entre los nodos usando sus posiciones reales
      return line([
        { x: sourceNode.x, y: sourceNode.y }, // Punto inicial
        { x: (sourceNode.x + targetNode.x) / 2, y: (sourceNode.y + targetNode.y) / 2 * 0.9 }, // Punto medio (curva)
        { x: targetNode.x, y: targetNode.y }  // Punto final
      ]);
    })
    .each(function(d) {
      // Guardar referencia al elemento SVG para interactividad
      d.path = this;
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
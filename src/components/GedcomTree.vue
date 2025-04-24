<template>
  <v-container fluid class="pa-0 ma-0 fill-height">
    <!-- Header is handled by App.vue -->
    <v-main>
      <v-container>
        <v-row justify="center">
          <v-col cols="12" md="10" lg="8">
            <v-card class="mb-4 pa-4">
              <v-file-input
                label="Seleccionar archivo GEDCOM (.ged, .gedcom)"
                accept=".ged,.gedcom"
                @change="onFileChange"
                variant="outlined"
                dense
                hide-details
              ></v-file-input>
              <v-alert v-if="error" type="error" dense class="mt-3">{{ error }}</v-alert>
            </v-card>

            <v-card class="mb-4 pa-3">
               <v-item-group v-model="graphType" mandatory class="d-flex flex-wrap justify-center">
                 <v-item v-for="type in graphTypes" :key="type.value" :value="type.value" v-slot="{ isSelected, toggle }">
                   <v-btn
                     :color="isSelected ? 'primary' : 'grey'"
                     class="ma-1"
                     @click="toggle"
                   >
                     {{ type.text }}
                   </v-btn>
                 </v-item>
               </v-item-group>
            </v-card>

            <v-card ref="treeContainerCard" class="overflow-hidden" style="height: 70vh;">
              <div ref="treeContainer" class="w-100 h-100"></div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <!-- Modal -->
    <v-dialog v-model="showModal" max-width="500px" scrollable>
       <v-card v-if="selectedNode">
         <v-card-title class="d-flex justify-space-between align-center">
           <span class="text-h5">Detalles del Individuo</span>
           <v-btn icon="mdi-close" variant="text" @click="showModal = false"></v-btn>
         </v-card-title>
         <v-divider></v-divider>
         <v-card-text style="max-height: 70vh;">
           <v-list dense>
             <v-list-item v-if="selectedNode.name">
               <v-list-item-title><strong>Nombre:</strong> {{ selectedNode.name }}</v-list-item-title>
             </v-list-item>
             <v-list-item v-if="selectedNode.id">
               <v-list-item-title><strong>ID:</strong> {{ selectedNode.id }}</v-list-item-title>
             </v-list-item>

             <!-- Birth/Death Info -->
             <template v-if="selectedNode.raw && selectedNode.raw.children">
               <template v-for="(child, idx) in selectedNode.raw.children" :key="'raw-'+idx">
                 <v-list-item v-if="child.type === 'BIRT' || child.type === 'DEAT'">
                   <v-list-item-title>
                     <strong>{{ child.type === 'BIRT' ? 'Nacimiento' : 'Fallecimiento' }}:</strong>
                     <template v-for="(sub, sidx) in child.children" :key="'raw-sub-'+sidx">
                       <span v-if="sub.type === 'DATE'"> {{ sub.value }}</span>
                       <span v-if="sub.type === 'PLAC'"> ({{ sub.value }})</span>
                     </template>
                   </v-list-item-title>
                 </v-list-item>
               </template>
             </template>

             <!-- Relationships -->
              <v-list-item v-if="selectedNode._parents && selectedNode._parents.length">
                <v-list-item-title><strong>Padres:</strong></v-list-item-title>
                <v-list class="ml-4" dense>
                  <v-list-item v-for="parent in selectedNode._parents" :key="parent.id">
                    <v-list-item-title>{{ parent.name }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-list-item>

             <v-list-item v-if="selectedNode.children && selectedNode.children.length">
               <v-list-item-title><strong>Hijos:</strong></v-list-item-title>
               <v-list class="ml-4" dense>
                 <v-list-item v-for="child in selectedNode.children" :key="child.id">
                   <v-list-item-title>{{ child.name }}</v-list-item-title>
                 </v-list-item>
               </v-list>
             </v-list-item>

             <v-list-item v-if="hermanos && hermanos.length">
               <v-list-item-title><strong>Hermanos:</strong></v-list-item-title>
               <v-list class="ml-4" dense>
                 <v-list-item v-for="hermano in hermanos" :key="hermano.id">
                   <v-list-item-title>{{ hermano.name }}</v-list-item-title>
                 </v-list-item>
               </v-list>
             </v-list-item>

             <v-list-item v-if="conyuges && conyuges.length">
               <v-list-item-title><strong>Cónyuges:</strong></v-list-item-title>
               <v-list class="ml-4" dense>
                 <v-list-item v-for="conyuge in conyuges" :key="conyuge.id">
                   <v-list-item-title>{{ conyuge.name }}</v-list-item-title>
                 </v-list-item>
               </v-list>
             </v-list-item>
           </v-list>
         </v-card-text>
         <v-divider></v-divider>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="blue darken-1" text @click="showModal = false">Cerrar</v-btn>
          </v-card-actions>
       </v-card>
     </v-dialog>

  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount } from 'vue';
import * as parseGedcom from 'parse-gedcom';
import { renderForceGraph } from './graphTypes/forceGraph';
import { renderTreeHorizontal } from './graphTypes/treeHorizontal';
import { renderTreeVertical } from './graphTypes/treeVertical';
import { renderTreeRadial } from './graphTypes/treeRadial';
import { renderHourglassGraph } from './graphTypes/hourglassGraph';
import * as d3 from 'd3';
import { useTheme } from 'vuetify'

const theme = useTheme();

const gedcomData = ref(null);
const error = ref(null);
const selectedNode = ref(null);
const showModal = ref(false);
const forceGraphData = ref(null); // Renamed to avoid confusion with D3 simulation object
const simulation = ref(null);
const treeRootData = ref(null); // Renamed for clarity
const graphType = ref('force');
const treeContainer = ref(null);
const treeContainerCard = ref(null);
const currentWidth = ref(0);
const currentHeight = ref(0);
const resizeObserver = ref(null);


const graphTypes = [
  { text: 'Force', value: 'force' },
  { text: 'Horizontal', value: 'horizontal' },
  { text: 'Vertical', value: 'vertical' },
  { text: 'Radial', value: 'radial' },
  // { text: 'Hourglass', value: 'hourglass' }, // Temporarily disable hourglass
];

// --- Computed Properties ---
const hermanos = computed(() => {
  // Asegurarse que selectedNode y sus propiedades necesarias existan
  if (!selectedNode.value || !selectedNode.value._parents) return [];
  const siblings = new Set();
  // Asegurarse que parent.children exista
  selectedNode.value._parents.forEach(parent => {
    if (parent.children) {
      parent.children.forEach(child => {
        // Asegurarse que child.id y selectedNode.value.id existan antes de comparar
        if (child.id && selectedNode.value.id && child.id !== selectedNode.value.id) {
           siblings.add(child);
        }
      });
    }
  });
  return Array.from(siblings);
});

const conyuges = computed(() => {
   // Asegurarse que las propiedades necesarias existan
   if (!selectedNode.value || !selectedNode.value.id || !gedcomData.value || !forceGraphData.value?.nodes) return [];
   const result = new Set();
   const indiId = selectedNode.value.id;
   gedcomData.value.children.forEach(node => {
     if (node.type === 'FAM') {
       let husb = null, wife = null;
       node.children.forEach(n => {
         if (n.type === 'HUSB') husb = n.data?.pointer;
         if (n.type === 'WIFE') wife = n.data?.pointer;
       });
       // Asegurarse que forceGraphData.value.nodes exista antes de usar .find()
       if (husb === indiId && wife) {
         const found = forceGraphData.value.nodes.find(n => n.id === wife);
         if (found) result.add(found);
       }
       if (wife === indiId && husb) {
         const found = forceGraphData.value.nodes.find(n => n.id === husb);
         if (found) result.add(found);
       }
     }
   });
   return Array.from(result);
});

// --- Methods ---
const onFileChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const text = evt.target.result;
      gedcomData.value = parseGedcom.parse(text);
      error.value = null;
      selectedNode.value = null;
      showModal.value = false;

      // Build data structures first
      forceGraphData.value = buildForceGraphData(gedcomData.value.children);
      treeRootData.value = buildTreeRootData(forceGraphData.value); // Pass processed nodes

      // Reset graph type to default if needed, or keep current one
      // graphType.value = 'force';

      // Trigger rendering AFTER data is ready
      nextTick(() => {
          setupResizeObserver(); // Setup observer after file load
          // Initial render will be triggered by observer callback
      });

    } catch (err) {
      // ... existing error handling ...
      gedcomData.value = null;
      forceGraphData.value = null;
      treeRootData.value = null;
      clearTree();
    }
  };
  reader.readAsText(file);
};

// Renamed: Builds the {nodes, links} structure for force layout AND base for tree
const buildForceGraphData = (gedcomNodes) => {
  const individuals = {};
  const families = {};

  // Pass 1: Create individual nodes
  gedcomNodes.forEach(node => {
    if (node.type === 'INDI') {
      const id = node.data?.xref_id;
      if (!id) return;
      const nameNode = node.children.find(n => n.type === 'NAME');
      individuals[id] = {
        id,
        name: nameNode ? nameNode.value.replace(/[\/\\]/g, '').trim() : 'Sin nombre',
        raw: node, // Keep raw data for details modal
        generation: null,
        _parents: [], // References to parent objects
        children: [], // References to child objects (for tree)
        // D3 simulation properties will be added later, keep data clean initially
      };
    }
    if (node.type === 'FAM') {
      const id = node.data?.xref_id;
      if (id) families[id] = node;
    }
  });

  // Pass 2: Link individuals based on families
  const links = [];
  Object.values(families).forEach(fam => {
    let parentIds = [];
    let childIds = [];

    fam.children.forEach(n => {
      const pointer = n.data?.pointer;
      if (!pointer || !individuals[pointer]) return;

      if (n.type === 'HUSB' || n.type === 'WIFE') {
        parentIds.push(pointer);
      }
      if (n.type === 'CHIL') {
        childIds.push(pointer);
      }
    });

    // Link parents to children
    parentIds.forEach(parentId => {
      childIds.forEach(childId => {
        const parentNode = individuals[parentId];
        const childNode = individuals[childId];
        if (parentNode && childNode) {
          links.push({ source: parentId, target: childId, type: 'parent' });
          // Add references for tree building and details modal
          if (!childNode._parents.some(p => p.id === parentId)) {
              childNode._parents.push(parentNode);
          }
          if (!parentNode.children.some(c => c.id === childId)) {
              parentNode.children.push(childNode);
          }
        }
      });
    });

    // Link spouses
    if (parentIds.length === 2) {
      links.push({ source: parentIds[0], target: parentIds[1], type: 'spouse' });
    }
  });

  const nodes = Object.values(individuals);

  // Calculate generations (optional but useful for coloring/layout)
   const roots = nodes.filter(n => n._parents.length === 0);
   const visited = new Set();
   function setGeneration(node, gen) {
       if (!node || visited.has(node.id)) return;
       visited.add(node.id);
       // Assign generation if null or if this path is shorter
       if (node.generation === null || gen < node.generation) {
           node.generation = gen;
       }
       // Recursively set for children
       node.children.forEach(child => setGeneration(child, gen + 1));
   }
   roots.forEach(root => setGeneration(root, 0));
   // Assign generation to others who might not be reachable from main roots (e.g., separate trees)
   nodes.forEach(n => { if (n.generation === null) n.generation = 0; }); // Or handle differently


  // Return a deep clone for force layout if D3 modifies it? No, D3 works on the objects.
  // Just ensure tree building uses the correct references.
  return { nodes, links };
};

// Renamed: Builds the hierarchical root structure needed for D3 tree layouts
const buildTreeRootData = (graphData) => {
    if (!graphData || !graphData.nodes) return null;

    // Create a map for quick lookup
    const individualsMap = new Map(graphData.nodes.map(n => [n.id, n]));

    // Find root nodes (those without parents in *this* dataset)
    const roots = graphData.nodes.filter(n => n._parents.length === 0);

    if (roots.length === 0 && graphData.nodes.length > 0) {
        console.warn("No root nodes found. Creating a virtual root.");
        // Handle cases with no clear root (cycles, or only partial data)
        // Create a virtual root containing all nodes as children
        return { name: 'Raíces Múltiples', id: '__virtual_root__', children: graphData.nodes };
    }

    if (roots.length === 1) {
        // If single root, use it directly
        return roots[0];
    } else {
        // If multiple roots, create a virtual root
        return { name: 'Raíces', id: '__virtual_root__', children: roots };
    }
    // Note: D3 hierarchy will handle the recursive structure based on the 'children' arrays
};


const clearTree = () => {
  console.log("Clearing tree container");
  if (simulation.value) {
    simulation.value.stop(); // Stop force simulation if running
    simulation.value = null;
  }
  if (treeContainer.value) {
    d3.select(treeContainer.value).selectAll('*').remove(); // Remove all SVG elements
  } else {
      console.warn("clearTree called but treeContainer ref is null");
  }
};

const handleNodeClick = (d) => {
    // D3 hierarchy nodes wrap data in d.data, force nodes are direct
    const nodeData = d.data ? d.data : d;
    // Find the original node data if needed (e.g., to get raw GEDCOM)
    const originalNode = forceGraphData.value?.nodes.find(n => n.id === nodeData.id);
    selectedNode.value = originalNode || nodeData; // Prefer original node with full data
    showModal.value = true;
    console.log("Node clicked:", selectedNode.value);
};

const setupResizeObserver = () => {
    if (resizeObserver.value) {
        resizeObserver.value.disconnect(); // Disconnect previous observer if any
    }
    if (!treeContainerCard.value?.$el) {
        console.error("Cannot set up ResizeObserver: treeContainerCard element not found.");
        return;
    }

    resizeObserver.value = new ResizeObserver(entries => {
        if (!entries || entries.length === 0) return;
        const { width, height } = entries[0].contentRect;

        if (width > 0 && height > 0 && (width !== currentWidth.value || height !== currentHeight.value)) {
            console.log(`Resized to: ${width}x${height}`);
            currentWidth.value = width;
            currentHeight.value = height;
            // Debounce or directly call renderGraph if dimensions are stable
            renderGraph(); // Re-render with new dimensions
        }
    });

    resizeObserver.value.observe(treeContainerCard.value.$el);
    console.log("ResizeObserver set up on card element.");
};


const renderGraph = () => {
  // Ensure data and container are ready
  if (!treeContainer.value || currentWidth.value <= 0 || currentHeight.value <= 0) {
      console.warn("Render conditions not met:", { hasContainer: !!treeContainer.value, width: currentWidth.value, height: currentHeight.value });
      return; // Wait for valid dimensions
  }
  if (graphType.value === 'force' && !forceGraphData.value) {
      error.value = "Datos para grafo de fuerza no disponibles.";
      console.error(error.value);
      return;
  }
   if (['horizontal', 'vertical', 'radial', 'hourglass'].includes(graphType.value) && !treeRootData.value) {
       error.value = "Datos para la estructura de árbol no disponibles.";
       console.error(error.value);
       return;
   }

  clearTree(); // Clear previous graph FIRST

  console.log(`Rendering graph type: ${graphType.value} with dimensions ${currentWidth.value}x${currentHeight.value}`);
  error.value = null; // Clear previous errors

  try {
    const width = currentWidth.value;
    const height = currentHeight.value;

    if (graphType.value === 'force') {
        if (!forceGraphData.value || !forceGraphData.value.nodes.length) throw new Error('No hay nodos para el grafo de fuerza.');
        // Pass a copy? D3 modifies nodes. Let's assume it's okay for now.
        simulation.value = renderForceGraph(forceGraphData.value, treeContainer.value, width, height, handleNodeClick);
    } else { // Tree layouts
        if (!treeRootData.value) throw new Error('No hay datos raíz para el árbol.');

        // D3 hierarchy handles the structure. Check if root has children OR is a single node.
        const rootHierarchy = d3.hierarchy(treeRootData.value);
        if (!rootHierarchy.children && rootHierarchy.data.id === '__virtual_root__') {
             throw new Error('La estructura de árbol está vacía.');
        }

        console.log("Rendering tree layout with root:", treeRootData.value);

        if (graphType.value === 'horizontal') {
            renderTreeHorizontal(treeRootData.value, treeContainer.value, width, height, handleNodeClick);
        } else if (graphType.value === 'vertical') {
            renderTreeVertical(treeRootData.value, treeContainer.value, width, height, handleNodeClick);
        } else if (graphType.value === 'radial') {
            renderTreeRadial(treeRootData.value, treeContainer.value, width, height, handleNodeClick);
        } else if (graphType.value === 'hourglass') {
             // Basic hourglass implementation using the root node
             renderHourglassGraph(treeRootData.value, treeContainer.value, width, height, handleNodeClick);
             // TODO: Implement proper hourglass based on selected node if needed
        }
    }
  } catch (err) {
      console.error("Error rendering graph:", err);
      error.value = err.message || 'Error al dibujar el gráfico.';
      clearTree(); // Clear potentially broken SVG
  }
};


// --- Watchers ---
watch(graphType, (newType, oldType) => {
  console.log(`Graph type changed from ${oldType} to ${newType}`);
  if (gedcomData.value) { // Only re-render if data is loaded
    // Data structures (forceGraphData, treeRootData) should already exist
    nextTick(renderGraph);
  }
});

watch(() => theme.global.current.value.dark, () => {
    if (gedcomData.value) {
        // Re-render needed to apply theme colors used in graphTypes/*.js
        nextTick(renderGraph);
    }
});

// --- Lifecycle Hooks ---
onMounted(() => {
  // Setup observer when component mounts, but rendering waits for file load/dimensions
  // setupResizeObserver(); // Moved to after file load
});

// Clean up observer when component unmounts
onBeforeUnmount(() => {
    if (resizeObserver.value) {
        resizeObserver.value.disconnect();
        console.log("ResizeObserver disconnected.");
    }
});

</script>

<style>
/* Add styles for the graph container if needed, e.g., background */
.h-100 {
  height: 100%;
}
.w-100 {
  width: 100%;
}
/* Ensure SVG elements inherit font styles */
svg text {
  font-family: sans-serif;
  font-size: 10px;
  /* Fill color is set dynamically in JS based on theme */
}

/* Style links */
svg .link {
  fill: none;
  stroke: #555;
  stroke-opacity: 0.4;
  stroke-width: 1.5px;
}

/* Style nodes */
svg .node circle {
  /* Fill and stroke are set dynamically in JS */
  stroke-width: 1.5px;
  cursor: pointer;
}

/* Style node text */
svg .node text {
  cursor: pointer;
  /* Fill color is set dynamically */
}

/* Ensure dialog content is readable */
.v-dialog .v-card-text {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.v-dialog .v-list-item-title strong {
 color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}

</style>
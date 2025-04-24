<template>
  <v-container fluid class="pa-0 ma-0 fill-height">
    <!-- Header is handled by App.vue -->
    <v-main>
      <v-container>
        <v-row justify="center">
          <v-col cols="12" md="10" lg="12">
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
               <div class="d-flex flex-wrap justify-space-between align-center">
                 <!-- Graph Type Selection -->
                 <v-item-group v-model="graphType" mandatory class="d-flex flex-wrap justify-center flex-grow-1">
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

                 <!-- Back Button -->
                 <v-btn
                   v-if="viewHistory.length > 0 && graphType === 'radial'"
                   @click="goBack"
                   color="secondary"
                   class="ml-2"
                   prepend-icon="mdi-arrow-left"
                 >
                   Atrás
                 </v-btn>
               </div>

               <!-- Selector de familias para Agrupamiento Relacional -->
               <v-expand-transition>
                 <div v-if="graphType === 'radial' && familyGroups.length > 0" class="mt-3">
                   <v-divider class="mb-3"></v-divider>
                   <v-autocomplete
                     v-model="selectedFamily"
                     :items="familyGroups"
                     item-title="name"
                     item-value="id"
                     label="Seleccionar familia para visualizar"
                     variant="outlined"
                     density="comfortable"
                     clearable
                     @update:model-value="onFamilySelected"
                   >
                     <template v-slot:prepend-item>
                       <v-list-item @click="selectedFamily = null; onFamilySelected(null)">
                         <v-list-item-title>
                           <strong>Ver árbol completo</strong>
                         </v-list-item-title>
                       </v-list-item>
                       <v-divider class="mt-2"></v-divider>
                     </template>
                   </v-autocomplete>
                 </div>
               </v-expand-transition>
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
                   <v-list-item-subtitle v-for="event in conyuge.relationshipEvents" :key="event.type">
                     <strong>{{ event.type }}:</strong>
                     <span v-if="event.date"> {{ event.date }}</span>
                     <span v-if="event.place"> ({{ event.place }})</span>
                   </v-list-item-subtitle>
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
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount, shallowRef } from 'vue';
import * as parseGedcom from 'parse-gedcom';
import { renderForceGraph } from './graphTypes/forceGraph';
import { renderTreeHorizontal } from './graphTypes/treeHorizontal';
import { renderHourglassGraph } from './graphTypes/hourglassGraph';
import { renderResplandorRadial } from './graphTypes/zoomableSunburst';
import { renderAgrupamientoRelacional } from './graphTypes/edgeBundling';
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
const familyGroups = ref([]);
const selectedFamily = ref(null);

// --- NEW State for View History and Current View ---
const viewHistory = shallowRef([]); // Use shallowRef for performance if states are large
const currentViewData = shallowRef(null); // Holds the data object currently being rendered (full tree or family subset)
const individualsMap = shallowRef(new Map()); // Map for quick node lookup by ID

const graphTypes = [
  { text: 'Force', value: 'force' },
  { text: 'Horizontal', value: 'horizontal' },
  { text: 'Resplandor Radial', value: 'vertical' },
  { text: 'Agrupamiento Relacional', value: 'radial' },
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
   const result = [];
   const indiId = selectedNode.value.id;
   
   gedcomData.value.children.forEach(node => {
     if (node.type === 'FAM') {
       let husb = null, wife = null;
       // Buscar información sobre cónyuges
       node.children.forEach(n => {
         if (n.type === 'HUSB') husb = n.data?.pointer;
         if (n.type === 'WIFE') wife = n.data?.pointer;
       });
       
       // Si la persona seleccionada es parte de esta familia como cónyuge
       if ((husb === indiId && wife) || (wife === indiId && husb)) {
         // Determinar quién es el cónyuge (el otro)
         const conyugeId = husb === indiId ? wife : husb;
         const found = forceGraphData.value.nodes.find(n => n.id === conyugeId);
         
         if (found) {
           // Objeto para almacenar todos los eventos de relación
           const relationshipEvents = [];
           
           // Buscar todos los eventos relacionados con la relación (matrimonio, divorcio, separación, etc.)
           node.children.forEach(event => {
             // Evento de matrimonio tradicional
             if (event.type === 'MARR') {
               const eventInfo = {
                 type: 'Matrimonio',
                 date: null,
                 place: null
               };
               
               event.children?.forEach(detail => {
                 if (detail.type === 'DATE') eventInfo.date = detail.value;
                 if (detail.type === 'PLAC') eventInfo.place = detail.value;
               });
               
               relationshipEvents.push(eventInfo);
             }
             
             // Evento de divorcio tradicional
             else if (event.type === 'DIV') {
               const eventInfo = {
                 type: 'Divorcio',
                 date: null,
                 place: null
               };
               
               event.children?.forEach(detail => {
                 if (detail.type === 'DATE') eventInfo.date = detail.value;
                 if (detail.type === 'PLAC') eventInfo.place = detail.value;
               });
               
               relationshipEvents.push(eventInfo);
             }
             
             // Eventos genéricos con un TYPE especificado (separación, etc.)
             else if (event.type === 'EVEN') {
               const eventType = event.children?.find(c => c.type === 'TYPE')?.value || 'Evento';
               
               // Solo procesamos si es un evento relacionado con la relación
               // Podemos ampliar esta lista según sea necesario
               if (['Separation', 'Separación', 'Anulación', 'Annulment', 'Compromiso', 'Engagement'].includes(eventType)) {
                 const eventInfo = {
                   type: eventType === 'Separation' ? 'Separación' : eventType,
                   date: null,
                   place: null
                 };
                 
                 event.children?.forEach(detail => {
                   if (detail.type === 'DATE') eventInfo.date = detail.value;
                   if (detail.type === 'PLAC') eventInfo.place = detail.value;
                 });
                 
                 relationshipEvents.push(eventInfo);
               }
             }
           });
           
           // Agregar el cónyuge junto con la información de eventos de relación
           result.push({
             ...found, // Datos del individuo
             relationshipEvents // Todos los eventos de relación
           });
         }
       }
     }
   });
   
   return result;
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
      viewHistory.value = []; // Clear history on new file
      selectedFamily.value = null; // Clear family selection

      // Build data structures first
      forceGraphData.value = buildForceGraphData(gedcomData.value.children);
      individualsMap.value = new Map(forceGraphData.value.nodes.map(n => [n.id, n])); // Populate map
      treeRootData.value = buildTreeRootData(forceGraphData.value); // Pass processed nodes
      familyGroups.value = buildFamilyGroups(gedcomData.value.children, individualsMap.value); // Build family groups

      // Set initial view data based on graph type
      currentViewData.value = ['horizontal', 'vertical', 'radial', 'hourglass'].includes(graphType.value)
          ? treeRootData.value
          : forceGraphData.value;

      // Reset graph type to default if needed, or keep current one
      // graphType.value = 'force';

      // Trigger rendering AFTER data is ready
      nextTick(() => {
          setupResizeObserver(); // Setup observer after file load
          // Initial render will be triggered by observer callback
          if (currentWidth.value > 0 && currentHeight.value > 0) {
              renderGraph();
          }
      });

    } catch (err) {
      // ... existing error handling ...
      console.error("Error processing GEDCOM:", err);
      error.value = `Error al procesar el archivo: ${err.message}`;
      gedcomData.value = null;
      forceGraphData.value = null;
      treeRootData.value = null;
      individualsMap.value.clear();
      familyGroups.value = [];
      viewHistory.value = [];
      currentViewData.value = null;
      clearTree();
    }
  };
  reader.readAsText(file);
};

// Renamed: Builds the {nodes, links} structure for force layout AND base for tree
const buildForceGraphData = (gedcomNodes) => {
  const individuals = {};
  const families = {};
  const spousesMap = new Map(); // Track spouses for each individual

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
        spouses: [], // References to spouse objects
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
      const parentNode = individuals[parentId];
      childIds.forEach(childId => {
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
      const p1 = individuals[parentIds[0]];
      const p2 = individuals[parentIds[1]];
      if (p1 && p2) {
        links.push({ source: parentIds[0], target: parentIds[1], type: 'spouse' });
        if (!p1.spouses.some(s => s.id === parentIds[1])) {
            p1.spouses.push(p2);
        }
        if (!p2.spouses.some(s => s.id === parentIds[0])) {
            p2.spouses.push(p1);
        }
      }
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

  // Crear un mapa para búsqueda rápida
  const individualsMap = new Map(graphData.nodes.map(n => [n.id, n]));

  // Encontrar nodos raíz (aquellos sin padres en este conjunto de datos)
  const roots = graphData.nodes.filter(n => n._parents.length === 0);

  if (roots.length === 0 && graphData.nodes.length > 0) {
    console.warn("No root nodes found. Creating a virtual root.");
    // Crear una raíz virtual que contenga todos los nodos como hijos
    return { name: 'Raíces Múltiples', id: '__virtual_root__', children: graphData.nodes };
  }

  if (roots.length === 1) {
    // Si hay un solo nodo raíz, usarlo directamente
    return { ...roots[0], children: roots[0].children || [] };
  } else {
    // Si hay múltiples raíces, crear una raíz virtual
    return { name: 'Raíces', id: '__virtual_root__', children: roots };
  }
};

// Update buildFamilyGroups to use the individualsMap
const buildFamilyGroups = (gedcomNodes, individualsMap) => {
  const families = [];
  gedcomNodes.forEach(node => {
    if (node.type === 'FAM') {
      const id = node.data?.xref_id;
      if (!id) return;

      const husbId = node.children.find(n => n.type === 'HUSB')?.data?.pointer;
      const wifeId = node.children.find(n => n.type === 'WIFE')?.data?.pointer;

      const husbName = individualsMap.get(husbId)?.name || 'Desconocido';
      const wifeName = individualsMap.get(wifeId)?.name || 'Desconocida';

      families.push({
        id,
        name: `${husbName} & ${wifeName}`,
        raw: node // Keep raw FAM data if needed
      });
    }
  });
  return families.sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
};

// --- NEW Focus and Navigation Logic ---

const handleNodeFocus = (personData) => {
  console.log("Focus requested for:", personData.name);
  const person = individualsMap.value.get(personData.id);
  if (!person) {
      console.error("Person not found in map:", personData.id);
      return;
  }

  // Save current state BEFORE changing view
  if (currentViewData.value) {
      viewHistory.value.push(currentViewData.value);
  }

  // Gather nodes: person, parents, spouses, children
  const familyNodeSet = new Set();
  familyNodeSet.add(person);
  person._parents.forEach(p => familyNodeSet.add(p));
  person.spouses.forEach(s => familyNodeSet.add(s));
  person.children.forEach(c => familyNodeSet.add(c));

  const familyNodes = Array.from(familyNodeSet);
  const familyNodeIds = new Set(familyNodes.map(n => n.id));

  // Gather links connecting ONLY these nodes
  const familyLinks = [];
  familyNodes.forEach(node => {
      // Parent links (Child -> Parent)
      node._parents.forEach(parent => {
          if (familyNodeIds.has(parent.id)) {
              // Add both directions? EdgeBundling might handle this, let's add specific types
              familyLinks.push({ source: node.id, target: parent.id, type: 'parent' }); // Child points to Parent
              familyLinks.push({ source: parent.id, target: node.id, type: 'child' }); // Parent points to Child
          }
      });
      // Spouse links
      node.spouses.forEach(spouse => {
          if (familyNodeIds.has(spouse.id)) {
              // Add only one direction for spouses to avoid duplicates if getUniqueConnections sorts
              if (node.id < spouse.id) {
                  familyLinks.push({ source: node.id, target: spouse.id, type: 'spouse' });
              }
          }
      });
      // Child links already covered by parent links check above
  });

  // Create the new data structure for the radial view
  const familyGraphData = {
      nodes: familyNodes,
      links: familyLinks,
      // Add a flag or name to indicate this is a focused view
      _isFamilyFocus: true,
      _focusPersonName: person.name
  };

  currentViewData.value = familyGraphData;
  selectedFamily.value = null; // Clear dropdown selection when focusing manually
  nextTick(renderGraph);
};

const handleNodeModal = (d) => {
    // D3 hierarchy nodes wrap data in d.data, force nodes are direct
    const nodeData = d.data ? d.data : d;
    // Find the original node data using the map
    const originalNode = individualsMap.value.get(nodeData.id);
    selectedNode.value = originalNode || nodeData; // Prefer original node with full data
    showModal.value = true;
    console.log("Modal requested for:", selectedNode.value?.name);
};

const goBack = () => {
  if (viewHistory.value.length > 0) {
    const previousViewData = viewHistory.value.pop();
    currentViewData.value = previousViewData;
    selectedFamily.value = null; // Clear dropdown selection when going back
    nextTick(renderGraph);
  } else {
      console.log("No history to go back to.");
  }
};

// --- Updated Interaction Logic ---

const onFamilySelected = (familyId) => {
  viewHistory.value = []; // Clear history when selecting from dropdown

  if (!familyId) {
    // Render full tree
    currentViewData.value = treeRootData.value; // Set view to full tree
    nextTick(renderGraph);
    return;
  }

  const family = familyGroups.value.find(f => f.id === familyId);
  if (!family || !family.raw) {
      console.error("Selected family or raw data not found:", familyId);
      currentViewData.value = treeRootData.value; // Fallback to full tree
      nextTick(renderGraph);
      return;
  }

  // --- Logic similar to handleNodeFocus but based on FAM record ---
  const familyNodeSet = new Set();
  const familyLinks = [];
  const familyNodeIds = new Set();

  // Add parents (HUSB, WIFE) and children (CHIL) from FAM record
  family.raw.children.forEach(n => {
    const pointer = n.data?.pointer;
    if (!pointer) return;

    if (n.type === 'HUSB' || n.type === 'WIFE' || n.type === 'CHIL') {
      const individual = individualsMap.value.get(pointer);
      if (individual) {
        familyNodeSet.add(individual);
        familyNodeIds.add(individual.id);
      }
    }
  });

  const familyNodes = Array.from(familyNodeSet);

  // Rebuild links based on the nodes found
  familyNodes.forEach(node => {
      // Parent links
      node._parents.forEach(parent => {
          if (familyNodeIds.has(parent.id)) {
              familyLinks.push({ source: node.id, target: parent.id, type: 'parent' });
              familyLinks.push({ source: parent.id, target: node.id, type: 'child' });
          }
      });
      // Spouse links
      node.spouses.forEach(spouse => {
          if (familyNodeIds.has(spouse.id)) {
              if (node.id < spouse.id) { // Avoid duplicates
                  familyLinks.push({ source: node.id, target: spouse.id, type: 'spouse' });
              }
          }
      });
  });

  const familyGraphData = {
      nodes: familyNodes,
      links: familyLinks,
      _isFamilyFocus: true, // Mark as focused view
      _focusPersonName: family.name // Use family name
  };

  currentViewData.value = familyGraphData;
  nextTick(renderGraph);
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


// --- Updated Render Logic ---
const renderGraph = () => {
  // Ensure container and dimensions are ready
  if (!treeContainer.value || currentWidth.value <= 0 || currentHeight.value <= 0) {
      console.warn("Render conditions not met (container/dimensions):", { hasContainer: !!treeContainer.value, width: currentWidth.value, height: currentHeight.value });
      return;
  }

  // Determine the data to render based on currentViewData
  let dataToRender = currentViewData.value ||
                       (['horizontal', 'vertical', 'radial', 'hourglass'].includes(graphType.value)
                           ? treeRootData.value
                           : forceGraphData.value);

  // Check if data is valid for the selected graph type
  if (!dataToRender) {
      // Don't show error if it's just initial load without data
      if (gedcomData.value) {
          error.value = "No hay datos disponibles para visualizar.";
          console.error(error.value);
      } else {
          console.log("Waiting for data to load...");
      }
      clearTree();
      return;
  }
  // Specific checks for data structure based on type
  if (graphType.value === 'force' && (!dataToRender.nodes || !dataToRender.links)) {
      error.value = "Datos inválidos para grafo de fuerza (se esperan nodos y enlaces).";
      console.error(error.value, dataToRender);
      clearTree();
      return;
  }
  // For tree types, check if it's hierarchical or the special family focus structure
  if (['horizontal', 'vertical', 'radial', 'hourglass'].includes(graphType.value)) {
      if (!dataToRender.children && !dataToRender._isFamilyFocus && dataToRender.id !== '__virtual_root__') {
          // It's not a standard hierarchy root and not our special family focus object
          // Check if it's a single node (might happen if root has no children)
          if (!dataToRender.id || !dataToRender.name) {
              error.value = "Datos inválidos para la estructura de árbol.";
              console.error(error.value, dataToRender);
              clearTree();
              return;
          }
          // If it's just a single node, wrap it for hierarchy function
          // dataToRender = { name: "Raíz Única", children: [dataToRender] }; // D3 might handle single node okay
      }
  }

  // Asegurarse de que los datos sean válidos antes de renderizar
  if (!dataToRender || (graphType.value === 'radial' && !dataToRender.children && !dataToRender.nodes)) {
    console.error("Datos inválidos para el gráfico:", dataToRender);
    error.value = "Datos inválidos para el gráfico.";
    clearTree();
    return;
  }

  // Convertir a jerarquía de D3 si es necesario
  if (graphType.value === 'radial' && dataToRender && !dataToRender.descendants) {
    try {
      dataToRender = d3.hierarchy(dataToRender, d => (d && d.children) || []);
    } catch (error) {
      console.error("Error al convertir dataToRender a jerarquía de D3:", error);
      error.value = "Error al procesar los datos para el gráfico radial.";
      clearTree();
      return;
    }
  }

  clearTree(); // Clear previous graph

  console.log(`Rendering graph type: ${graphType.value} with data:`, dataToRender);
  error.value = null; // Clear previous errors

  try {
    const width = currentWidth.value;
    const height = currentHeight.value;

    // Pass BOTH handlers to all graph types for simplicity,
    // let the specific renderer decide which one to use on click.
    // EdgeBundling uses both, others might just use handleNodeModal.
    const nodeFocusHandler = handleNodeFocus;
    const nodeModalHandler = handleNodeModal;

    if (graphType.value === 'force') {
        if (!dataToRender.nodes || !dataToRender.nodes.length) throw new Error('No hay nodos para el grafo de fuerza.');
        simulation.value = renderForceGraph(dataToRender, treeContainer.value, width, height, nodeModalHandler); // Force graph typically just opens modal
    } else if (graphType.value === 'horizontal') {
        renderTreeHorizontal(dataToRender, treeContainer.value, width, height, nodeModalHandler); // Tree typically just opens modal
    } else if (graphType.value === 'vertical') {
        renderResplandorRadial(dataToRender, treeContainer.value, width, height, nodeModalHandler); // Sunburst typically just opens modal
    } else if (graphType.value === 'radial') {
        // Pass both handlers to Agrupamiento Relacional
        renderAgrupamientoRelacional(dataToRender, treeContainer.value, width, height, nodeFocusHandler, nodeModalHandler);
    } else if (graphType.value === 'hourglass') {
         renderHourglassGraph(dataToRender, treeContainer.value, width, height, nodeModalHandler); // Hourglass typically just opens modal
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
  if (gedcomData.value) {
    // Reset view to full data when changing graph type? Or keep focus?
    // Let's reset to full view for simplicity.
    viewHistory.value = []; // Clear history
    selectedFamily.value = null; // Clear family selection
    currentViewData.value = ['horizontal', 'vertical', 'radial', 'hourglass'].includes(newType)
        ? treeRootData.value
        : forceGraphData.value;
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
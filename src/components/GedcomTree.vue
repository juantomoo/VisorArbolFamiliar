<template>
  <v-container fluid class="pa-0 ma-0 fill-height">
    <v-main>
      <v-container>
        <v-row justify="center">
          <v-col cols="12" md="10" lg="12">
            <v-card class="mb-4 pa-4">
              <div class="d-flex align-center flex-wrap gap-2">
                <v-file-input
                  label="Seleccionar archivo GEDCOM (.ged, .gedcom)"
                  accept=".ged,.gedcom"
                  @change="onFileChange"
                  variant="outlined"
                  density="compact"  
                  hide-details
                  style="max-width: 320px;"
                ></v-file-input>
                <v-text-field
                  v-model="gedcomFileName"
                  label="Nombre de archivo (sin extensión)"
                  variant="outlined"
                  density="compact"
                  hide-details
                  style="max-width: 260px;"
                  @keyup.enter="onLoadGedcomByName"
                ></v-text-field>
                <v-btn color="primary" @click="onLoadGedcomByName" :disabled="!gedcomFileName">
                  Cargar por nombre
                </v-btn>
              </div>
              <v-alert v-if="error" type="error" dense class="mt-3">{{ error }}</v-alert>
            </v-card>

            <v-card class="mb-4 pa-3">
               <div class="d-flex flex-wrap justify-space-between align-center">
                 <v-item-group v-model="graphType" mandatory class="d-flex flex-wrap justify-center flex-grow-1">
                   <v-item v-for="type in graphTypes" :key="type.value" :value="type.value" v-slot="{ isSelected, toggle }">
                     <v-btn
                       :color="isSelected ? 'primary' : 'grey'"
                       class="ma-1"
                       size="small" 
                       @click="toggle"
                     >
                       {{ type.text }}
                     </v-btn>
                   </v-item>
                 </v-item-group>

                 <v-btn
                   v-if="viewHistory.length > 0 && graphType === 'radial'"
                   @click="goBack"
                   color="secondary"
                   class="ml-2"
                   size="small" 
                   prepend-icon="mdi-arrow-left"
                 >
                   Atrás
                 </v-btn>
               </div>

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
                     hide-details
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
              <div class="d-flex justify-end align-center pr-2 pt-2" style="position: absolute; z-index: 2; right: 0;">
                <v-btn icon size="small" @click="zoomIn" :disabled="!gedcomData">
                  <v-icon>mdi-magnify-plus-outline</v-icon>
                </v-btn>
                <v-btn icon size="small" @click="zoomOut" :disabled="!gedcomData">
                  <v-icon>mdi-magnify-minus-outline</v-icon>
                </v-btn>
                <v-btn icon size="small" @click="toggleFullscreen">
                  <v-icon>mdi-fullscreen</v-icon>
                </v-btn>
              </div>
              <div ref="treeContainer" id="treeContainer" class="w-100 h-100"></div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <v-dialog v-model="showModal" max-width="600px" scrollable :attach="treeContainerCard?.$el || undefined"> 
       <v-card v-if="selectedNode" class="modal-diag"  style="background-color: var(--v-theme-surface); color: var(--v-theme-on-surface);">
       <v-card-title class="d-flex justify-space-between align-center">
         <span class="text-h5">Detalles del Individuo</span>
         <v-btn icon="mdi-close" variant="text" @click="showModal = false"></v-btn>
       </v-card-title>
       <v-divider></v-divider>
       <v-card-text style="max-height: 70vh;">
         <v-list density="compact"> 
         <v-list-item v-if="selectedNode.name">
           <v-list-item-title><strong>Nombre:</strong> {{ selectedNode.name }}</v-list-item-title>
         </v-list-item>
         <v-list-item v-if="selectedNode.id">
           <v-list-item-title><strong>ID:</strong> {{ selectedNode.id }}</v-list-item-title>
         </v-list-item>

         <template v-if="selectedNode.raw && selectedNode.raw.children">
           <template v-for="(child, idx) in selectedNode.raw.children" :key="'raw-'+idx">
           <v-list-item v-if="child.type === 'BIRT' || child.type === 'DEAT'">
             <v-list-item-title>
             <strong>{{ child.type === 'BIRT' ? 'Nacimiento' : 'Fallecimiento' }}:</strong>
             <template v-for="(sub, sidx) in child.children" :key="'raw-sub-'+sidx">
               <span v-if="sub.type === 'DATE'"> {{ sub.value || 'Fecha desconocida' }}</span>
               <span v-if="sub.type === 'PLAC'"> ({{ sub.value || 'Lugar desconocido' }})</span>
             </template>
             <span v-if="!child.children || child.children.length === 0"> Información no disponible</span>
             </v-list-item-title>
           </v-list-item>
           </template>
         </template>

         <v-list-item v-if="selectedNode._parents && selectedNode._parents.length">
          <v-list-item-title><strong>Padres:</strong></v-list-item-title>
          <v-list class="ml-4" density="compact">
            <v-list-item v-for="parent in selectedNode._parents" :key="parent.id">
            <v-list-item-title>{{ parent.name || 'Desconocido' }}</v-list-item-title>
            </v-list-item>
          </v-list>
          </v-list-item>

         <v-list-item v-if="selectedNode.children && selectedNode.children.length">
           <v-list-item-title><strong>Hijos:</strong></v-list-item-title>
           <v-list class="ml-4" density="compact">
           <v-list-item v-for="child in selectedNode.children" :key="child.id">
             <v-list-item-title>{{ child.name || 'Desconocido' }}</v-list-item-title>
           </v-list-item>
           </v-list>
         </v-list-item>

         <v-list-item v-if="hermanos && hermanos.length">
           <v-list-item-title><strong>Hermanos:</strong></v-list-item-title>
           <v-list class="ml-4" density="compact">
           <v-list-item v-for="hermano in hermanos" :key="hermano.id">
             <v-list-item-title>{{ hermano.name || 'Desconocido' }}</v-list-item-title>
           </v-list-item>
           </v-list>
         </v-list-item>

         <v-list-item v-if="conyuges && conyuges.length">
           <v-list-item-title><strong>Cónyuges:</strong></v-list-item-title>
           <v-list class="ml-4" density="compact">
           <v-list-item v-for="conyuge in conyuges" :key="conyuge.id">
             <v-list-item-title>{{ conyuge.name || 'Desconocido' }}</v-list-item-title>
             <v-list-item-subtitle v-if="conyuge.relationshipEvents && conyuge.relationshipEvents.length > 0">
               <div v-for="event in conyuge.relationshipEvents" :key="event.type + (event.date || '')" class="ml-2">
                <strong>{{ event.type }}:</strong>
                <span v-if="event.date"> {{ event.date }}</span>
                <span v-if="event.place"> ({{ event.place }})</span>
                <span v-if="!event.date && !event.place"> Información no disponible</span>
               </div>
             </v-list-item-subtitle>
             <v-list-item-subtitle v-else class="ml-2">
               (No hay eventos de relación registrados)
             </v-list-item-subtitle>
           </v-list-item>
           </v-list>
         </v-list-item>
         </v-list>
       </v-card-text>
       <v-divider></v-divider>
        <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" variant="text" @click="showModal = false">Cerrar</v-btn> 
        </v-card-actions>
       </v-card>
       <v-card v-else style="background-color: var(--v-theme-surface); color: var(--v-theme-on-surface);">
        <v-card-text>No hay datos de nodo para mostrar.</v-card-text>
       </v-card>
     </v-dialog>

  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount, shallowRef } from 'vue';
import * as parseGedcom from 'parse-gedcom';
// Importa las funciones de renderizado de los diferentes tipos de gráficos
// Asegúrate de que las rutas sean correctas según tu estructura de proyecto
import { renderForceGraph } from './graphTypes/forceGraph';
import { renderTreeHorizontal } from './graphTypes/treeHorizontal';
import { renderHourglassGraph } from './graphTypes/hourglassGraph';
import { renderResplandorRadial } from './graphTypes/zoomableSunburst';
import { renderAgrupamientoRelacional } from './graphTypes/edgeBundling';
import * as d3 from 'd3';
import { useTheme } from 'vuetify'

const theme = useTheme();

// --- State ---
const gedcomData = ref(null); // Datos GEDCOM parseados
const error = ref(null); // Mensaje de error
const selectedNode = ref(null); // Nodo seleccionado para el modal
const showModal = ref(false); // Visibilidad del modal
const forceGraphData = ref(null); // Datos para grafo de fuerza {nodes, links}
const simulation = ref(null); // Simulación D3 para grafo de fuerza
const treeRootData = ref(null); // Datos jerárquicos para árboles (puede ser null si no hay raíz única)
const graphType = ref('force'); // Tipo de gráfico seleccionado por defecto
const treeContainer = ref(null); // Ref al div contenedor del SVG
const treeContainerCard = ref(null); // Ref al v-card que contiene el div
const currentWidth = ref(0); // Ancho actual del contenedor
const currentHeight = ref(0); // Alto actual del contenedor
const resizeObserver = ref(null); // Observador de redimensionamiento
const familyGroups = ref([]); // Lista de grupos familiares para el selector
const selectedFamily = ref(null); // ID de la familia seleccionada en el selector radial
const isFullscreen = ref(false);
let d3Zoom = null; // Referencia a la instancia de zoom de D3

// --- State for View History and Current View (Radial Graph Focus) ---
const viewHistory = shallowRef([]); // Historial de vistas para el botón "Atrás" (usa shallowRef por rendimiento)
const currentViewData = shallowRef(null); // Datos que se están renderizando actualmente (árbol completo o subconjunto familiar)
const individualsMap = shallowRef(new Map()); // Mapa para búsqueda rápida de nodos por ID

const gedcomFileName = ref("");

const onLoadGedcomByName = async () => {
  if (!gedcomFileName.value) return;
  const fileUrl = `/` + gedcomFileName.value + `.ged`;
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('No se pudo cargar el archivo.');
    const text = await response.text();
    gedcomData.value = parseGedcom.parse(text);
    error.value = null;
    selectedNode.value = null;
    showModal.value = false;
    viewHistory.value = [];
    selectedFamily.value = null;
    currentViewData.value = null;
    forceGraphData.value = buildForceGraphData(gedcomData.value.children);
    individualsMap.value = new Map(forceGraphData.value.nodes.map(n => [n.id, n]));
    treeRootData.value = buildTreeRootData(forceGraphData.value);
    familyGroups.value = buildFamilyGroups(gedcomData.value.children, individualsMap.value);
    if (["horizontal", "vertical", "hourglass"].includes(graphType.value)) {
      currentViewData.value = treeRootData.value;
    } else {
      currentViewData.value = forceGraphData.value;
    }
    nextTick(() => {
      if (!resizeObserver.value) setupResizeObserver();
      if (currentWidth.value > 0 && currentHeight.value > 0) {
        renderGraph();
      } else {
        const cardElement = treeContainerCard.value?.$el;
        if(cardElement) {
          const initialRect = cardElement.getBoundingClientRect();
          if (initialRect.width > 0 && initialRect.height > 0) {
            currentWidth.value = initialRect.width;
            currentHeight.value = initialRect.height;
            renderGraph();
          }
        }
      }
    });
  } catch (err) {
    error.value = 'No se pudo cargar el archivo: ' + (err.message || 'Error desconocido.');
    gedcomData.value = null;
    forceGraphData.value = null;
    treeRootData.value = null;
    individualsMap.value.clear();
    familyGroups.value = [];
    viewHistory.value = [];
    currentViewData.value = null;
    selectedNode.value = null;
    showModal.value = false;
    clearTree();
  }
};

// --- Constants ---
const graphTypes = [
  { text: 'Force', value: 'force' }, // Grafo de fuerza
  { text: 'Horizontal', value: 'horizontal' }, // Árbol horizontal
  { text: 'Resplandor Radial', value: 'vertical' }, // Sunburst (llamado vertical aquí)
  { text: 'Agrupamiento Relacional', value: 'radial' }, // Edge Bundling
  // { text: 'Hourglass', value: 'hourglass' }, // Gráfico de reloj de arena (deshabilitado temporalmente)
];

// --- Computed Properties ---

// Calcula los hermanos del nodo seleccionado para el modal
const hermanos = computed(() => {
  if (!selectedNode.value || !selectedNode.value._parents) return [];
  const siblings = new Set();
  selectedNode.value._parents.forEach(parent => {
    // Asegúrate de que el padre exista en el mapa principal para obtener sus hijos actualizados
    const fullParentData = individualsMap.value.get(parent.id);
    if (fullParentData && fullParentData.children) {
      fullParentData.children.forEach(childRef => {
          // Compara IDs, asegurándose de que no es el nodo seleccionado
        if (childRef.id && selectedNode.value.id && childRef.id !== selectedNode.value.id) {
            // Añade la referencia completa del hermano desde el mapa si existe
            const siblingNode = individualsMap.value.get(childRef.id);
            if(siblingNode) siblings.add(siblingNode);
        }
      });
    }
  });
  return Array.from(siblings);
});

// Calcula los cónyuges y eventos de relación del nodo seleccionado para el modal
const conyuges = computed(() => {
   // Necesitamos el nodo seleccionado, datos GEDCOM y el mapa de individuos
   if (!selectedNode.value || !selectedNode.value.id || !gedcomData.value || !individualsMap.value.size) return [];

   const result = [];
   const indiId = selectedNode.value.id;

   // Itera sobre los datos GEDCOM buscando registros FAM
   gedcomData.value.children.forEach(node => {
     if (node.type === 'FAM') {
       let husbId = null, wifeId = null;
       // Encuentra los IDs de esposo (HUSB) y esposa (WIFE) en la familia
       node.children.forEach(n => {
         if (n.type === 'HUSB') husbId = n.data?.pointer;
         if (n.type === 'WIFE') wifeId = n.data?.pointer;
       });

       // Verifica si el individuo seleccionado es uno de los cónyuges en esta FAM
       if ((husbId === indiId && wifeId) || (wifeId === indiId && husbId)) {
         // Determina el ID del otro cónyuge
         const conyugeId = husbId === indiId ? wifeId : husbId;
         // Busca al cónyuge en nuestro mapa de individuos
         const spouseNode = individualsMap.value.get(conyugeId);

         if (spouseNode) {
           // Recopila eventos de relación (Matrimonio, Divorcio, etc.) de esta FAM
           const relationshipEvents = [];
           node.children.forEach(event => {
             let eventInfo = null;
             // Matrimonio
             if (event.type === 'MARR') {
               eventInfo = { type: 'Matrimonio', date: null, place: null };
             }
             // Divorcio
             else if (event.type === 'DIV') {
               eventInfo = { type: 'Divorcio', date: null, place: null };
             }
             // Otros eventos (Separación, Anulación, Compromiso, etc.)
             else if (event.type === 'EVEN') {
               const eventTypeRaw = event.children?.find(c => c.type === 'TYPE')?.value || 'Evento';
               const relationshipEventTypes = {
                 'Separation': 'Separación', 'Annulment': 'Anulación', 'Engagement': 'Compromiso'
                 // Añade más mapeos si es necesario
               };
               const mappedType = relationshipEventTypes[eventTypeRaw] || eventTypeRaw;
               // Solo incluye eventos que consideramos de relación
               if (['Separación', 'Anulación', 'Compromiso'].includes(mappedType) || eventTypeRaw === 'Separation' || eventTypeRaw === 'Annulment' || eventTypeRaw === 'Engagement') {
                   eventInfo = { type: mappedType, date: null, place: null };
               }
             }

             // Si se identificó un evento de relación, busca fecha y lugar
             if (eventInfo) {
                 event.children?.forEach(detail => {
                   if (detail.type === 'DATE') eventInfo.date = detail.value;
                   if (detail.type === 'PLAC') eventInfo.place = detail.value;
                 });
                 relationshipEvents.push(eventInfo);
             }
           });
           // Añade el cónyuge encontrado junto con sus eventos de relación a los resultados
           result.push({
             ...spouseNode, // Copia las propiedades del nodo cónyuge
             relationshipEvents // Añade los eventos encontrados
           });
         }
       }
     }
   });

   return result; // Devuelve la lista de cónyuges con sus eventos
});


// --- Methods ---

// Maneja la selección de un archivo GEDCOM
const onFileChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const text = evt.target.result;
      gedcomData.value = parseGedcom.parse(text); // Parsea el archivo
      error.value = null; // Limpia errores previos
      // Resetea estado relacionado con la visualización anterior
      selectedNode.value = null;
      showModal.value = false;
      viewHistory.value = [];
      selectedFamily.value = null;
      currentViewData.value = null; // Importante resetear vista actual

      // Construye estructuras de datos necesarias A PARTIR DEL NUEVO ARCHIVO
      forceGraphData.value = buildForceGraphData(gedcomData.value.children);
      individualsMap.value = new Map(forceGraphData.value.nodes.map(n => [n.id, n])); // Popula el mapa ID -> Nodo
      treeRootData.value = buildTreeRootData(forceGraphData.value); // Construye datos jerárquicos si es posible
      familyGroups.value = buildFamilyGroups(gedcomData.value.children, individualsMap.value); // Construye lista de familias

      // Establece los datos iniciales a visualizar según el tipo de gráfico ACTUALMENTE seleccionado
      if (['horizontal', 'vertical', 'hourglass'].includes(graphType.value)) {
          currentViewData.value = treeRootData.value; // Jerárquico para árboles
      } else { // 'force' y 'radial'
          currentViewData.value = forceGraphData.value; // {nodes, links}
      }

      // Espera al siguiente tick para asegurar que el DOM esté listo
      nextTick(() => {
        if (!resizeObserver.value) { // Configura el observador SOLO si no existe ya
             setupResizeObserver();
        }
        // Renderiza inmediatamente si ya hay dimensiones, si no, el observer lo hará
        if (currentWidth.value > 0 && currentHeight.value > 0) {
          renderGraph();
        } else {
            // Fuerza la obtención de dimensiones iniciales si el observer no lo hizo aún
            const cardElement = treeContainerCard.value?.$el;
            if(cardElement) {
                const initialRect = cardElement.getBoundingClientRect();
                if (initialRect.width > 0 && initialRect.height > 0) {
                    currentWidth.value = initialRect.width;
                    currentHeight.value = initialRect.height;
                    renderGraph();
                }
            }
        }
      });

    } catch (err) {
      console.error("Error processing GEDCOM:", err);
      error.value = `Error al procesar el archivo: ${err.message || 'Formato inválido o error inesperado.'}`;
      // Limpia TODO el estado en caso de error
      gedcomData.value = null;
      forceGraphData.value = null;
      treeRootData.value = null;
      individualsMap.value.clear();
      familyGroups.value = [];
      viewHistory.value = [];
      currentViewData.value = null;
      selectedNode.value = null;
      showModal.value = false;
      clearTree(); // Limpia el SVG
    }
  };
  reader.onerror = (err) => {
      console.error("Error reading file:", err);
      error.value = "Error al leer el archivo.";
      clearTree();
  };
  reader.readAsText(file);
};

// Construye la estructura {nodes, links} para grafos de fuerza y radial
// También añade referencias _parents, children, spouses a cada nodo
const buildForceGraphData = (gedcomNodes) => {
  const individuals = {}; // Almacena nodos individuales por ID
  const families = {}; // Almacena registros FAM por ID

  // Pass 1: Crear nodos individuales a partir de registros INDI
  gedcomNodes.forEach(node => {
    if (node.type === 'INDI') {
      const id = node.data?.xref_id;
      if (!id) {
          console.warn("Individuo sin ID encontrado, será ignorado:", node);
          return; // Ignora individuos sin ID
      }
      const nameNode = node.children?.find(n => n.type === 'NAME');
      // Crea el objeto nodo básico
      individuals[id] = {
        id,
        name: nameNode ? nameNode.value.replace(/[\/\\]/g, '').trim() : `Individuo ${id}`, // Nombre o ID por defecto
        raw: node, // Guarda datos crudos para el modal
        generation: null, // Se calculará después
        _parents: [], // Referencias a objetos nodo padre (se llenará en Pass 2)
        children: [], // Referencias a objetos nodo hijo (se llenará en Pass 2)
        spouses: [], // Referencias a objetos nodo cónyuge (se llenará en Pass 2)
      };
    }
    // Almacena registros FAM para Pass 2
    if (node.type === 'FAM') {
      const id = node.data?.xref_id;
      if (id) families[id] = node;
      else console.warn("Familia sin ID encontrada, será ignorada:", node);
    }
  });

  // Pass 2: Enlazar individuos basado en familias y añadir referencias cruzadas
  const links = []; // Array para los enlaces de la visualización
  Object.values(families).forEach(fam => {
    let parentIds = []; // IDs de padres (HUSB, WIFE) en esta familia
    let childIds = []; // IDs de hijos (CHIL) en esta familia

    // Extrae IDs de padres e hijos de la familia actual
    fam.children?.forEach(n => {
      const pointer = n.data?.pointer;
      // Importante: Verifica que el individuo apuntado exista en nuestro mapa 'individuals'
      if (pointer && individuals[pointer]) {
          if (n.type === 'HUSB' || n.type === 'WIFE') parentIds.push(pointer);
          if (n.type === 'CHIL') childIds.push(pointer);
      } else if (pointer) {
          console.warn(`Referencia a individuo inexistente (${pointer}) en FAM ${fam.data?.xref_id}`);
      }
    });

    // Enlazar padres con hijos y añadir referencias _parents/children
    parentIds.forEach(parentId => {
      const parentNode = individuals[parentId]; // Nodo padre ya existe
      childIds.forEach(childId => {
        const childNode = individuals[childId]; // Nodo hijo ya existe
        // Crea el enlace para D3 si ambos nodos existen
        links.push({ source: parentId, target: childId, type: 'parent' }); // Enlace visual
        // Añade referencias cruzadas en los objetos nodo si no existen ya
        if (!childNode._parents.some(p => p.id === parentId)) {
          childNode._parents.push(parentNode); // Hijo referencia al Padre
        }
        if (!parentNode.children.some(c => c.id === childId)) {
          parentNode.children.push(childNode); // Padre referencia al Hijo
        }
      });
    });

    // Enlazar cónyuges y añadir referencias spouses
    if (parentIds.length === 2) {
      const p1Id = parentIds[0];
      const p2Id = parentIds[1];
      const p1Node = individuals[p1Id];
      const p2Node = individuals[p2Id];
      // Crea el enlace para D3
      links.push({ source: p1Id, target: p2Id, type: 'spouse' }); // Enlace visual
      // Añade referencias cruzadas en los objetos nodo si no existen ya
      if (!p1Node.spouses.some(s => s.id === p2Id)) {
        p1Node.spouses.push(p2Node); // p1 referencia a p2 como cónyuge
      }
      if (!p2Node.spouses.some(s => s.id === p1Id)) {
        p2Node.spouses.push(p1Node); // p2 referencia a p1 como cónyuge
      }
    } else if (parentIds.length === 1) {
        // Podría ser una familia monoparental o incompleta, no se crean enlaces de cónyuge.
        // Se podría añadir lógica aquí si se desea manejar explícitamente.
    }
  });

  const nodes = Object.values(individuals); // Array final de nodos

  // Calcular generaciones (opcional, útil para colorear/layout)
  const roots = nodes.filter(n => n._parents.length === 0); // Nodos sin padres en este dataset
  const visited = new Set();
  function setGeneration(node, gen) {
    if (!node || visited.has(node.id)) return; // Evita ciclos y redundancia
    visited.add(node.id);
    // Asigna generación si es null o si este camino es más corto (menos generaciones)
    if (node.generation === null || gen < node.generation) {
      node.generation = gen;
    }
    // Recursivamente para hijos
    node.children.forEach(childRef => {
        // Importante: Llama a setGeneration con el nodo completo del mapa
        const childNode = individuals[childRef.id];
        if(childNode) setGeneration(childNode, gen + 1);
    });
  }
  // Inicia el cálculo desde cada raíz encontrada
  roots.forEach(root => setGeneration(root, 0));
  // Asigna generación 0 a nodos no alcanzados (posibles árboles desconectados)
  nodes.forEach(n => { if (n.generation === null) n.generation = 0; });

  console.log(`buildForceGraphData: ${nodes.length} nodos, ${links.length} enlaces.`);
  return { nodes, links }; // Devuelve la estructura para D3
};


// Construye la estructura de raíz jerárquica para D3 Tree/Cluster/Sunburst
const buildTreeRootData = (graphData) => {
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) return null;

  // Usa el mapa ya creado para eficiencia
  const individualsMapLocal = new Map(graphData.nodes.map(n => [n.id, n]));

  // Encuentra nodos raíz (sin padres en ESTE conjunto de datos)
  // Asegúrate de que _parents se refiere a los nodos completos, no solo IDs
  const roots = graphData.nodes.filter(n => !n._parents || n._parents.length === 0);

  if (roots.length === 0) {
    console.warn("No se encontraron nodos raíz (sin padres). Creando raíz virtual con todos los nodos.");
    // Crea una raíz virtual que contenga todos los nodos como hijos directos
    // Esto es útil para visualizar grafos desconectados o cíclicos como un "bosque"
    return { name: 'Raíces Múltiples', id: '__virtual_root__', children: graphData.nodes };
  }

  if (roots.length === 1) {
    console.log("Se encontró una única raíz:", roots[0].name);
    // Si hay una sola raíz, D3 la manejará directamente.
    // No es necesario clonar aquí si buildForceGraphData ya lo hizo,
    // pero asegúrate de que la propiedad 'children' esté presente.
    return roots[0];
  } else {
    console.warn(`Se encontraron ${roots.length} raíces. Creando raíz virtual.`);
    // Si hay múltiples raíces, crea una raíz virtual para que D3 las agrupe
    return { name: 'Raíces Múltiples', id: '__virtual_root__', children: roots };
  }
};


// Construye la lista de grupos familiares para el selector
const buildFamilyGroups = (gedcomNodes, individualsMap) => {
  const families = [];
  gedcomNodes.forEach(node => {
    if (node.type === 'FAM') {
      const id = node.data?.xref_id;
      if (!id) return; // Ignora familias sin ID

      const husbId = node.children?.find(n => n.type === 'HUSB')?.data?.pointer;
      const wifeId = node.children?.find(n => n.type === 'WIFE')?.data?.pointer;

      // Usa el mapa para obtener nombres eficientemente
      const husbName = individualsMap.get(husbId)?.name || '??'; // Nombre corto para desconocido
      const wifeName = individualsMap.get(wifeId)?.name || '??';

      // Cuenta hijos para posible información adicional
      const childCount = node.children?.filter(n => n.type === 'CHIL').length || 0;

      families.push({
        id,
        name: `${husbName} & ${wifeName} (${childCount} hijos)`, // Nombre descriptivo
        raw: node // Guarda datos crudos de FAM si se necesitan después
      });
    }
  });
  // Ordena alfabéticamente por el nombre generado
  return families.sort((a, b) => a.name.localeCompare(b.name));
};

// --- Focus and Navigation Logic (for Radial Graph) ---

// Enfoca la vista radial en una persona y su familia inmediata
const handleNodeFocus = (personData) => {
  // Verifica que personData y su ID existan
  if (!personData || !personData.id) {
      console.error("handleNodeFocus: Se recibió personData inválido.");
      return;
  }
  console.log("Solicitud de enfoque para:", personData.name || personData.id);
  // Busca a la persona en el mapa principal usando el ID
  const person = individualsMap.value.get(personData.id);
  if (!person) {
    console.error("Persona no encontrada en el mapa:", personData.id);
    return; // No se puede enfocar si la persona no está en el mapa
  }

  // Guarda el estado actual ANTES de cambiar la vista, si es diferente al último guardado
  if (currentViewData.value && (!viewHistory.value.length || viewHistory.value[viewHistory.value.length - 1] !== currentViewData.value)) {
     viewHistory.value.push(currentViewData.value);
     console.log("Historial guardado, tamaño:", viewHistory.value.length);
  }

  // Reúne nodos: la persona, sus padres, sus cónyuges, y sus hijos
  const familyNodeSet = new Set();
  familyNodeSet.add(person); // Añade a la persona central
  // Añade padres (asegúrate de que existan en el mapa)
  person._parents?.forEach(pRef => individualsMap.value.has(pRef.id) && familyNodeSet.add(individualsMap.value.get(pRef.id)));
  // Añade cónyuges
  person.spouses?.forEach(sRef => individualsMap.value.has(sRef.id) && familyNodeSet.add(individualsMap.value.get(sRef.id)));
  // Añade hijos
  person.children?.forEach(cRef => individualsMap.value.has(cRef.id) && familyNodeSet.add(individualsMap.value.get(cRef.id)));

  const familyNodes = Array.from(familyNodeSet); // Convierte el Set a Array
  const familyNodeIds = new Set(familyNodes.map(n => n.id)); // Set de IDs para búsqueda rápida

  // Reúne enlaces que conectan SOLAMENTE a los nodos de este grupo familiar
  const familyLinks = [];
  // Itera sobre TODOS los enlaces originales del grafo completo
  forceGraphData.value.links.forEach(link => {
    // Obtiene IDs de source y target (pueden ser objetos o strings)
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    // Si AMBOS extremos del enlace pertenecen al grupo familiar, incluye el enlace
    if (familyNodeIds.has(sourceId) && familyNodeIds.has(targetId)) {
      // Asegura que el enlace use los IDs, no los objetos nodo completos
      familyLinks.push({ ...link, source: sourceId, target: targetId });
    }
  });

  // Crea la nueva estructura de datos para la vista radial enfocada
  const familyGraphData = {
    nodes: familyNodes, // Nodos del grupo familiar
    links: familyLinks, // Enlaces filtrados del grupo familiar
    _isFamilyFocus: true, // Marca como vista enfocada
    _focusPersonName: person.name || person.id // Guarda el nombre para posible título
  };

  currentViewData.value = familyGraphData; // Actualiza los datos a renderizar
  selectedFamily.value = null; // Limpia selección del dropdown (ya que enfocamos manualmente)
  console.log(`Enfocando en ${person.name}. Nodos: ${familyNodes.length}, Enlaces: ${familyLinks.length}`);
  nextTick(renderGraph); // Renderiza la nueva vista enfocada
};


// Abre el modal con detalles del nodo
const handleNodeModal = (d) => {
  // Los nodos de jerarquía D3 envuelven datos en d.data, los nodos de fuerza/radial son directos
  const nodeData = d?.data ? d.data : d; // Obtiene los datos subyacentes
  if (!nodeData || !nodeData.id) {
      console.error("handleNodeModal: Datos de nodo inválidos o sin ID.", d);
      selectedNode.value = null; // Limpia selección
      showModal.value = false;
      return;
  }
  // Encuentra los datos originales completos usando el mapa principal
  const originalNode = individualsMap.value.get(nodeData.id);
  if (!originalNode) {
      console.error("handleNodeModal: Nodo no encontrado en individualsMap:", nodeData.id);
      // Podríamos mostrar el nodeData parcial, pero es mejor indicar el error
      selectedNode.value = { name: `Error: Nodo ${nodeData.id} no encontrado`, id: nodeData.id, raw: null, _parents:[], children:[], spouses:[] };
  } else {
      selectedNode.value = originalNode; // Usa el nodo completo del mapa
  }
  console.log("Solicitud de modal para:", selectedNode.value?.name);
  showModal.value = true; // Muestra el modal
};


// Retrocede en el historial de vistas del gráfico radial
const goBack = () => {
  if (viewHistory.value.length > 0) {
    const previousViewData = viewHistory.value.pop(); // Saca la última vista guardada
    currentViewData.value = previousViewData; // Restaura datos anteriores
    selectedFamily.value = null; // Limpia selección del dropdown
    console.log("Retrocediendo en historial. Vistas restantes:", viewHistory.value.length);
    nextTick(renderGraph); // Renderiza vista anterior
  } else {
    console.log("No hay historial para retroceder.");
    // Opcional: Podríamos volver a la vista completa si no hay historial
    // currentViewData.value = forceGraphData.value;
    // nextTick(renderGraph);
  }
};

// --- Updated Interaction Logic ---

// Maneja la selección de una familia desde el dropdown (para vista radial)
const onFamilySelected = (familyId) => {
  viewHistory.value = []; // Limpia historial al seleccionar desde dropdown (nueva secuencia)

  if (!familyId) {
    // Si se deselecciona ("Ver árbol completo"), muestra el grafo completo {nodes, links}
    console.log("Mostrando árbol completo (radial).");
    currentViewData.value = forceGraphData.value;
    nextTick(renderGraph);
    return;
  }

  // Busca la familia seleccionada en la lista pre-calculada
  const family = familyGroups.value.find(f => f.id === familyId);
  // Verifica que la familia y sus datos crudos (raw FAM record) existan
  if (!family || !family.raw || !family.raw.children) {
    console.error("Familia seleccionada o datos crudos inválidos:", familyId, family);
    // Como fallback, muestra el árbol completo
    error.value = "Error al cargar datos de la familia seleccionada.";
    currentViewData.value = forceGraphData.value;
    nextTick(renderGraph);
    return;
  }

  console.log("Seleccionada familia:", family.name);
  // --- Lógica similar a handleNodeFocus pero basada en registro FAM ---
  const familyNodeSet = new Set(); // Set para nodos de la familia
  const familyNodeIds = new Set(); // Set para IDs de nodos (búsqueda rápida)

  // Añade padres (HUSB, WIFE) e hijos (CHIL) del registro FAM al Set
  family.raw.children.forEach(n => {
    const pointer = n.data?.pointer;
    if (!pointer) return; // Ignora si no hay puntero
    // Solo procesa HUSB, WIFE, CHIL
    if (n.type === 'HUSB' || n.type === 'WIFE' || n.type === 'CHIL') {
      // Busca el individuo completo en el mapa principal
      const individual = individualsMap.value.get(pointer);
      if (individual) {
        familyNodeSet.add(individual); // Añade el nodo completo
        familyNodeIds.add(individual.id); // Añade el ID para búsqueda
      } else {
          console.warn(`Individuo ${pointer} de FAM ${family.id} no encontrado en mapa principal.`);
      }
    }
  });

  const familyNodes = Array.from(familyNodeSet); // Convierte el Set a Array

  // Reconstruye enlaces filtrando los enlaces globales
  const familyLinks = [];
  forceGraphData.value.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      // Incluye el enlace si ambos extremos están en el Set de IDs de la familia
      if (familyNodeIds.has(sourceId) && familyNodeIds.has(targetId)) {
          familyLinks.push({ ...link, source: sourceId, target: targetId });
      }
  });

  // Crea la estructura de datos para la vista de familia
  const familyGraphData = {
    nodes: familyNodes,
    links: familyLinks,
    _isFamilyFocus: true, // Marca como vista enfocada (aunque sea por selección)
    _focusPersonName: family.name // Usa nombre de familia para posible título
  };

  currentViewData.value = familyGraphData; // Actualiza datos a renderizar
  console.log(`Mostrando familia ${family.name}. Nodos: ${familyNodes.length}, Enlaces: ${familyLinks.length}`);
  nextTick(renderGraph); // Renderiza
};


// Limpia el contenedor SVG y detiene simulaciones D3 si existen
const clearTree = () => {
  console.log("Limpiando contenedor SVG...");
  // Detiene la simulación de fuerza si está activa
  if (simulation.value) {
    simulation.value.stop();
    simulation.value = null;
    console.log("Simulación D3 detenida.");
  }
  // Elimina todo el contenido del div contenedor del SVG
  if (treeContainer.value) {
    d3.select(treeContainer.value).selectAll('*').remove();
  } else {
    // Esto puede pasar si se llama antes de que el componente esté montado
    console.warn("clearTree llamado pero treeContainer ref aún no está disponible.");
  }
};


// Configura el ResizeObserver en el v-card contenedor para detectar cambios de tamaño
const setupResizeObserver = () => {
  // Desconecta observador previo si existe (evita duplicados)
  if (resizeObserver.value) {
    resizeObserver.value.disconnect();
  }
  // Obtiene el elemento DOM del v-card usando la ref
  // Es crucial acceder a .$el para obtener el elemento HTML real del componente Vuetify
  const cardElement = treeContainerCard.value?.$el;
  if (!cardElement) {
    // Si el elemento no está listo, reintenta después de un breve delay.
    // Esto puede ocurrir si el componente se monta pero el DOM interno de v-card tarda un poco más.
    console.warn("Elemento v-card (treeContainerCard.$el) no encontrado. Reintentando configuración de ResizeObserver...");
    setTimeout(setupResizeObserver, 150); // Reintenta después de 150ms
    return;
  }

  // Crea una nueva instancia de ResizeObserver
  resizeObserver.value = new ResizeObserver(entries => {
    if (!entries || entries.length === 0) return; // No hacer nada si no hay entradas
    // Obtiene las nuevas dimensiones del contenido del elemento observado
    const { width, height } = entries[0].contentRect;

    // Solo actualiza y re-renderiza si las dimensiones son válidas (>0)
    // y si realmente han cambiado respecto a las almacenadas
    if (width > 0 && height > 0 && (width !== currentWidth.value || height !== currentHeight.value)) {
      console.log(`Contenedor redimensionado a: ${width}x${height}`);
      currentWidth.value = width; // Actualiza el ancho almacenado
      currentHeight.value = height; // Actualiza el alto almacenado
      // Re-renderiza el gráfico con las nuevas dimensiones
      // Considera añadir un 'debounce' aquí si el renderizado es muy costoso
      // y los eventos de resize se disparan muy rápido.
      renderGraph();
    }
  });

  // Empieza a observar el elemento DOM del v-card
  resizeObserver.value.observe(cardElement);
  console.log("ResizeObserver configurado y observando el v-card.");

  // Llama una vez manualmente para obtener dimensiones iniciales después de montar,
  // en caso de que el tamaño ya sea estable y el observer no se dispare.
  const initialRect = cardElement.getBoundingClientRect();
   if (initialRect.width > 0 && initialRect.height > 0 && (currentWidth.value !== initialRect.width || currentHeight.value !== initialRect.height)) {
        currentWidth.value = initialRect.width;
        currentHeight.value = initialRect.height;
        console.log(`Dimensiones iniciales obtenidas: ${currentWidth.value}x${currentHeight.value}`);
        // Solo renderiza si ya hay datos cargados (evita renderizar en vacío al inicio)
        if (currentViewData.value || forceGraphData.value) {
             renderGraph();
        }
   }
};

// --- Render Logic ---

// Función principal para renderizar el gráfico seleccionado
const renderGraph = () => {
  // --- Pre-condiciones para renderizar ---
  // 1. Contenedor DIV debe existir en el DOM
  if (!treeContainer.value) {
      console.warn("Intento de renderizar sin contenedor (treeContainer). Abortando.");
      return;
  }
  // 2. Dimensiones deben ser válidas (mayores que 0)
  if (currentWidth.value <= 0 || currentHeight.value <= 0) {
      console.warn(`Intento de renderizar con dimensiones inválidas (${currentWidth.value}x${currentHeight.value}). Abortando.`);
      // Podríamos intentar obtener las dimensiones aquí de nuevo como último recurso
      const cardElement = treeContainerCard.value?.$el;
      if (cardElement) {
          const rect = cardElement.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
              currentWidth.value = rect.width;
              currentHeight.value = rect.height;
              console.log("Dimensiones obtenidas justo antes de renderizar.");
          } else {
              return; // Aún sin dimensiones válidas
          }
      } else {
          return; // No se puede obtener dimensiones
      }
  }
  // 3. Debe haber datos listos para el tipo de gráfico seleccionado
  let dataToRender = currentViewData.value; // Prioriza la vista actual (historial/enfoque)
  if (!dataToRender) { // Si no hay vista actual, usa los datos base según el tipo
      if (['horizontal', 'vertical', 'hourglass'].includes(graphType.value)) {
          dataToRender = treeRootData.value;
      } else { // 'force' y 'radial' (vista completa inicial)
          dataToRender = forceGraphData.value;
      }
  }
  if (!dataToRender) {
      console.log("No hay datos listos para renderizar (dataToRender es null).");
      clearTree(); // Limpia por si acaso había algo antes
      // Podríamos mostrar un mensaje en el contenedor
      // d3.select(treeContainer.value).append('p').text('Cargue un archivo GEDCOM para comenzar.');
      return;
  }

  // --- Limpieza y Preparación ---
  clearTree(); // Limpia el gráfico anterior y detiene simulaciones
  console.log(`Renderizando tipo: ${graphType.value} con ${dataToRender.nodes?.length || 'N/A'} nodos / ${dataToRender.links?.length || 'N/A'} enlaces.`);
  error.value = null; // Limpia errores previos de renderizado

  // --- Renderizado específico por tipo ---
  try {
    const width = currentWidth.value;
    const height = currentHeight.value;
    const nodeFocusHandler = handleNodeFocus; // Handler para clic/enfocar (usado en radial)
    const nodeModalHandler = handleNodeModal; // Handler para doble-clic/modal (usado en todos)

    let hierarchyData; // Para datos procesados por d3.hierarchy

    // Selecciona la función de renderizado adecuada y prepara los datos si es necesario
    switch (graphType.value) {
      case 'force':
        if (!dataToRender.nodes || dataToRender.nodes.length === 0) throw new Error('No hay nodos para el grafo de fuerza.');
        // Inicia la simulación de fuerza
        simulation.value = renderForceGraph(dataToRender, treeContainer.value, width, height, nodeModalHandler);
        break;

      case 'horizontal':
      case 'vertical': // Sunburst
      case 'hourglass':
        // Estos tipos requieren datos jerárquicos
        if (!dataToRender) throw new Error(`No hay datos jerárquicos (treeRootData) para el gráfico ${graphType.value}.`);
        try {
            hierarchyData = d3.hierarchy(dataToRender, d => d.children); // Crea la jerarquía D3
            // Para Sunburst, calcula la suma (usualmente para tamaño de arcos)
            if (graphType.value === 'vertical') {
                hierarchyData.sum(d => d.value || 1); // Asigna valor 1 si no existe 'value'
            }
        } catch (hierarchyError) {
            console.error("Error al crear la jerarquía D3:", hierarchyError, dataToRender);
            throw new Error(`Error procesando datos para ${graphType.value}: ${hierarchyError.message}`);
        }
        // Llama a la función de renderizado correspondiente
        if (graphType.value === 'horizontal') renderTreeHorizontal(hierarchyData, treeContainer.value, width, height, nodeModalHandler);
        if (graphType.value === 'vertical') renderResplandorRadial(hierarchyData, treeContainer.value, width, height, nodeModalHandler);
        if (graphType.value === 'hourglass') renderHourglassGraph(hierarchyData, treeContainer.value, width, height, nodeModalHandler);
        break;

      case 'radial': // Edge Bundling
        // Este tipo espera {nodes, links} directamente
        if (!dataToRender.nodes || !dataToRender.links) throw new Error('Datos inválidos (se esperan nodos y enlaces) para el gráfico radial.');
        if (dataToRender.nodes.length === 0) console.warn("Renderizando gráfico radial sin nodos."); // Puede ser válido si solo hay enlaces?
        // Llama a la función de renderizado radial
        renderAgrupamientoRelacional(dataToRender, treeContainer.value, width, height, nodeFocusHandler, nodeModalHandler);
        break;

      default:
        throw new Error(`Tipo de gráfico desconocido: ${graphType.value}`);
    }
    console.log(`Gráfico ${graphType.value} renderizado exitosamente.`);

    // --- Integrar D3 Zoom ---
    const svg = d3.select(treeContainer.value).select('svg');
    if (!svg.empty()) {
      d3Zoom = d3.zoom()
        .scaleExtent([0.2, 5])
        .on('zoom', (event) => {
          svg.select('g').attr('transform', event.transform);
        });
      svg.call(d3Zoom);
    }

  } catch (renderErr) {
    console.error(`Error renderizando gráfico (${graphType.value}):`, renderErr);
    error.value = `Error al dibujar el gráfico ${graphType.value}: ${renderErr.message}`;
    clearTree(); // Limpia el SVG por si quedó en un estado inconsistente
    // Opcional: Mostrar mensaje de error en el contenedor SVG
    d3.select(treeContainer.value)
        .append('text')
        .attr('x', 10)
        .attr('y', 20)
        .attr('fill', 'red')
        .text(`Error: ${error.value}`);
  }
};

// --- Métodos de pantalla completa y zoom ---
const toggleFullscreen = () => {
  const card = treeContainerCard.value?.$el;
  if (!card) return;
  if (!isFullscreen.value) {
    if (card.requestFullscreen) card.requestFullscreen();
    else if (card.webkitRequestFullscreen) card.webkitRequestFullscreen();
    else if (card.msRequestFullscreen) card.msRequestFullscreen();
    isFullscreen.value = true;
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
    isFullscreen.value = false;
  }
};

const zoomIn = () => {
  if (d3Zoom && treeContainer.value) {
    const svg = d3.select(treeContainer.value).select('svg');
    svg.transition().duration(200).call(d3Zoom.scaleBy, 1.2);
  }
};
const zoomOut = () => {
  if (d3Zoom && treeContainer.value) {
    const svg = d3.select(treeContainer.value).select('svg');
    svg.transition().duration(200).call(d3Zoom.scaleBy, 0.8);
  }
};

// Maneja el evento de cambio de pantalla completa
const handleFullscreenChange = () => {
  const fsElement = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  isFullscreen.value = !!fsElement;
  // Forzar redimensionado y renderizado al entrar/salir de pantalla completa
  nextTick(() => {
    if (resizeObserver.value) resizeObserver.value.disconnect();
    setupResizeObserver();
  });
};

// --- Watchers ---

// Observa cambios en el tipo de gráfico seleccionado por el usuario
watch(graphType, (newType, oldType) => {
  console.log(`Tipo de gráfico cambiado de ${oldType} a ${newType}`);
  // Solo re-renderiza si ya se cargaron datos GEDCOM
  if (gedcomData.value) {
    // Resetea la vista a los datos completos al cambiar tipo
    viewHistory.value = []; // Limpia historial radial
    selectedFamily.value = null; // Limpia selección de familia radial

    // CORRECCIÓN CLAVE: Asigna los datos BASE correctos según el nuevo tipo
    if (['horizontal', 'vertical', 'hourglass'].includes(newType)) {
        currentViewData.value = treeRootData.value; // Jerárquico
    } else { // 'force' y 'radial'
        currentViewData.value = forceGraphData.value; // {nodes, links}
    }
    console.log("Datos base asignados para el nuevo tipo:", currentViewData.value ? 'OK' : 'NULL');

    // Espera al siguiente tick y re-renderiza
    nextTick(renderGraph);
  }
});

// Observa cambios en el tema (oscuro/claro) para re-renderizar si es necesario
// Útil si los gráficos usan variables CSS (--v-theme-on-surface, etc.) para colores
watch(() => theme.global.current.value.dark, () => {
  console.log("Cambio de tema detectado.");
  if (gedcomData.value && treeContainer.value && d3.select(treeContainer.value).select('svg').node()) {
    // Solo re-renderiza si hay datos y un gráfico existente
    console.log("Re-renderizando gráfico por cambio de tema.");
    nextTick(renderGraph);
  }
});

// --- Lifecycle Hooks ---

onMounted(() => {
  // La configuración del ResizeObserver se llama DESPUÉS de cargar el archivo (onFileChange)
  // para asegurar que el elemento v-card (treeContainerCard) exista en el DOM.
  console.log("Componente montado.");
  // Podríamos intentar configurar el observer aquí si treeContainerCard ya existe,
  // pero es más seguro hacerlo después de la carga del archivo.
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('msfullscreenchange', handleFullscreenChange);
});

// Limpia el observador al desmontar el componente para evitar fugas de memoria
onBeforeUnmount(() => {
  if (resizeObserver.value) {
    resizeObserver.value.disconnect(); // Deja de observar
    resizeObserver.value = null; // Libera la referencia
    console.log("ResizeObserver desconectado.");
  }
  // También es buena idea limpiar la simulación si existe
  if (simulation.value) {
      simulation.value.stop();
      simulation.value = null;
  }
  console.log("Componente a punto de desmontarse.");
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.removeEventListener('msfullscreenchange', handleFullscreenChange);
});

</script>

<style>
/* Estilos básicos para el contenedor y SVG */
.h-100 {
  height: 100%;
}
.w-100 {
  width: 100%;
}
/* Contenedor del gráfico */
#treeContainer {
    position: relative; /* Para posible tooltip absoluto */
    background-color: var(--v-theme-surface); /* Fondo basado en tema */
    overflow: hidden; /* Evita barras de scroll si SVG se desborda */
    transition: background 0.3s; /* Mejor contraste para modo oscuro */
}

/* Asegura que el SVG ocupe el espacio y sea responsive */
#treeContainer svg {
    display: block; /* Elimina espacio extra debajo del SVG */
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    font-family: sans-serif; /* Fuente base para texto SVG */
    font-size: 10px; /* Tamaño base, puede ser sobrescrito */
    user-select: none; /* Evita selección de texto accidental en el gráfico */
    background: transparent; /* Fondo SVG transparente para heredar el fondo del contenedor */
}

/* Estilos generales para enlaces (pueden ser sobrescritos por JS) */
svg .link {
  fill: none;
  stroke: var(--v-theme-on-surface); /* Usa color del tema */
  stroke-opacity: 0.3; /* Más sutil por defecto */
  stroke-width: 1.5px;
  transition: stroke-opacity 0.2s ease-in-out, stroke-width 0.2s ease-in-out; /* Transición suave */
}

/* Estilos generales para círculos de nodos (pueden ser sobrescritos por JS) */
svg .node circle {
  /* fill y stroke se suelen poner dinámicamente en JS */
  stroke: var(--v-theme-on-surface);
  stroke-width: 1px;
  stroke-opacity: 0.7;
  cursor: pointer; /* Indica interactividad */
  fill: var(--v-theme-surface); /* Mejor visibilidad en modo oscuro */
  transition: fill 0.2s;
}

/* Estilos generales para texto de nodos (pueden ser sobrescritos por JS) */
svg .node text {
  cursor: pointer; /* Indica interactividad */
  fill: var(--v-theme-on-surface) !important;
  paint-order: stroke; /* Dibuja borde primero para legibilidad */
  stroke: var(--v-theme-surface); /* Borde del color de fondo */
  stroke-width: 3px; /* Ancho del borde */
  stroke-linecap: butt;
  stroke-linejoin: miter;
  transition: fill-opacity 0.2s ease-in-out, font-weight 0.2s ease-in-out; /* Transición suave */
}

/* Modal legible en modo oscuro */
.v-dialog .v-card {
  background: var(--v-theme-surface) !important;
  color: var(--v-theme-on-surface) !important;
  box-shadow: 0 2px 16px rgba(0,0,0,0.32);
}

/* Asegura legibilidad del contenido del diálogo modal */
.v-dialog .v-card-text {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.v-dialog .v-list-item-title strong {
 color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}
.v-dialog .v-list-item-subtitle {
    font-size: 0.8em; /* Más pequeño para fechas/lugares */
    /* margin-left: 8px; */ /* Quitado para usar layout de v-list */
    color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
    line-height: 1.3;
    margin-top: 2px;
}
/* Estilo específico para los eventos dentro del subtítulo */
.v-dialog .v-list-item-subtitle div {
    margin-left: 8px; /* Indenta cada evento */
}

/* Footer adaptativo */
#main-footer {
  background: var(--v-theme-surface);
  color: var(--v-theme-on-surface);
  border-top: 1px solid var(--v-theme-outline);
  transition: background 0.3s, color 0.3s;
}
#main-footer a {
  color: var(--v-theme-primary);
  text-decoration: none;
  font-weight: 500;
}

/* Ajustes para inputs y cards en modo oscuro */
.v-card, .v-file-input, .v-text-field, .v-autocomplete, .v-list, .v-dialog {
  background-color: var(--v-theme-surface) !important;
  color: var(--v-theme-on-surface) !important;
  transition: background 0.3s, color 0.3s;
}

.v-btn {
  transition: background 0.2s, color 0.2s;
}

/* Mejor contraste para alerts en modo oscuro */
.v-alert {
  background: var(--v-theme-surface) !important;
  color: var(--v-theme-error) !important;
  border: 1px solid var(--v-theme-error);
}

/* Scrollbar visible en modo oscuro */
#treeContainer ::-webkit-scrollbar {
  width: 8px;
  background: var(--v-theme-surface);
}
#treeContainer ::-webkit-scrollbar-thumb {
  background: var(--v-theme-outline);
  border-radius: 4px;
}

</style>

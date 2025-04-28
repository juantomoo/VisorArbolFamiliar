<template>
  <div class="hourglass-svg-wrapper" role="main" aria-label="Diagrama de fuerzas genealógico">
    <div ref="diagramContainerRef" class="diagram-container">
      <div class="svg-responsive-container">
        <svg ref="svgRef" :width="svgWidth" :height="svgHeight" tabindex="0" aria-label="Diagrama de fuerzas">
          <!-- D3.js renderiza los nodos y enlaces aquí -->
        </svg>
      </div>
      <!-- Controles flotantes -->
      <div class="fab-controls fab-controls-fixed" role="region" aria-label="Controles de diagrama">
        <v-btn icon color="primary" size="large" @click="showPersonSelector = !showPersonSelector" aria-label="Seleccionar persona">
          <v-icon>mdi-account</v-icon>
        </v-btn>
        <div v-if="showPersonSelector" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <v-autocomplete
            v-model="footerSelectedId"
            :items="footerPeople"
            item-title="label"
            item-value="id"
            label="Seleccionar individuo"
            variant="outlined"
            density="comfortable"
            autofocus
            hide-details
            @update:model-value="onFooterPersonChange"
            style="min-width:220px;"
            :menu-props="{ maxHeight: '300px' }"
            :return-object="false"
          />
        </div>
        <v-btn icon color="primary" size="large" @click="onFooterFullscreen" aria-label="Pantalla completa">
          <v-icon>{{ isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}</v-icon>
        </v-btn>
        <v-btn icon color="primary" size="large" @click="showConventions = !showConventions" aria-label="Mostrar/Ocultar convenciones">
          <v-icon>{{ showConventions ? 'mdi-help-circle' : 'mdi-help-circle-outline' }}</v-icon>
        </v-btn>
      </div>
      <modalDetalle :visible="modalVisible" :individuo="modalIndividuo" @close="modalVisible=false" />
      <!-- Panel de convenciones -->
      <div v-if="showConventions" class="panel-convenciones">
        <div class="conv-title">Convenciones del diagrama de fuerzas</div>
        <div class="conv-row"><span class="conv-box central"></span><span>Individuo central</span></div>
        <div class="conv-row"><span class="conv-box padre"></span><span>Padre/Madre</span></div>
        <div class="conv-row"><span class="conv-box conyuge"></span><span>Cónyuge</span></div>
        <div class="conv-row"><span class="conv-box hijo"></span><span>Hijo/a</span></div>
        <div class="conv-row"><span class="conv-line biologica"></span><span>Línea: vínculo familiar</span></div>
        <div class="conv-row"><span class="conv-line pareja"></span><span>Línea azul: pareja</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import modalDetalle from './modalDetalle.vue';
import { parseGedcom, findInitialIndividual } from './utils/gedcomParser.js';
import { renderForceDiagram } from './utils/forceDiagram.js';

const svgWidth = 1200, svgHeight = 800;
const svgRef = ref();
const diagramContainerRef = ref();
const isFullscreen = ref(false);
const showPersonSelector = ref(false);
const showConventions = ref(false);
const modalVisible = ref(false);
const modalIndividuo = ref(null);
const gedcomData = ref(null);
const centralId = ref(null);
const nodes = ref([]);
const router = useRouter();

// --- Cargar GEDCOM y preparar datos ---
onMounted(() => {
  const gedcomRaw = localStorage.getItem('gedcomContent');
  if (!gedcomRaw) {
    router.push({ name: 'inicio' });
    return;
  }
  gedcomData.value = parseGedcom(gedcomRaw);
  const initial = findInitialIndividual(gedcomData.value.individuals);
  if (initial) {
    centralId.value = initial.id;
    drawForceDiagram();
  }
});

function drawForceDiagram() {
  nextTick(() => {
    renderForceDiagram({
      svg: svgRef.value,
      individuals: gedcomData.value.individuals,
      families: gedcomData.value.families,
      centralId: centralId.value,
      onNodeClick: abrirModal
    });
    // Actualiza nodos para el selector
    nodes.value = Object.values(gedcomData.value.individuals).map(i => ({ id: i.id, label: i.name }));
  });
}

watch(centralId, drawForceDiagram);

// --- Modal de detalles ---
function abrirModal(node) {
  const raw = node.raw || node;
  modalIndividuo.value = {
    name: raw.name,
    id: raw.id,
    gender: raw.gender || raw.sex || '',
    birth: raw.birth?.date,
    birthPlace: raw.birth?.place,
    death: raw.death?.date,
    deathPlace: raw.death?.place,
    occupation: raw.occupation,
    religion: raw.religion,
    nationality: raw.nationality,
    email: raw.email,
    notes: Array.isArray(raw.notes) ? raw.notes.join('; ') : raw.notes,
    parents: (raw._parents||[]).map(p => p.name || p.label || p.id),
    siblings: (raw._siblings||[]).map(h => h.name || h.label || h.id),
    children: (raw._children||[]).map(h => h.name || h.label || h.id),
    spouses: (raw._spouses||[]).map(s => s.name || s.label || s.id),
    photo: null,
    events: raw.events || []
  };
  modalVisible.value = true;
}

// --- Selector de personas ---
const footerPeople = computed(() => nodes.value);
const footerSelectedId = ref('');
watch(centralId, () => { footerSelectedId.value = centralId.value; });
function onFooterPersonChange(id) {
  if (id && id !== centralId.value) {
    centralId.value = id;
    drawForceDiagram();
  }
}

// --- Fullscreen ---
function handleFullscreenChange() {
  isFullscreen.value = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
}

onMounted(() => {
  // ... (código existente de onMounted) ...
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Para Safari/Chrome
  document.addEventListener('msfullscreenchange', handleFullscreenChange); // Para IE/Edge
});

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.removeEventListener('msfullscreenchange', handleFullscreenChange);
});

function onFooterFullscreen() {
  const el = diagramContainerRef.value;
  if (!isFullscreen.value) { // Si no está en fullscreen, entrar
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  } else { // Si está en fullscreen, salir
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  }
  // Ya no es necesario actualizar isFullscreen.value aquí, el listener se encarga
}
</script>

<style scoped>
/* Usa los estilos globales de style.css y los de vistaFamiliar.vue */
</style>

<template>
  <div class="hourglass-svg-wrapper" role="main" aria-label="Diagrama árbol familiar">
    <div ref="diagramContainerRef" class="diagram-container">
      <div class="svg-responsive-container">
        <svg ref="svgRef" :width="svgWidth" :height="svgHeight" @wheel.prevent="onWheel" @mousedown="onSvgMousedown" style="background:#f5f5f5" tabindex="0" aria-label="Árbol genealógico">
          <g :transform="svgTransform">
            <!-- Líneas -->
            <line v-for="(line, i) in lines" :key="'l'+i" :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2" :stroke="line.color" :stroke-dasharray="line.dashed ? '4 2' : 'none'" stroke-width="2" />
            <!-- Nodos -->
            <g v-for="(node, i) in nodes" :key="'n'+i" :transform="`translate(${node.x},${node.y})`"
               @click="onNodeClick(node)"
               style="cursor:pointer">
              <rect :width="nodeW" :height="nodeH" :x="-(nodeW/2)" :y="-(nodeH/2)"
                    :fill="node.color"
                    :stroke="node.isCentral ? '#3949ab' : '#333'"
                    :stroke-width="node.isCentral ? 4 : 2"
                    rx="10" :class="['svg-node', node.role]" />
              <text x="0" y="-2" text-anchor="middle" font-size="15" fill="#222" style="font-weight:500;">{{ node.label }}</text>
              <foreignObject :x="-(nodeW/2)" :y="nodeH/2 - 2" :width="nodeW" height="30">
                <div style="display:flex;justify-content:center;align-items:center;width:100%;height:28px;">
                  <button class="ver-mas-btn" @click.stop="abrirModal(node)">ver más información</button>
                </div>
              </foreignObject>
            </g>
          </g>
        </svg>
      </div>
      <!-- Controles flotantes siempre visibles -->
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
        <v-btn icon color="primary" size="large" @click="onFooterZoomIn" aria-label="Zoom in">
          <v-icon>mdi-magnify-plus-outline</v-icon>
        </v-btn>
        <v-btn icon color="primary" size="large" @click="onFooterZoomOut" aria-label="Zoom out">
          <v-icon>mdi-magnify-minus-outline</v-icon>
        </v-btn>
        <v-btn icon color="primary" size="large" @click="onFooterFullscreen" aria-label="Pantalla completa">
          <v-icon>{{ isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}</v-icon>
        </v-btn>
      </div>
      <modalDetalle :visible="modalVisible" :individuo="modalIndividuo" @close="modalVisible=false" />
    </div>
  </div>
</template>

<script setup>
import modalDetalle from './modalDetalle.vue';
import { provide, ref, computed, watch, watchEffect, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { parseGedcom, findInitialIndividual } from './utils/gedcomParser.js';
import { buildHourglassTree } from './utils/hourglassTree.js';

const nodeW = 120, nodeH = 40, vGap = 100, hGap = 160;
const svgWidth = 1200, svgHeight = 800;
const svgRef = ref();
const zoom = ref(1);
const pan = ref({ x: svgWidth/2, y: svgHeight/2 });
const svgTransform = computed(() => `translate(${pan.value.x},${pan.value.y}) scale(${zoom.value})`);

function onWheel(e) {
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  zoom.value = Math.max(0.2, Math.min(zoom.value * delta, 2));
}

const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0 });
const mouseStart = ref({ x: 0, y: 0 });

function onSvgMousedown(e) {
  isPanning.value = true;
  mouseStart.value = { x: e.clientX, y: e.clientY };
  panStart.value = { ...pan.value };
  window.addEventListener('mousemove', onSvgMousemove);
  window.addEventListener('mouseup', onSvgMouseup);
}

function onSvgMousemove(e) {
  if (!isPanning.value) return;
  const dx = e.clientX - mouseStart.value.x;
  const dy = e.clientY - mouseStart.value.y;
  pan.value = {
    x: panStart.value.x + dx,
    y: panStart.value.y + dy
  };
}

function onSvgMouseup() {
  isPanning.value = false;
  window.removeEventListener('mousemove', onSvgMousemove);
  window.removeEventListener('mouseup', onSvgMouseup);
}

// --- GEDCOM y lógica hourglass ---
const gedcomFile = ref(null);
const gedcomData = ref(null);
const centralId = ref(null);
const hourglass = ref({ centralNode: null, ancestors: [], descendants: [] });

const router = useRouter();

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
    buildHourglass();
  }
});

const nodes = ref([]);
const lines = ref([]);

const searchQuery = ref("");
const selectedPersonId = ref("");
const filteredPeople = computed(() => {
  if (!searchQuery.value) return [];
  return nodes.value
    .filter(n => n.label.toLowerCase().includes(searchQuery.value.toLowerCase()))
    .map(n => ({ id: n.id, label: n.label }));
});
function onSearchInput() {
  if (filteredPeople.value.length === 1) {
    selectedPersonId.value = filteredPeople.value[0].id;
    onPersonSelect();
  }
}
function onPersonSelect() {
  if (selectedPersonId.value) {
    centralId.value = selectedPersonId.value;
    buildHourglass();
    searchQuery.value = "";
  }
}
function exportSVG() {
  const svg = svgRef.value;
  if (!svg) return;
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svg);
  // Corrige xmlns si falta
  if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  // Crea imagen
  const image = new Image();
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  image.onload = function () {
    const canvas = document.createElement('canvas');
    canvas.width = svgWidth;
    canvas.height = svgHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    const a = document.createElement('a');
    a.download = 'arbol_genealogico.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };
  image.src = url;
}

function goFullscreen() {
  const el = svgRef.value;
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  else if (el.msRequestFullscreen) el.msRequestFullscreen();
}

function handleFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    gedcomData.value = parseGedcom(evt.target.result);
    const initial = findInitialIndividual(gedcomData.value.individuals);
    if (initial) {
      centralId.value = initial.id;
      buildHourglass();
    }
  };
  reader.readAsText(file);
}

function buildHourglass() {
  if (!centralId.value || !gedcomData.value) return;
  const hg = buildHourglassTree(centralId.value, gedcomData.value.individuals, gedcomData.value.families);
  hourglass.value = hg;
  const n = [];
  // --- Ordenar cónyuges: vigente primero, luego separados/divorciados ---
  let spouses = (hg.centralNode._spouses||[]);
  spouses = spouses.slice().sort((a, b) => {
    // Si alguno tiene evento de divorcio/separación, va después
    const aDiv = hasDivorceOrSeparation(a, hg.centralNode);
    const bDiv = hasDivorceOrSeparation(b, hg.centralNode);
    return (aDiv === bDiv) ? 0 : aDiv ? 1 : -1;
  });
  // --- Cálculo de separación dinámica ---
  const maxAnc = Math.max(1, ...hg.ancestors.map(gen => gen.length));
  const maxDesc = Math.max(1, ...hg.descendants.map(gen => gen.length));
  const maxSiblings = (hg.centralNode._siblings||[]).length;
  const maxSpouses = spouses.length;
  const hGapAnc = Math.max(hGap, Math.min(220, svgWidth / (maxAnc + 1)));
  const hGapDesc = Math.max(hGap, Math.min(220, svgWidth / (maxDesc + 1)));
  const hGapSib = Math.max(hGap, Math.min(220, svgWidth / (maxSiblings + 2)));
  const hGapSpo = Math.max(hGap, Math.min(220, svgWidth / (maxSpouses + 2)));
  const vGapAnc = vGap;
  const vGapDesc = vGap;
  // Ancestros (arriba)
  hg.ancestors.forEach((gen, gIdx) => {
    gen.forEach((person, i) => {
      n.push({
        id: person.id,
        label: truncateName(person.name),
        fullName: person.name,
        x: (i - (gen.length-1)/2) * hGapAnc,
        y: -vGapAnc * (hg.ancestors.length-gIdx),
        color: '#fffde7',
        role: 'ancestro',
        birth: person.birth?.date,
        death: person.death?.date,
        raw: person,
        isCentral: false
      });
    });
  });
  // Nodo central
  n.push({
    id: hg.centralNode.id,
    label: truncateName(hg.centralNode.name),
    fullName: hg.centralNode.name,
    x: 0,
    y: 0,
    color: '#e3f2fd',
    role: 'central',
    birth: hg.centralNode.birth?.date,
    death: hg.centralNode.death?.date,
    raw: hg.centralNode,
    isCentral: true
  });
  // Cónyuges (ordenados)
  spouses.forEach((spouse, i) => {
    n.push({
      id: spouse.id,
      label: truncateName(spouse.name),
      fullName: spouse.name,
      x: hGapSpo*(i+1),
      y: 0,
      color: '#fce4ec',
      role: 'conyuge',
      birth: spouse.birth?.date,
      death: spouse.death?.date,
      raw: spouse,
      isCentral: false
    });
  });
  // Hermanos
  (hg.centralNode._siblings||[]).forEach((sib, i) => {
    n.push({
      id: sib.id,
      label: truncateName(sib.name),
      fullName: sib.name,
      x: -hGapSib*(i+1),
      y: 0,
      color: '#e8f5e9',
      role: 'hermano',
      birth: sib.birth?.date,
      death: sib.birth?.date,
      raw: sib,
      isCentral: false
    });
  });
  // Descendientes (abajo)
  hg.descendants.forEach((gen, gIdx) => {
    gen.forEach((person, i) => {
      n.push({
        id: person.id,
        label: truncateName(person.name),
        fullName: person.name,
        x: (i - (gen.length-1)/2) * hGapDesc,
        y: vGapDesc * (gIdx+1),
        color: '#e0f2f1',
        role: 'descendiente',
        birth: person.birth?.date,
        death: person.death?.date,
        raw: person,
        isCentral: false
      });
    });
  });
  // --- Crear mapa de posiciones por ID ---
  const nodePosMap = new Map();
  n.forEach(node => {
    nodePosMap.set(node.id, { x: node.x, y: node.y });
  });
  // --- Generar líneas usando posiciones reales ---
  const l = [];
  // Ancestros: de cada padre a su hijo
  hg.ancestors.forEach((gen, gIdx) => {
    gen.forEach((person, i) => {
      (person._children||[]).forEach(child => {
        const from = nodePosMap.get(person.id);
        const to = nodePosMap.get(child.id);
        if (from && to) {
          l.push({
            x1: from.x,
            y1: from.y,
            x2: to.x,
            y2: to.y,
            color: '#fbc02d',
            dashed: false
          });
        }
      });
    });
  });
  // Central: padres a central
  (hg.centralNode._parents||[]).forEach(parent => {
    const from = nodePosMap.get(parent.id);
    const to = nodePosMap.get(hg.centralNode.id);
    if (from && to) {
      l.push({
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        color: '#fbc02d',
        dashed: false
      });
    }
  });
  // Central: cónyuges (dashed si separados/divorciados)
  spouses.forEach(spouse => {
    const from = nodePosMap.get(hg.centralNode.id);
    const to = nodePosMap.get(spouse.id);
    if (from && to) {
      l.push({
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        color: '#ec407a',
        dashed: hasDivorceOrSeparation(spouse, hg.centralNode)
      });
    }
  });
  // Central: hermanos
  (hg.centralNode._siblings||[]).forEach(sib => {
    const from = nodePosMap.get(hg.centralNode.id);
    const to = nodePosMap.get(sib.id);
    if (from && to) {
      l.push({
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        color: '#66bb6a',
        dashed: false
      });
    }
  });
  // Descendientes: de cada padre a su hijo
  hg.descendants.forEach((gen, gIdx) => {
    gen.forEach((person, i) => {
      (person._parents||[]).forEach(parent => {
        const from = nodePosMap.get(parent.id);
        const to = nodePosMap.get(person.id);
        if (from && to) {
          l.push({
            x1: from.x,
            y1: from.y,
            x2: to.x,
            y2: to.y,
            color: '#0097a7',
            dashed: false
          });
        }
      });
    });
  });
  // --- Hijastros y padrastros: línea punteada ---
  if (hg.centralNode._stepRelations) {
    hg.centralNode._stepRelations.forEach(rel => {
      const from = nodePosMap.get(rel.parentId);
      const to = nodePosMap.get(rel.childId);
      if (from && to) {
        l.push({
          x1: from.x,
          y1: from.y,
          x2: to.x,
          y2: to.y,
          color: '#ab47bc',
          dashed: true
        });
      }
    });
  }
  nodes.value = n;
  lines.value = l;
  // --- Nuevo: centrar el árbol al cambiar de persona ---
  pan.value = { x: svgWidth/2, y: svgHeight/2 };
}

// Detecta si hay divorcio/separación entre dos personas
function hasDivorceOrSeparation(spouse, central) {
  // Busca eventos de divorcio/separación en los datos raw de ambos
  const events = [spouse, central].flatMap(p => (p.raw?.events || []));
  return events.some(ev =>
    ["DIV", "SEPARATION", "DIVORCE", "SEP"].includes(ev.type?.toUpperCase())
  );
}

// Agrega la función para truncar nombres
function truncateName(name, max = 18) {
  if (!name) return '';
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

watch(centralId, buildHourglass);

function onNodeClick(node) {
  if (node.id !== centralId.value) {
    centralId.value = node.id;
    buildHourglass();
  }
}

const modalVisible = ref(false);
const modalIndividuo = ref(null);
function abrirModal(node) {
  // Puedes enriquecer los datos aquí si lo deseas
  const raw = node.raw || {};
  modalIndividuo.value = {
    name: node.fullName || node.label,
    id: node.id,
    gender: raw.gender || raw.sex || '',
    birth: node.birth || (raw.birth && raw.birth.date),
    birthPlace: raw.birth && raw.birth.place,
    death: node.death || (raw.death && raw.death.date),
    deathPlace: raw.death && raw.death.place,
    occupation: raw.occupation || (raw.occupation && raw.occupation[0]),
    religion: raw.religion,
    nationality: raw.nationality,
    notes: Array.isArray(raw.notes) ? raw.notes.join('; ') : raw.notes,
    parents: (raw._parents||[]).map(p => p.name || p.label || p.id),
    siblings: (raw._siblings||[]).map(h => h.name || h.label || h.id),
    children: (raw._children||[]).map(h => h.name || h.label || h.id),
    spouses: (raw._spouses||[]).map(s => s.name || s.label || s.id)
  };
  modalVisible.value = true;
}

// Proveer datos y handlers al footer global
import { useRoute } from 'vue-router';
const route = useRoute();

// Lista de personas para el selector global del footer
const footerPeople = computed(() =>
  nodes.value.map(n => ({ id: n.id, label: n.fullName || n.label }))
);
const footerSelected = computed(() => centralId.value);
provide('footerPeople', footerPeople);
provide('footerSelected', footerSelected);
provide('onFooterPersonChange', (id) => {
  if (id && id !== centralId.value) {
    centralId.value = id;
    buildHourglass();
  }
});
provide('onFooterZoomIn', () => {
  zoom.value = Math.min(zoom.value * 1.1, 2);
});
provide('onFooterZoomOut', () => {
  zoom.value = Math.max(zoom.value * 0.9, 0.2);
});
provide('onFooterFullscreen', () => {
  const el = svgRef.value;
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  else if (el.msRequestFullscreen) el.msRequestFullscreen();
});

const footerSelectedId = ref('');
watchEffect(() => {
  footerSelectedId.value = centralId.value;
});
function onFooterPersonChange(e) {
  const id = typeof e === 'string' ? e : e.target.value;
  if (id && id !== centralId.value) {
    centralId.value = id;
    buildHourglass();
  }
}
function onFooterZoomIn() {
  zoom.value = Math.min(zoom.value * 1.1, 2);
}
function onFooterZoomOut() {
  zoom.value = Math.max(zoom.value * 0.9, 0.2);
}
const diagramContainerRef = ref();
const isFullscreen = ref(false);

function handleFullscreenChange() {
  // Detecta si el contenedor está en fullscreen
  const fsElement = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  isFullscreen.value = !!fsElement && (fsElement === diagramContainerRef.value);
}

const showPersonSelector = ref(false);

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('msfullscreenchange', handleFullscreenChange);
});

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.removeEventListener('msfullscreenchange', handleFullscreenChange);
});

function onFooterFullscreen() {
  const el = diagramContainerRef.value;
  if (isFullscreen.value) {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  } else {
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  }
}
</script>

<style scoped>
.hourglass-svg-wrapper {
  min-height: 100vh;
  width: 100vw;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 0;
}
.toolbar {
  display: none;
}
@media (max-width: 600px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 8px 2vw 0 2vw;
  }
}
.svg-responsive-container {
  width: 100vw;
  overflow-x: auto;
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: #f5f5f5;
  position: relative;
}
svg {
  display: block;
  margin: 0 auto;
  background: #f5f5f5;
  border: 1px solid #ddd;
  max-width: 100vw;
  height: auto;
}
@media (max-width: 600px) {
  svg {
    width: 98vw !important;
    min-width: 600px;
    max-width: 100vw;
  }
}
.search-input {
  padding: 4px 8px;
  font-size: 15px;
  border-radius: 5px;
  border: 1px solid #bbb;
  min-width: 180px;
}
.search-select {
  padding: 4px 8px;
  font-size: 15px;
  border-radius: 5px;
  border: 1px solid #bbb;
  min-width: 180px;
}
.export-btn {
  background: #3949ab;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 6px 16px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.export-btn:hover {
  background: #283593;
}
.fullscreen-btn {
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 6px 16px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.fullscreen-btn:hover {
  background: #0d47a1;
}
.svg-node {
  filter: drop-shadow(0 2px 8px rgba(60,60,60,0.10));
  transition: filter 0.2s, stroke 0.2s;
}
.svg-node:hover {
  filter: drop-shadow(0 4px 16px rgba(60,60,60,0.18));
  stroke: #1976d2 !important;
}
.svg-node.central {
  stroke: #3949ab;
  stroke-width: 4;
}
.ver-mas-btn {
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 2px 10px;
  font-size: 13px;
  cursor: pointer;
  margin-top: 2px;
  transition: background 0.2s;
}
.ver-mas-btn:hover {
  background: #0d47a1;
}
.fab-controls {
  position: absolute;
  right: 24px;
  bottom: 24px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  background: transparent;
}
.fab-controls-abs {
  position: absolute;
}
.fab-controls-fixed {
  position: fixed;
}
.fab-btn {
  background: #3949ab;
  color: #fff;
  border: none;
  width: 48px;
  height: 48px;
  box-shadow: 0 2px 8px rgba(60,60,60,0.18);
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s;
}
.fab-btn:hover {
  background: #283593;
  box-shadow: 0 4px 16px rgba(60,60,60,0.22);
}
.fab-select {
  min-width: 180px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #bbb;
  font-size: 16px;
  background: #fff;
  color: #222;
  box-shadow: 0 2px 8px rgba(60,60,60,0.10);
  margin-bottom: 4px;
}
@media (max-width: 600px) {
  .fab-controls {
    right: 8px;
    bottom: 8px;
    gap: 8px;
  }
  .fab-btn {
    width: 42px;
    height: 42px;
    font-size: 22px;
  }
  .fab-select {
    min-width: 120px;
    font-size: 14px;
  }
}
.diagram-container {
  position: relative;
  width: 100vw;
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
}
.fab-controls-fixed {
  position: fixed;
  right: 24px;
  bottom: 88px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  background: transparent;
}
@media (max-width: 600px) {
  .fab-controls-fixed {
    right: 8px;
    bottom: 72px;
    gap: 8px;
  }
}
.person-popover {
  position: absolute;
  right: 60px;
  bottom: 0;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 16px rgba(60,60,60,0.18);
  padding: 14px 16px 10px 16px;
  z-index: 2100;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.close-popover {
  background: none;
  border: none;
  font-size: 22px;
  color: #3949ab;
  cursor: pointer;
  margin-left: 6px;
  margin-top: -2px;
}
@media (max-width: 600px) {
  .person-popover {
    right: 0;
    left: auto;
    min-width: 120px;
    padding: 10px 8px 8px 8px;
    font-size: 14px;
  }
}
</style>
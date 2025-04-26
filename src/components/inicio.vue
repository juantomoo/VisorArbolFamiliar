<template>
  <div class="inicio-container" role="main" aria-label="Pantalla de inicio">
    <div class="inicio-card">
      <h1>Árbol Genealógico</h1>
      <p>Bienvenido. Carga tu archivo GEDCOM y elige el tipo de diagrama que deseas visualizar.</p>
      <div class="file-section">
        <label class="section-label" for="gedcom-file">Cargar archivo GEDCOM manualmente:</label>
        <input id="gedcom-file" type="file" accept=".ged" @change="onFileChange" />
        <div v-if="manualFileName" class="file-info">Archivo manual: {{ manualFileName }}</div>
        <button @click="useManualFile" :disabled="!manualGedcomContent">Usar este archivo</button>
      </div>
      <div class="gr-code-section">
        <label class="section-label" for="gr-code">¿Tienes un código especial?</label>
        <input id="gr-code" v-model="grCode" placeholder="Código" autocomplete="off" />
        <button @click="loadGRFile" :disabled="!grCode">Cargar archivo protegido</button>
        <div v-if="protectedFileName" class="file-info">Archivo protegido: {{ protectedFileName }}</div>
        <button @click="useProtectedFile" :disabled="!protectedGedcomContent">Usar este archivo</button>
      </div>
      <div v-if="fileName" class="file-info file-active">Archivo seleccionado: {{ fileName }}</div>
      <div class="diagram-select">
        <label>Tipo de diagrama:</label>
        <select v-model="selectedDiagram" :disabled="!gedcomContent">
          <option disabled value="">Selecciona un diagrama</option>
          <option v-for="d in diagramTypes" :key="d.value" :value="d.value">{{ d.label }}</option>
        </select>
      </div>
      <div class="diagram-buttons">
        <button :disabled="!gedcomContent" @click="goToArbol">Diagrama árbol</button>
        <button disabled>Diagrama fuerza</button>
        <button disabled>Diagrama radial</button>
        <button disabled>Diagrama telaraña</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const gedcomContent = ref(null);
const fileName = ref('');
const selectedDiagram = ref('');
const grCode = ref('');
const router = useRouter();

const diagramTypes = [
  { value: 'vistaFamiliar', label: 'Árbol familiar (hourglass)' },
  { value: 'GedcomTree', label: 'Árbol clásico horizontal' },
  { value: 'treeRadial', label: 'Árbol radial' },
  { value: 'zoomableSunburst', label: 'Sunburst' },
  // Agrega más tipos según tus componentes
];

const manualGedcomContent = ref(null);
const manualFileName = ref('');
const protectedGedcomContent = ref(null);
const protectedFileName = ref('');

function onFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  manualFileName.value = file.name;
  const reader = new FileReader();
  reader.onload = evt => {
    manualGedcomContent.value = evt.target.result;
  };
  reader.readAsText(file);
}

async function loadGRFile() {
  if (grCode.value.trim() === 'GR') {
    const response = await fetch('/gomezrivera.ged');
    if (response.ok) {
      protectedGedcomContent.value = await response.text();
      protectedFileName.value = 'gomezrivera.ged';
    } else {
      alert('No se pudo cargar el archivo protegido.');
    }
  } else {
    alert('Código incorrecto.');
  }
}

function useManualFile() {
  if (manualGedcomContent.value) {
    gedcomContent.value = manualGedcomContent.value;
    fileName.value = manualFileName.value;
  }
}

function useProtectedFile() {
  if (protectedGedcomContent.value) {
    gedcomContent.value = protectedGedcomContent.value;
    fileName.value = protectedFileName.value;
  }
}

function goToArbol() {
  localStorage.setItem('gedcomContent', gedcomContent.value);
  router.push({ name: 'vistaFamiliar' });
}
</script>

<style scoped>
.inicio-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  padding: 0 8px;
}
.inicio-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(60,60,60,0.10);
  padding: 24px 8px;
  max-width: 400px;
  width: 100%;
  text-align: center;
  margin: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
@media (min-width: 600px) {
  .inicio-card {
    padding: 32px 28px;
  }
}
.diagram-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 12px 0 0 0;
}
.diagram-buttons button {
  width: 100%;
  font-size: 17px;
  padding: 12px 0;
  border-radius: 6px;
  border: none;
  background: #3949ab;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
}
.diagram-buttons button:disabled {
  background: #bbb;
  color: #eee;
  cursor: not-allowed;
}
.file-section, .gr-code-section {
  margin: 0 0 8px 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}
.section-label {
  font-weight: 500;
  margin-bottom: 2px;
  text-align: left;
}
input[type="file"], input[type="text"], input[type="password"], input[type="email"], input[type="number"] {
  font-size: 16px;
  padding: 7px 8px;
  border-radius: 5px;
  border: 1px solid #bbb;
  background: #fafafa;
  width: 100%;
  box-sizing: border-box;
}
input:focus {
  outline: 2px solid #3949ab;
}
.file-info {
  margin: 6px 0;
  color: #3949ab;
  font-size: 15px;
  word-break: break-all;
}
.file-active {
  color: #1976d2;
  font-weight: bold;
}
button {
  background: #3949ab;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 8px 22px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 4px;
  transition: background 0.2s;
}
button:disabled {
  background: #bbb;
  cursor: not-allowed;
}
.gr-code-section button {
  background: #1976d2;
}
.gr-code-section button:disabled {
  background: #bbb;
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
</style>

<template>
  <v-container class="fill-height d-flex align-center justify-center" fluid>
    <v-card class="pa-6" max-width="420" elevation="8">
      <v-card-title class="text-h5 font-weight-bold mb-2">Árbol Genealógico</v-card-title>
      <v-card-text>
        <div class="mb-4">Bienvenido. Carga tu archivo GEDCOM y elige el tipo de diagrama que deseas visualizar.</div>
        <v-form>
          <v-row>
            <v-col cols="12">
              <v-text-field
                label="Cargar archivo GEDCOM manualmente"
                type="file"
                accept=".ged"
                @change="onFileChange"
                prepend-inner-icon="mdi-file-upload"
                variant="outlined"
                hide-details
                density="comfortable"
              />
              <div v-if="manualFileName" class="file-info">Archivo manual: {{ manualFileName }}</div>
              <v-btn class="mb-2" color="primary" block @click="useManualFile" :disabled="!manualGedcomContent">
                Usar este archivo
              </v-btn>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="grCode"
                label="¿Tienes un código especial?"
                prepend-inner-icon="mdi-lock"
                variant="outlined"
                hide-details
                density="comfortable"
                autocomplete="off"
              />
              <v-btn class="mb-2" color="primary" block @click="loadGRFile" :disabled="!grCode">
                Cargar archivo protegido
              </v-btn>
              <div v-if="protectedFileName" class="file-info">Archivo protegido: {{ protectedFileName }}</div>
              <v-btn class="mb-2" color="primary" block @click="useProtectedFile" :disabled="!protectedGedcomContent">
                Usar este archivo
              </v-btn>
            </v-col>
          </v-row>
        </v-form>
        <v-alert v-if="error" type="error" class="my-2">{{ error }}</v-alert>
        <div v-if="fileName" class="file-info file-active">Archivo seleccionado: {{ fileName }}</div>
        <v-divider class="my-4" />
        <v-row class="mt-2" dense>
          <v-col cols="12">
            <v-btn color="primary" block class="mb-2" :disabled="!gedcomContent" @click="goToArbol">
              <v-icon start>mdi-family-tree</v-icon>
              Diagrama árbol
            </v-btn>
            <v-btn color="grey" block class="mb-2" disabled>
              <v-icon start>mdi-graph</v-icon>
              Diagrama fuerza
            </v-btn>
            <v-btn color="grey" block class="mb-2" disabled>
              <v-icon start>mdi-chart-donut-variant</v-icon>
              Diagrama radial
            </v-btn>
            <v-btn color="grey" block class="mb-2" disabled>
              <v-icon start>mdi-web</v-icon>
              Diagrama telaraña
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const gedcomContent = ref(null);
const fileName = ref('');
const grCode = ref('');
const router = useRouter();
const error = ref('');

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
  if (grCode.value.trim() === 'GR2025') {
    const response = await fetch('/gomezrivera.ged');
    if (response.ok) {
      protectedGedcomContent.value = await response.text();
      protectedFileName.value = 'gomezrivera.ged';
      error.value = '';
    } else {
      error.value = 'No se pudo cargar el archivo protegido.';
    }
  } else {
    error.value = 'Código incorrecto.';
  }
}

function useManualFile() {
  if (manualGedcomContent.value) {
    gedcomContent.value = manualGedcomContent.value;
    fileName.value = manualFileName.value;
    error.value = '';
  }
}

function useProtectedFile() {
  if (protectedGedcomContent.value) {
    gedcomContent.value = protectedGedcomContent.value;
    fileName.value = protectedFileName.value;
    error.value = '';
  }
}

function goToArbol() {
  localStorage.setItem('gedcomContent', gedcomContent.value);
  router.push({ name: 'vistaFamiliar' });
}
</script>

<style scoped>
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
</style>

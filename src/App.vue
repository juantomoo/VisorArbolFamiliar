<template>
  <v-app :theme="darkMode ? 'dark' : 'light'">
    <v-app-bar app>
      <v-app-bar-title>Árbol Genealógico por HISQUE Estudio</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-switch
        v-model="darkMode"
        hide-details
        inset
        color="primary"
        :prepend-icon="darkMode ? 'mdi-weather-night' : 'mdi-weather-sunny'"
        density="compact"
        @change="toggleDarkMode"
      ></v-switch>
    </v-app-bar>
    <v-main>
      <GedcomTree />
    </v-main>
  </v-app>
</template>

<script setup>
import { ref } from 'vue';
import GedcomTree from './components/GedcomTree.vue'; // Import the component
import { useTheme } from 'vuetify'

const theme = useTheme();
const darkMode = ref(false); // O guarda el estado desde localStorage

const toggleDarkMode = () => {
  theme.global.name.value = darkMode.value ? 'dark' : 'light';
  // Opcional: guardar preferencia en localStorage
  localStorage.setItem('darkMode', darkMode.value);
};

// Inicializar tema basado en preferencia guardada o preferencia del sistema
const initTheme = () => {
  // Primero intenta obtener la preferencia guardada
  const savedMode = localStorage.getItem('darkMode');
  
  if (savedMode !== null) {
    darkMode.value = savedMode === 'true';
  } else {
    // Si no hay preferencia guardada, usa la preferencia del sistema
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    darkMode.value = prefersDark;
  }
  
  theme.global.name.value = darkMode.value ? 'dark' : 'light';
};

// Ejecutar al montar el componente
initTheme();
</script>

<style>
/* Global styles if needed */
html, body, #app, .v-application {
  height: 100%;
  margin: 0;
  padding: 0;
}

.v-main {
  height: calc(100vh - 64px); /* Adjust based on your app bar height */
  overflow-y: auto;
}
</style>

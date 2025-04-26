<template>
  <v-app>
    <header-vue />
    <v-main>
      <router-view />
    </v-main>
    <footer-vue
      :people="footerPeople"
      :selected="footerSelected"
      :showSelector="footerPeople.length > 0"
      :zoomEnabled="true"
      :fullscreenEnabled="true"
      @person-change="onFooterPersonChange"
      @zoom-in="onFooterZoomIn"
      @zoom-out="onFooterZoomOut"
      @fullscreen="onFooterFullscreen"
    />
  </v-app>
</template>

<script setup>
import { ref, computed, inject } from 'vue';
import GedcomTree from './components/GedcomTree.vue';
import { useTheme } from 'vuetify';
import VistaFamiliar from './components/vistaFamiliar.vue';
import HeaderVue from './components/header.vue';
import FooterVue from './components/footer.vue';
import { useRoute } from 'vue-router';

const theme = useTheme();
const darkMode = ref(false);

const toggleDarkMode = () => {
  theme.global.name.value = darkMode.value ? 'dark' : 'light';
  localStorage.setItem('darkMode', darkMode.value);
};

const initTheme = () => {
  const savedMode = localStorage.getItem('darkMode');
  if (savedMode !== null) {
    darkMode.value = savedMode === 'true';
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    darkMode.value = prefersDark;
  }
  theme.global.name.value = darkMode.value ? 'dark' : 'light';
};

initTheme();

const $route = useRoute();
// Estos refs serán actualizados desde vistaFamiliar.vue usando provide/inject o un store global si lo prefieres
const footerPeople = ref([]);
const footerSelected = ref('');

// --- INJECT FUNCIONES DE ZOOM Y FULLSCREEN DESDE vistaFamiliar.vue ---
const onFooterPersonChange = inject('onFooterPersonChange', () => {});
const onFooterZoomIn = inject('onFooterZoomIn', () => {});
const onFooterZoomOut = inject('onFooterZoomOut', () => {});
const onFooterFullscreen = inject('onFooterFullscreen', () => {});

</script>

<style>
html, body, #app, .v-application {
  height: 100%;
  margin: 0;
  padding: 0;
}

.v-main {
  height: calc(100vh - 64px);
  overflow-y: auto;
}

body {
  margin: 0;
  font-family: 'Roboto', sans-serif;
}

.component-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 16px;
  box-sizing: border-box;
  border: 1px solid var(--v-border-color);
  border-radius: 8px;
  background-color: var(--v-surface);
}
</style>

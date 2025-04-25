<template>
  <v-app :theme="darkMode ? 'dark' : 'light'">
    <v-app-bar app>
      <v-app-bar-title>Árbol Genealógico por HISQUE Estudio</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn :icon="darkMode ? 'mdi-weather-night' : 'mdi-weather-sunny'" @click="toggleDarkMode"></v-btn>
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
const darkMode = ref(false); // Or read from localStorage/preference

const toggleDarkMode = () => {
  darkMode.value = !darkMode.value;
  theme.global.name.value = darkMode.value ? 'dark' : 'light';
};

// Initialize theme based on darkMode ref
theme.global.name.value = darkMode.value ? 'dark' : 'light';

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

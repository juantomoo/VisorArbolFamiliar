<template>
  <v-app-bar color="primary" dark flat>
    <v-toolbar-title class="font-weight-bold">
      <v-icon start class="mr-2">mdi-family-tree</v-icon>
      Árbol Genealógico
    </v-toolbar-title>
    <v-spacer />
    <!-- Botones visibles en pantallas medianas y grandes -->
    <div class="hidden-sm-and-down">
      <v-btn to="/" variant="text" class="mx-1" exact>
        <v-icon start>mdi-home</v-icon>
        Inicio
      </v-btn>
      <v-btn to="/vistaFamiliar" variant="text" class="mx-1">
        <v-icon start>mdi-family-tree</v-icon>
        Diagrama árbol
      </v-btn>
      <v-btn to="/diagramaFuerza" variant="text" class="mx-1">
        <v-icon start>mdi-graph</v-icon> <!-- Icono sugerido -->
        Diagrama Fuerza
      </v-btn>
      <!-- Puedes agregar más enlaces aquí -->
    </div>
    <!-- Icono de hamburguesa visible en pantallas pequeñas, ahora a la derecha -->
    <v-app-bar-nav-icon @click.stop="drawer = !drawer" class="hidden-md-and-up"></v-app-bar-nav-icon>
  </v-app-bar>

  <!-- Menú lateral para pantallas pequeñas, ahora a la derecha -->
  <v-navigation-drawer
    v-model="drawer"
    temporary
    location="right"
    app
  >
    <v-list density="compact" nav>
      <v-list-item prepend-icon="mdi-home" title="Inicio" to="/" exact></v-list-item>
      <v-list-item prepend-icon="mdi-family-tree" title="Diagrama árbol" to="/vistaFamiliar"></v-list-item>
      <v-list-item prepend-icon="mdi-graph" title="Diagrama Fuerza" to="/diagramaFuerza"></v-list-item>
      <!-- Puedes agregar más enlaces aquí -->
    </v-list>
  </v-navigation-drawer>
</template>

<script setup>
import { ref } from 'vue';

const drawer = ref(false);
</script>

<style scoped>
.v-toolbar-title {
  font-size: 1.3rem;
}
/* Asegurar que los botones en la barra no se envuelvan */
.hidden-sm-and-down {
  display: flex;
  flex-wrap: nowrap;
}
</style>

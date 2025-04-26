<template>
  <v-app-bar color="primary" dark flat>
    <v-toolbar-title class="font-weight-bold">
      <v-icon start class="mr-2">mdi-family-tree</v-icon>
      Árbol Genealógico
    </v-toolbar-title>
    <v-spacer />
    <v-btn to="/" variant="text" class="mx-1" exact>
      <v-icon start>mdi-home</v-icon>
      Inicio
    </v-btn>
    <v-btn to="/vistaFamiliar" variant="text" class="mx-1">
      <v-icon start>mdi-family-tree</v-icon>
      Diagrama árbol
    </v-btn>
    <!-- Puedes agregar más enlaces aquí -->
  </v-app-bar>
</template>

<script setup>
// No logic needed
</script>

<style scoped>
.v-toolbar-title {
  font-size: 1.3rem;
}
</style>

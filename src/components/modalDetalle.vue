<template>
  <v-dialog v-model="internalVisible" max-width="420" persistent>
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Detalles del Individuo</span>
        <v-btn icon @click="close" variant="text">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-divider />
      <v-card-text>
        <template v-if="individuo">
          <v-list density="compact">
            <v-list-item v-if="individuo.name || individuo.label">
              <v-list-item-title><b>Nombre:</b> {{ individuo.name || individuo.label }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.id">
              <v-list-item-title><b>ID:</b> {{ individuo.id }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.gender">
              <v-list-item-title><b>Sexo:</b> {{ individuo.gender }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.birth || individuo.birthDate">
              <v-list-item-title><b>Nacimiento:</b> {{ individuo.birth || individuo.birthDate }}<span v-if="individuo.birthPlace">, {{ individuo.birthPlace }}</span></v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.death || individuo.deathDate">
              <v-list-item-title><b>Fallecimiento:</b> {{ individuo.death || individuo.deathDate }}<span v-if="individuo.deathPlace">, {{ individuo.deathPlace }}</span></v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.occupation">
              <v-list-item-title><b>Ocupación:</b> {{ individuo.occupation }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.religion">
              <v-list-item-title><b>Religión:</b> {{ individuo.religion }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.nationality">
              <v-list-item-title><b>Nacionalidad:</b> {{ individuo.nationality }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.notes">
              <v-list-item-title><b>Notas:</b> {{ Array.isArray(individuo.notes) ? individuo.notes.join('; ') : individuo.notes }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.parents && individuo.parents.length">
              <v-list-item-title><b>Padres:</b> {{ individuo.parents.join('; ') }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.siblings && individuo.siblings.length">
              <v-list-item-title><b>Hermanos:</b> {{ individuo.siblings.join('; ') }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.children && individuo.children.length">
              <v-list-item-title><b>Hijos:</b> {{ individuo.children.join('; ') }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.spouses && individuo.spouses.length">
              <v-list-item-title><b>Cónyuges:</b> {{ individuo.spouses.join('; ') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </template>
        <template v-else>
          <v-alert type="info">No hay datos para mostrar.</v-alert>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
const props = defineProps({
  visible: Boolean,
  individuo: Object
});
const emit = defineEmits(['close']);
const internalVisible = ref(props.visible);
watch(() => props.visible, v => { internalVisible.value = v; });
watch(internalVisible, v => { if (!v) emit('close'); });
function close() {
  internalVisible.value = false;
}
</script>

<style scoped>
.v-card-title {
  font-size: 1.1rem;
}
</style>

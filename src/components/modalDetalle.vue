<template>
  <div v-if="visible" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <button class="modal-close" @click="close">×</button>
      <h2 class="modal-title">Detalles del Individuo</h2>
      <div v-if="individuo">
        <div class="modal-row"><b>Nombre:</b> {{ individuo.name || individuo.label }}</div>
        <div class="modal-row" v-if="individuo.id"><b>ID:</b> {{ individuo.id }}</div>
        <div class="modal-row" v-if="individuo.gender"><b>Sexo:</b> {{ individuo.gender }}</div>
        <div class="modal-row" v-if="individuo.birth || individuo.birthDate"><b>Nacimiento:</b> {{ individuo.birth || individuo.birthDate }}<span v-if="individuo.birthPlace">, {{ individuo.birthPlace }}</span></div>
        <div class="modal-row" v-if="individuo.death || individuo.deathDate"><b>Fallecimiento:</b> {{ individuo.death || individuo.deathDate }}<span v-if="individuo.deathPlace">, {{ individuo.deathPlace }}</span></div>
        <div class="modal-row" v-if="individuo.occupation"><b>Ocupación:</b> {{ individuo.occupation }}</div>
        <div class="modal-row" v-if="individuo.religion"><b>Religión:</b> {{ individuo.religion }}</div>
        <div class="modal-row" v-if="individuo.nationality"><b>Nacionalidad:</b> {{ individuo.nationality }}</div>
        <div class="modal-row" v-if="individuo.notes"><b>Notas:</b> {{ Array.isArray(individuo.notes) ? individuo.notes.join('; ') : individuo.notes }}</div>
        <div class="modal-row" v-if="individuo.parents && individuo.parents.length"><b>Padres:</b> {{ individuo.parents.join('; ') }}</div>
        <div class="modal-row" v-if="individuo.siblings && individuo.siblings.length"><b>Hermanos:</b> {{ individuo.siblings.join('; ') }}</div>
        <div class="modal-row" v-if="individuo.children && individuo.children.length"><b>Hijos:</b> {{ individuo.children.join('; ') }}</div>
        <div class="modal-row" v-if="individuo.spouses && individuo.spouses.length"><b>Cónyuges:</b> {{ individuo.spouses.join('; ') }}</div>
        <!-- Puedes agregar más campos según tu modelo de datos -->
      </div>
      <div v-else>
        <i>No hay datos para mostrar.</i>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  visible: Boolean,
  individuo: Object
});
const emit = defineEmits(['close']);
function close() {
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.35);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-content {
  background: #fff;
  border-radius: 10px;
  padding: 28px 24px 18px 24px;
  min-width: 320px;
  max-width: 95vw;
  box-shadow: 0 2px 24px rgba(60,60,60,0.18);
  position: relative;
}
.modal-title {
  margin-top: 0;
  margin-bottom: 18px;
  color: #3949ab;
  font-size: 22px;
  font-weight: 600;
}
.modal-row {
  margin-bottom: 8px;
  font-size: 16px;
}
.modal-close {
  position: absolute;
  top: 10px;
  right: 14px;
  background: none;
  border: none;
  font-size: 28px;
  color: #3949ab;
  cursor: pointer;
}
</style>

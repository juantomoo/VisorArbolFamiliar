<template>
  <v-dialog v-model="internalVisible" max-width="500" persistent>
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
          <div class="d-flex flex-column align-center mb-2">
            <img v-if="individuo.photo" :src="individuo.photo" alt="Foto" style="max-width:120px;max-height:120px;border-radius:50%;object-fit:cover;border:2px solid #bbb;margin-bottom:8px;" />
          </div>
          <v-list density="comfortable">
            <v-list-item v-if="individuo.name || individuo.label">
              <v-list-item-title class="text-h6">{{ individuo.name || individuo.label }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.gender">
              <v-list-item-title><b>Sexo:</b> {{ genderFull(individuo.gender) }}</v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.birth || individuo.birthPlace">
              <v-list-item-title>
                <b>Nacimiento:</b>
                <span v-if="individuo.birth">{{ formatGedcomDate(individuo.birth) }}</span>
                <span v-if="individuo.birthPlace"> | <b>Lugar:</b> {{ individuo.birthPlace }}</span>
              </v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.death || individuo.deathPlace">
              <v-list-item-title>
                <b>Fallecimiento:</b>
                <span v-if="individuo.death">{{ formatGedcomDate(individuo.death) }}</span>
                <span v-if="individuo.deathPlace"> | <b>Lugar:</b> {{ individuo.deathPlace }}</span>
              </v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.email">
              <v-list-item-title><b>Email:</b> {{ individuo.email }}</v-list-item-title>
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
              <v-list-item-title><b>Notas:</b> <span style="white-space: pre-line;">{{ individuo.notes }}</span></v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.parents && individuo.parents.length">
              <v-list-item-title><b>Padres:</b>
                <ul class="ml-2 mb-0">
                  <li v-for="(p, idx) in individuo.parents" :key="'p'+idx">{{ p }}</li>
                </ul>
              </v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.siblings && individuo.siblings.length">
              <v-list-item-title><b>Hermanos:</b>
                <ul class="ml-2 mb-0">
                  <li v-for="(h, idx) in individuo.siblings" :key="'h'+idx">{{ h }}</li>
                </ul>
              </v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.children && individuo.children.length">
              <v-list-item-title><b>Hijos:</b>
                <ul class="ml-2 mb-0">
                  <li v-for="(c, idx) in individuo.children" :key="'c'+idx">{{ c }}</li>
                </ul>
              </v-list-item-title>
            </v-list-item>
            <v-list-item v-if="individuo.spouses && individuo.spouses.length">
              <v-list-item-title><b>Cónyuges:</b>
                <ul class="ml-2 mb-0">
                  <li v-for="(s, idx) in individuo.spouses" :key="'s'+idx">{{ s }}</li>
                </ul>
              </v-list-item-title>
            </v-list-item>
          </v-list>
          <v-divider class="my-2" />
          <div v-if="individuo.events && individuo.events.length">
            <b>Eventos y hechos:</b>
            <v-list density="compact">
              <v-list-item v-for="(ev, idx) in individuo.events" :key="'ev'+idx">
                <v-list-item-title>
                  <span class="font-weight-bold">{{ ev.type }}</span>
                  <span v-for="(val, key) in ev.attrs" :key="key" class="ml-2">
                    <b>{{ key }}:</b> {{ val }}
                  </span>
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </div>
          <div class="text-caption text-grey mt-2" v-if="individuo.id">
            <v-divider class="my-2" />
            <span>ID: {{ individuo.id }}</span>
          </div>
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
// Traducción de sexo
function genderFull(g) {
  if (!g) return '';
  const val = g.toLowerCase();
  if (val === 'm' || val === 'male' || val === 'masculino') return 'Masculino';
  if (val === 'f' || val === 'female' || val === 'femenino') return 'Femenino';
  return g.charAt(0).toUpperCase() + g.slice(1);
}
// Formato de fecha GEDCOM a YYYY-MM-DD
function formatGedcomDate(dateStr) {
  if (!dateStr) return '';
  // Ejemplo: 16 FEB 2008 o 2008-05-16
  const months = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
    'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  };
  // Si ya está en formato ISO
  if (/\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length === 3) {
    const [day, mon, year] = parts;
    return `${year}-${months[mon.toUpperCase()]||'01'}-${day.padStart(2,'0')}`;
  }
  if (parts.length === 2) {
    const [mon, year] = parts;
    return `${year}-${months[mon.toUpperCase()]||'01'}-01`;
  }
  if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
    return `${parts[0]}-01-01`;
  }
  return dateStr;
}
</script>

<style scoped>
.v-card-title {
  font-size: 1.1rem;
}
.text-caption {
  font-size: 0.85rem;
  color: #888;
  text-align: right;
}
ul {
  margin: 0 0 0 18px;
  padding: 0;
}
</style>

<template>
  <footer class="main-footer" role="contentinfo">
    <div class="footer-content">
      <div class="footer-brand">
        desarrollado por
        <a href="https://hisque.com.co/" target="_blank" rel="noopener" class="footer-link">HISQUE Estudio</a>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { ref, watch, toRefs } from 'vue';
const props = defineProps({
  people: { type: Array, default: () => [] },
  selected: { type: String, default: '' },
  showSelector: { type: Boolean, default: false },
  zoomEnabled: { type: Boolean, default: true },
  fullscreenEnabled: { type: Boolean, default: true }
});
const emit = defineEmits(['person-change', 'zoom-in', 'zoom-out', 'fullscreen']);
const selectedPersonId = ref(props.selected);
watch(() => props.selected, v => { selectedPersonId.value = v; });
</script>

<style scoped>
.main-footer {
  width: 100vw;
  background: #fff;
  color: #3949ab;
  border-top: 1px solid #eee;
  box-shadow: 0 -2px 8px rgba(60,60,60,0.06);
  padding: 0;
  position: sticky;
  bottom: 0;
  z-index: 99;
}
.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 4px 16px;
  gap: 6px;
}
.footer-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.footer-select-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.footer-label {
  font-size: 15px;
  font-weight: 500;
}
.footer-btn {
  background: #3949ab;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 6px 14px;
  font-size: 18px;
  cursor: pointer;
  transition: background 0.2s;
}
.footer-btn:disabled {
  background: #bbb;
  color: #eee;
  cursor: not-allowed;
}
.footer-brand {
  font-size: 14px;
  color: #3949ab;
  margin-top: 4px;
}
.footer-link {
  color: #1976d2;
  text-decoration: none;
  font-weight: 500;
  margin-left: 4px;
}
@media (max-width: 600px) {
  .footer-content {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 10px 4vw 4px 4vw;
  }
  .footer-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
}
</style>

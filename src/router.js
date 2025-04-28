import { createRouter, createWebHistory } from 'vue-router';
import inicio from './components/inicio.vue';
import vistaFamiliar from './components/vistaFamiliar.vue';
import GedcomTree from './components/GedcomTree.vue';
import diagramaFuerza from './components/diagramaFuerza.vue';

const routes = [
  { path: '/', name: 'inicio', component: inicio },
  { path: '/vistaFamiliar', name: 'vistaFamiliar', component: vistaFamiliar },
  { path: '/diagramaFuerza', name: 'diagramaFuerza', component: diagramaFuerza },
  { path: '/GedcomTree', name: 'GedcomTree', component: GedcomTree },
  // Si tienes más componentes Vue para otros diagramas, agrégalos aquí
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;

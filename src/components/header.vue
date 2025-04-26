<template>
  <header class="main-header" role="banner">
    <div class="header-content">
      <span class="app-title">Árbol Genealógico</span>
      <nav class="nav-menu" aria-label="Menú principal">
        <router-link to="/" class="nav-link">Inicio</router-link>
        <router-link to="/vistaFamiliar" class="nav-link">Diagrama árbol</router-link>
        <!-- Puedes agregar más enlaces aquí -->
      </nav>
    </div>
  </header>
</template>

<script setup>
// No logic needed for now
</script>

<style scoped>
.main-header {
  width: 100vw;
  background: #3949ab;
  color: #fff;
  box-shadow: 0 2px 8px rgba(60,60,60,0.10);
  padding: 0;
  position: sticky;
  top: 0;
  z-index: 100;
}
.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
}
.app-title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 1px;
}
.nav-menu {
  display: flex;
  gap: 18px;
}
.nav-link {
  color: #fff;
  text-decoration: none;
  font-size: 1rem;
  font-weight: 500;
  transition: color 0.2s;
}
.nav-link.router-link-exact-active {
  text-decoration: underline;
  color: #ffeb3b;
}
.nav-link:hover {
  color: #ffeb3b;
}
@media (max-width: 600px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 6vw;
  }
  .app-title {
    font-size: 1.1rem;
  }
}
</style>

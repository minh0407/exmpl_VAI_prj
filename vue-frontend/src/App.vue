<template>
  <div class="app-shell">
    <header class="top-nav-bar">
      <div class="logo-area">
        <span class="logo-text">Viettel VAI System</span>
      </div>
      <div class="user-avatar-area">
        <a-avatar style="background-color: #d32f2f">A</a-avatar>
      </div>
    </header>

    <main class="main-content">
      <UserManagement />
    </main>
  </div>
</template>

<script setup>
import UserManagement from './pages/UserManagement.vue';
</script>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #f4f6f8;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.top-nav-bar {
  height: 56px;
  background-color: #b71c1c;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.main-content {
  flex: 1;
}
</style>

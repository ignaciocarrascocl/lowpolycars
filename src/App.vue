<script setup>
import { onMounted, ref } from 'vue';
import GameInit from './gameinit.js';

const gameContainer = ref(null);

onMounted(() => new GameInit(gameContainer.value));
</script>

<template>
  <div ref="gameContainer" class="game-container"></div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  overflow: hidden;
}

.game-container {
  position: fixed;
  inset: 0;
}
</style>

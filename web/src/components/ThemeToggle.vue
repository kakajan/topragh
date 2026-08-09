<script setup lang="ts">
import { onMounted, ref } from 'vue';

const props = defineProps<{
  label: string;
  lightLabel: string;
  darkLabel: string;
}>();

const theme = ref<'light' | 'dark'>('light');

function applyTheme(next: 'light' | 'dark') {
  theme.value = next;
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('topragh-theme', next);
  } catch {
    /* ignore */
  }
}

function toggleTheme() {
  applyTheme(theme.value === 'light' ? 'dark' : 'light');
}

onMounted(() => {
  let initial: 'light' | 'dark' = 'light';
  try {
    const stored = localStorage.getItem('topragh-theme');
    if (stored === 'dark' || stored === 'light') {
      initial = stored;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      initial = 'dark';
    }
  } catch {
    /* ignore */
  }
  applyTheme(initial);
});
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="props.label"
    :title="props.label"
    @click="toggleTheme"
  >
    {{ theme === 'light' ? props.darkLabel : props.lightLabel }}
  </button>
</template>

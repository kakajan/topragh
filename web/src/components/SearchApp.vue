<script setup lang="ts">
import MiniSearch from 'minisearch';
import { computed, onMounted, ref, watch } from 'vue';
import { detectQueryLang, foldTurkmen } from '../lib/normalize';

type Hit = {
  id: string;
  tk: string;
  en: string;
  fa: string;
  letter: string;
};

const props = defineProps<{
  locale: 'fa' | 'en';
  placeholder: string;
  hintLabel: string;
  emptyLabel: string;
  loadingLabel: string;
  draftLabel: string;
  bothLabel: string;
}>();

const query = ref('');
const loading = ref(true);
const error = ref('');
const hits = ref<Hit[]>([]);
let mini: MiniSearch<Hit> | null = null;

const prefix = computed(() => (props.locale === 'en' ? '/en' : ''));

async function loadIndex() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/data/search-index.json');
    if (!res.ok) throw new Error(`index ${res.status}`);
    const json = await res.json();
    mini = MiniSearch.loadJSON(JSON.stringify(json), {
      fields: ['tk', 'tkFold', 'en', 'fa'],
      storeFields: ['tk', 'en', 'fa', 'letter'],
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'index error';
  } finally {
    loading.value = false;
  }
}

function runSearch(q: string) {
  if (!mini || !q.trim()) {
    hits.value = [];
    return;
  }
  const lang = detectQueryLang(q);
  const folded = foldTurkmen(q);
  const fields =
    lang === 'fa' ? (['fa', 'tk', 'tkFold'] as const) : (['tk', 'tkFold', 'en', 'fa'] as const);
  const results = mini.search(folded || q, {
    fields: [...fields],
    prefix: true,
    fuzzy: 0.2,
    boost: { tk: 5, tkFold: 4, fa: 3, en: 2 },
  });
  hits.value = results.slice(0, 40).map((r) => ({
    id: String(r.id),
    tk: String(r.tk ?? ''),
    en: String(r.en ?? ''),
    fa: String(r.fa ?? ''),
    letter: String(r.letter ?? ''),
  }));
}

let timer: ReturnType<typeof setTimeout> | undefined;
watch(query, (q) => {
  clearTimeout(timer);
  timer = setTimeout(() => runSearch(q), 140);
});

onMounted(loadIndex);
</script>

<template>
  <div class="search-app">
    <label class="search-label">
      <span class="sr-only">{{ placeholder }}</span>
      <input
        v-model="query"
        class="search-field"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        :placeholder="placeholder"
        :disabled="loading"
      />
    </label>
    <p v-if="loading" class="search-hint">{{ loadingLabel }}</p>
    <p v-else-if="error" class="search-hint search-hint--error">{{ error }}</p>
    <p v-else-if="!query" class="search-hint">{{ hintLabel }}</p>
    <p v-else-if="!hits.length" class="search-hint">{{ emptyLabel }}</p>

    <ul v-if="hits.length" class="result-list" role="list">
      <li v-for="(hit, i) in hits" :key="hit.id" class="result-row" :style="{ '--i': i }">
        <a class="result-row__link" :href="`${prefix}/w/${encodeURIComponent(hit.id)}/`">
          <div class="result-row__head">
            <span class="result-row__tk" dir="ltr" lang="tk">{{ hit.tk }}</span>
            <span class="result-row__meta">{{ bothLabel }}</span>
          </div>
          <div v-if="hit.fa" class="result-row__fa" dir="rtl" lang="fa">
            {{ hit.fa }}
            <span class="draft-mark">{{ draftLabel }}</span>
          </div>
          <div class="result-row__en" dir="ltr" lang="en">{{ hit.en }}</div>
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search-app {
  display: grid;
  gap: 0.65rem;
}

.search-label {
  display: block;
}

.search-field {
  width: 100%;
  min-height: 3.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  color: var(--color-text);
  font: inherit;
  font-size: 1.125rem;
  padding: 0.95rem 1.15rem;
  box-shadow: var(--shadow-soft);
  transition:
    box-shadow 0.22s ease-out,
    border-color 0.15s ease,
    background 0.15s ease;
}

.search-field:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-brand) 40%, var(--color-border));
}

.search-field:focus {
  border-color: var(--color-focus);
  background: var(--color-bg-elevated);
  outline: 2px solid color-mix(in srgb, var(--color-focus) 30%, transparent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-focus) 12%, transparent), var(--shadow-soft);
}

.search-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.92rem;
}

.search-hint--error {
  color: #b33a2f;
}

.result-list {
  list-style: none;
  margin: 0.35rem 0 0;
  padding: 0;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

.result-row {
  animation: row-in 0.22s ease-out both;
  animation-delay: calc(var(--i, 0) * 28ms);
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent);
}

.result-row:last-child {
  border-bottom: none;
}

.result-row__link {
  display: grid;
  gap: 0.2rem;
  padding: 0.9rem 1rem;
  text-decoration: none;
  color: inherit;
}

.result-row__link:hover {
  background: var(--color-accent-soft);
}

.result-row__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
}

.result-row__tk {
  font-family: var(--font-en);
  font-weight: 600;
  font-size: 1.15rem;
  color: var(--color-brand-deep);
}

.result-row__meta {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}

.result-row__fa {
  font-size: 1rem;
  color: var(--color-text);
}

.result-row__en {
  font-family: var(--font-en);
  font-size: 0.95rem;
  color: var(--color-text-muted);
}

.draft-mark {
  margin-inline-start: 0.45rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--color-text-muted);
  opacity: 0.85;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@keyframes row-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .result-row {
    animation: none;
  }

  .search-field {
    transition: none;
  }
}
</style>

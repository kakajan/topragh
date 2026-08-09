<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual';
import { computed, nextTick, onMounted, ref, watch } from 'vue';

type Row = {
  id: string;
  tk: string;
  en: string;
  fa: string | null;
  fa_status?: string;
};

type LetterInfo = { letter: string; count: number };

const props = defineProps<{
  locale: 'fa' | 'en';
  initialLetter?: string;
  loadingLabel: string;
  emptyLabel: string;
}>();

const letters = ref<LetterInfo[]>([]);
const active = ref(props.initialLetter || 'a');
const rows = ref<Row[]>([]);
const loading = ref(true);
const parentRef = ref<HTMLElement | null>(null);

const prefix = computed(() => (props.locale === 'en' ? '/en' : ''));

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => parentRef.value,
    estimateSize: () => 96,
    overscan: 10,
  })),
);

async function loadLetters() {
  const res = await fetch('/data/letters.json');
  letters.value = await res.json();
  if (!props.initialLetter && letters.value.length) {
    active.value = letters.value[0].letter;
  }
}

async function loadLetter(letter: string) {
  loading.value = true;
  active.value = letter;
  rows.value = [];
  try {
    // encodeURIComponent for the URL; server maps it to Unicode file e.g. ä.json
    const file = encodeURIComponent(letter.normalize('NFC'));
    const res = await fetch(`/data/letters/${file}.json`);
    rows.value = res.ok ? await res.json() : [];
  } finally {
    loading.value = false;
    await nextTick();
    virtualizer.value.scrollToOffset(0);
  }
}

onMounted(async () => {
  await loadLetters();
  await loadLetter(active.value);
});

watch(
  () => props.initialLetter,
  (L) => {
    if (L) loadLetter(L);
  },
);

function measureRow(el: Element | null) {
  virtualizer.value.measureElement(el);
}
</script>

<template>
  <div class="browse">
    <div class="letter-rail" role="tablist" aria-label="letters">
      <button
        v-for="item in letters"
        :key="item.letter"
        type="button"
        class="letter-chip"
        role="tab"
        :aria-selected="item.letter === active"
        :class="{ 'is-active': item.letter === active }"
        @click="loadLetter(item.letter)"
      >
        <span dir="ltr">{{ item.letter.toUpperCase() }}</span>
        <small>{{ item.count }}</small>
      </button>
    </div>

    <p v-if="loading" class="browse-hint">{{ loadingLabel }}</p>
    <p v-else-if="!rows.length" class="browse-hint">{{ emptyLabel }}</p>

    <div v-show="!loading && rows.length" ref="parentRef" class="virtual-list">
      <div
        class="virtual-list__inner"
        :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }"
      >
        <a
          v-for="vRow in virtualizer.getVirtualItems()"
          :key="`${active}-${rows[vRow.index]?.id}`"
          :data-index="vRow.index"
          :ref="measureRow"
          class="browse-row"
          :href="`${prefix}/w/${encodeURIComponent(rows[vRow.index].id)}/`"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${vRow.start}px)`,
          }"
        >
          <strong class="browse-row__tk" dir="ltr" lang="tk">{{ rows[vRow.index].tk }}</strong>
          <span v-if="rows[vRow.index].fa" class="browse-row__fa" dir="rtl" lang="fa">{{
            rows[vRow.index].fa
          }}</span>
          <span class="browse-row__en" dir="ltr" lang="en">{{ rows[vRow.index].en }}</span>
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.browse {
  display: grid;
  gap: 1rem;
}

.letter-rail {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-width: thin;
}

.letter-chip {
  flex: 0 0 auto;
  min-width: 2.6rem;
  min-height: 2.6rem;
  display: grid;
  place-items: center;
  gap: 0.05rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  font: inherit;
  cursor: pointer;
  padding: 0.25rem 0.4rem;
}

.letter-chip small {
  font-size: 0.65rem;
}

.letter-chip.is-active {
  background: var(--color-accent-soft);
  color: var(--color-brand-deep);
  border-color: var(--color-brand);
  font-weight: 600;
}

.browse-hint {
  color: var(--color-text-muted);
  margin: 0;
}

.virtual-list {
  height: min(70vh, 640px);
  overflow: auto;
  border-top: 1px solid var(--color-border);
}

.browse-row {
  display: block;
  padding: 0.75rem 0.4rem;
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 65%, transparent);
  box-sizing: border-box;
}

.browse-row:hover {
  background: var(--color-surface);
}

.browse-row__tk {
  display: block;
  font-family: var(--font-en);
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-brand-deep);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browse-row__fa,
.browse-row__en {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.95rem;
  line-height: 1.45;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

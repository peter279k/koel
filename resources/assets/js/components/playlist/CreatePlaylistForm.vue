<template>
  <div @keydown.esc="maybeClose">
    <SoundBars v-if="loading"/>
    <form v-else @submit.prevent="submit">
      <header>
        <h1>New Playlist</h1>
      </header>

      <main>
        <div class="form-row">
          <input
            v-model="name"
            v-koel-focus
            name="name"
            placeholder="Playlist name"
            required
            type="text"
          >
        </div>
      </main>

      <footer>
        <Btn type="submit">Save</Btn>
        <Btn white @click.prevent="maybeClose">Cancel</Btn>
      </footer>
    </form>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { playlistStore } from '@/stores'
import { logger, requireInjection } from '@/utils'
import { DialogBoxKey, MessageToasterKey } from '@/symbols'

import SoundBars from '@/components/ui/SoundBars.vue'
import Btn from '@/components/ui/Btn.vue'

const toaster = requireInjection(MessageToasterKey)
const dialog = requireInjection(DialogBoxKey)

const loading = ref(false)
const name = ref('')

const emit = defineEmits(['close'])

const close = () => emit('close')

const submit = async () => {
  loading.value = true

  try {
    const folder = await playlistStore.store(name.value)
    close()
    toaster.value.success(`Playlist "${folder.name}" created.`)
  } catch (error) {
    dialog.value.error('Something went wrong. Please try again.')
    logger.error(error)
  } finally {
    loading.value = false
  }
}

const maybeClose = async () => {
  if (name.value.trim() === '') {
    close()
    return
  }

  await dialog.value.confirm('Discard all changes?') && close()
}
</script>

<template>
  <section id="settingsWrapper">
    <ScreenHeader>Settings</ScreenHeader>

    <form class="main-scroll-wrap" @submit.prevent="confirmThenSave">
      <div class="form-row">
        <label for="inputSettingsPath">Media Path</label>

        <p id="mediaPathHelp" class="help">
          The <em>absolute</em> path to the server directory containing your media.
          Koel will scan this directory for songs and extract any available information.<br>
          Scanning may take a while, especially if you have a lot of songs, so be patient.
        </p>

        <input
          id="inputSettingsPath"
          v-model="mediaPath"
          aria-describedby="mediaPathHelp"
          name="media_path"
          type="text"
        >
      </div>

      <div class="form-row">
        <Btn type="submit">Scan</Btn>
      </div>
    </form>
  </section>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { settingStore } from '@/stores'
import { forceReloadWindow, hideOverlay, parseValidationError, requireInjection, showOverlay } from '@/utils'
import router from '@/router'
import { DialogBoxKey, MessageToasterKey } from '@/symbols'

import ScreenHeader from '@/components/ui/ScreenHeader.vue'
import Btn from '@/components/ui/Btn.vue'

const toaster = requireInjection(MessageToasterKey)
const dialog = requireInjection(DialogBoxKey)
const mediaPath = ref(settingStore.state.media_path)
const originalMediaPath = mediaPath.value

const shouldWarn = computed(() => {
  // Warn the user if the media path is not empty and about to change.
  if (!originalMediaPath || !mediaPath.value) {
    return false
  }

  return originalMediaPath !== mediaPath.value.trim()
})

const save = async () => {
  showOverlay()

  try {
    await settingStore.update({ media_path: mediaPath.value })
    toaster.value.success('Settings saved.')
    // Make sure we're back to home first.
    router.go('home')
    forceReloadWindow()
  } catch (err: any) {
    const msg = err.response.status === 422 ? parseValidationError(err.response.data)[0] : 'Unknown error.'
    dialog.value.error(msg, 'Error')
  } finally {
    hideOverlay()
  }
}

const confirmThenSave = async () => {
  if (shouldWarn.value) {
    await dialog.value.confirm('Changing the media path will essentially remove all existing data – songs, artists, \
          albums, favorites, everything – and empty your playlists! Sure you want to proceed?', 'Confirm')
    && await save()
  } else {
    await save()
  }
}
</script>

<style lang="scss">
#settingsWrapper {
  input[type="text"] {
    width: 50%;
    margin-top: 1rem;
  }

  @media only screen and (max-width: 667px) {
    input[type="text"] {
      width: 100%;
    }
  }
}
</style>

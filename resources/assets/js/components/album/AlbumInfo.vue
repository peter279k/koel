<template>
  <article :class="mode" class="album-info" data-testid="album-info">
    <h1 class="name">
      <span>{{ album.name }}</span>
      <button :title="`Play all songs in ${album.name}`" class="control" type="button" @click.prevent="play">
        <icon :icon="faCirclePlay" size="xl"/>
      </button>
    </h1>

    <main>
      <AlbumThumbnail :entity="album"/>

      <template v-if="info">
        <div v-if="info.wiki?.summary" class="wiki">
          <div v-if="showSummary" class="summary" data-testid="summary" v-html="info.wiki.summary"/>
          <div v-if="showFull" class="full" data-testid="full" v-html="info.wiki.full"/>

          <button v-if="showSummary" class="more" data-testid="more-btn" @click.prevent="showingFullWiki = true">
            Full Wiki
          </button>
        </div>

        <TrackList v-if="info.tracks?.length" :album="album" :tracks="info.tracks" data-testid="album-info-tracks"/>

        <footer>
          Data &copy;
          <a :href="info.url" rel="noopener" target="_blank">Last.fm</a>
        </footer>
      </template>
    </main>
  </article>
</template>

<script lang="ts" setup>
import { faCirclePlay } from '@fortawesome/free-solid-svg-icons'
import { computed, defineAsyncComponent, ref, toRefs, watch } from 'vue'
import { useThirdPartyServices } from '@/composables'
import { songStore } from '@/stores'
import { playbackService } from '@/services'
import { mediaInfoService } from '@/services/mediaInfoService'

import AlbumThumbnail from '@/components/ui/AlbumArtistThumbnail.vue'

const TrackList = defineAsyncComponent(() => import('@/components/album/AlbumTrackList.vue'))

const props = withDefaults(defineProps<{ album: Album, mode?: MediaInfoDisplayMode }>(), { mode: 'aside' })
const { album, mode } = toRefs(props)

const info = ref<AlbumInfo | null>(null)
const showingFullWiki = ref(false)

const { useLastfm } = useThirdPartyServices()

watch(album, async () => {
  showingFullWiki.value = false
  info.value = null
  useLastfm.value && (info.value = await mediaInfoService.fetchForAlbum(album.value))
}, { immediate: true })

const showSummary = computed(() => mode.value !== 'full' && !showingFullWiki.value)
const showFull = computed(() => !showSummary.value)

const play = async () => playbackService.queueAndPlay(await songStore.fetchForAlbum(album.value))
</script>

<style lang="scss" scoped>
.album-info {
  @include artist-album-info();

  .track-listing {
    margin-top: 2rem;
  }
}
</style>

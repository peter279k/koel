<template>
  <div class="side player-controls" :class="{ playing }">
    <icon
      :icon="faStepBackward"
      class="prev control"
      data-testid="play-prev-btn"
      role="button"
      tabindex="0"
      title="Play previous song"
      @click.prevent="playPrev"
    />

    <span class="album-thumb-wrapper">
      <span :style="{ backgroundImage: `url('${cover}')` }" class="album-thumb"></span>
      <span
        v-if="shouldShowPlayButton"
        class="play"
        data-testid="play-btn"
        role="button"
        tabindex="0"
        title="Play or resume"
        @click.prevent="toggle"
      >
        <icon :icon="faPlay" size="lg"/>
      </span>
      <span
        v-else
        class="pause"
        data-testid="pause-btn"
        role="button"
        tabindex="0"
        title="Pause"
        @click.prevent="toggle"
      >
        <icon :icon="faPause" size="lg"/>
      </span>
    </span>

    <icon
      :icon="faStepForward"
      class="next control"
      data-testid="play-next-btn"
      role="button"
      tabindex="0"
      title="Play next song"
      @click.prevent="playNext"
    />
  </div>
</template>

<script lang="ts" setup>
import { faPause, faPlay, faStepBackward, faStepForward } from '@fortawesome/free-solid-svg-icons'
import { computed, toRefs } from 'vue'
import { playbackService } from '@/services'
import { defaultCover } from '@/utils'

const props = defineProps<{ song: Song | null }>()
const { song } = toRefs(props)

const cover = computed(() => song.value?.album_cover ? song.value?.album_cover : defaultCover)
const shouldShowPlayButton = computed(() => !song || song.value?.playback_state !== 'Playing')
const playing = computed(() => song.value?.playback_state === 'Playing')

const playPrev = async () => await playbackService.playPrev()
const playNext = async () => await playbackService.playNext()
const toggle = async () => await playbackService.toggle()
</script>

<style lang="scss" scoped>
.player-controls {
  @include vertical-center();
  flex: 0 0 256px;
  font-size: 1.8rem;

  &:hover {
    .album-thumb-wrapper {
      margin-left: 1rem;
      margin-right: 1rem;
    }

    .album-thumb {
      filter: brightness(.4);
    }

    .prev, .next {
      opacity: 1;
    }

    .play, .pause {
      opacity: .7;
    }
  }

  .album-thumb-wrapper {
    flex: 0 0 calc(var(--footer-height) + 30px);
    height: calc(var(--footer-height) + 30px);
    transition: .2s ease-out;
    position: relative;
    overflow: hidden;
    border-radius: 50%;
    box-shadow: 0 0 20px rgba(0, 0, 0, .2);
    margin-left: -3rem;
    margin-right: -3rem;

    @media (hover: none) {
      margin-left: 1rem;
      margin-right: 1rem;
    }

    @include vertical-center();

    &:hover {
      .album-thumb {
        &::after {
          display: block;
        }
      }

      .play, .pause {
        opacity: 1;
      }
    }
  }

  .album-thumb {
    position: relative;
    background-color: transparent;
    height: 100%;
    width: 100%;
    left: 0;
    top: 0;
    z-index: 0;
    border-radius: 50%;
    background-size: cover;
    transition: .2s ease-out;
    overflow: hidden;
  }

  .prev, .next {
    transition: .4s ease-out;
    opacity: 0;
    padding: 1rem;
    margin: -.75rem;
  }

  .play, .pause {
    @include inset-when-pressed();

    border-radius: 50%;
    position: absolute;
    top: 0;
    left: 0;
    transition: opacity .4s ease-out;
    display: flex;
    font-size: 2rem;
    place-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    line-height: calc(var(--footer-height) + 30px);
    text-align: center;
    text-indent: 2px;
    color: var(--color-text-primary);
    opacity: 0;
    text-shadow: 0 0 1px rgba(0, 0, 0, 0.5);
  }

  .play {
    margin-left: .2rem;
  }

  .enabled {
    opacity: 1;
  }

  &.playing .album-thumb {
    animation: spin 30s linear infinite;

    @media (prefers-reduced-motion) {
      animation: none;
    }
  }

  @media only screen and (max-width: 768px) {
    flex: 1;

    &::before {
      display: none;
    }

    .album-thumb-wrapper {
      flex: 0 0 48px;
      height: 48px;
      box-shadow: 0 0 0 1px var(--color-text-secondary);
    }

    .album-thumb {
      background-image: none !important;

      &::after {
        opacity: 0;
      }
    }

    .play, .pause {
      line-height: 48px;
    }

    .prev, .next, .play, .pause {
      opacity: 1;
      font-size: 2rem;
      color: var(--color-text-secondary);
    }
  }
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>

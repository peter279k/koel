import isMobile from 'ismobilejs'
import slugify from 'slugify'
import { merge, orderBy, sumBy, take, unionBy, uniqBy } from 'lodash'
import { reactive, UnwrapNestedRefs, watch } from 'vue'
import { arrayify, logger, secondsToHis, use } from '@/utils'
import { authService, cache, http } from '@/services'
import { albumStore, artistStore, commonStore, overviewStore, playlistStore, preferenceStore } from '@/stores'

export type SongUpdateData = {
  title?: string
  artist_name?: string
  album_name?: string
  album_artist_name?: string
  track?: number | null
  disc?: number | null
  lyrics?: string
  year?: number | null
  genre?: string
}

export interface SongUpdateResult {
  songs: Song[]
  artists: Artist[]
  albums: Album[]
  removed: {
    albums: Pick<Album, 'id' | 'artist_id' | 'name' | 'cover' | 'created_at'>[]
    artists: Pick<Artist, 'id' | 'name' | 'image' | 'created_at'>[]
  }
}

export const songStore = {
  vault: new Map<string, UnwrapNestedRefs<Song>>(),

  state: reactive({
    songs: [] as Song[]
  }),

  getFormattedLength: (songs: Song | Song[]) => secondsToHis(sumBy(arrayify(songs), 'length')),

  byId (id: string) {
    const song = this.vault.get(id)
    return song?.deleted ? undefined : song
  },

  byIds (ids: string[]) {
    const songs = [] as Song[]
    ids.forEach(id => use(this.byId(id), song => songs.push(song!)))
    return songs
  },

  byAlbum (album: Album) {
    return Array.from(this.vault.values()).filter(song => song.album_id === album.id)
  },

  async resolve (id: string) {
    let song = this.byId(id)

    if (!song) {
      try {
        song = this.syncWithVault(await http.get<Song>(`songs/${id}`))[0]
      } catch (e) {
        logger.error(e)
      }
    }

    return song
  },

  /**
   * Match a title to a song.
   * Forget about Levenshtein distance, this implementation is good enough.
   */
  match: (title: string, songs: Song[]) => {
    title = slugify(title.toLowerCase())

    for (const song of songs) {
      if (slugify(song.title.toLowerCase()) === title) {
        return song
      }
    }

    return null
  },

  /**
   * Increase a play count for a song.
   */
  registerPlay: async (song: Song) => {
    const interaction = await http.post<Interaction>('interaction/play', { song: song.id })

    // Use the data from the server to make sure we don't miss a play from another device.
    song.play_count = interaction.play_count
  },

  scrobble: async (song: Song) => await http.post(`songs/${song.id}/scrobble`, {
    timestamp: song.play_start_time
  }),

  async update (songsToUpdate: Song[], data: SongUpdateData) {
    const { songs, artists, albums, removed } = await http.put<SongUpdateResult>('songs', {
      data,
      songs: songsToUpdate.map(song => song.id)
    })

    this.syncWithVault(songs)

    albumStore.syncWithVault(albums)
    artistStore.syncWithVault(artists)

    albumStore.removeByIds(removed.albums.map(album => album.id))
    artistStore.removeByIds(removed.artists.map(artist => artist.id))
  },

  getSourceUrl: (song: Song) => {
    return isMobile.any && preferenceStore.transcodeOnMobile
      ? `${commonStore.state.cdn_url}play/${song.id}/1/128?api_token=${authService.getToken()}`
      : `${commonStore.state.cdn_url}play/${song.id}?api_token=${authService.getToken()}`
  },

  getShareableUrl: (song: Song) => `${window.BASE_URL}#!/song/${song.id}`,

  syncWithVault (songs: Song | Song[]) {
    return arrayify(songs).map(song => {
      let local = this.byId(song.id)

      if (local) {
        merge(local, song)
      } else {
        local = reactive(song)
        local.playback_state = 'Stopped'
        this.setUpPlayCountTracking(local)
        this.vault.set(local.id, local)
      }

      return local
    })
  },

  setUpPlayCountTracking: (song: UnwrapNestedRefs<Song>) => {
    watch(() => song.play_count, (newCount, oldCount) => {
      const album = albumStore.byId(song.album_id)
      album && (album.play_count += (newCount - oldCount))

      const artist = artistStore.byId(song.artist_id)
      artist && (artist.play_count += (newCount - oldCount))

      if (song.album_artist_id !== song.artist_id) {
        const albumArtist = artistStore.byId(song.album_artist_id)
        albumArtist && (albumArtist.play_count += (newCount - oldCount))
      }

      overviewStore.refresh()
    })
  },

  async cacheable (key: any, fetcher: Promise<Song[]>) {
    const songs = await cache.remember<Song[]>(key, async () => this.syncWithVault(await fetcher))
    return songs.filter(song => !song.deleted)
  },

  async fetchForAlbum (album: Album | number) {
    const id = typeof album === 'number' ? album : album.id
    return await this.cacheable(['album.songs', id], http.get<Song[]>(`albums/${id}/songs`))
  },

  async fetchForArtist (artist: Artist | number) {
    const id = typeof artist === 'number' ? artist : artist.id
    return await this.cacheable(['artist.songs', id], http.get<Song[]>(`artists/${id}/songs`))
  },

  async fetchForPlaylist (playlist: Playlist) {
    return await this.cacheable(['playlist.songs', playlist.id], http.get<Song[]>(`playlists/${playlist.id}/songs`))
  },

  async fetchForPlaylistFolder (folder: PlaylistFolder) {
    const songs: Song[] = []

    for await (const playlist of playlistStore.byFolder(folder)) {
      songs.push(...await songStore.fetchForPlaylist(playlist))
    }

    return uniqBy(songs, 'id')
  },

  async paginate (sortField: SongListSortField, sortOrder: SortOrder, page: number) {
    const resource = await http.get<PaginatorResource>(
      `songs?page=${page}&sort=${sortField}&order=${sortOrder}`
    )

    this.state.songs = unionBy(this.state.songs, this.syncWithVault(resource.data), 'id')

    return resource.links.next ? ++resource.meta.current_page : null
  },

  getMostPlayed (count: number) {
    return take(orderBy(Array.from(this.vault.values()).filter(song => !song.deleted), 'play_count', 'desc'), count)
  },

  getRecentlyAdded (count: number) {
    return take(orderBy(Array.from(this.vault.values()).filter(song => !song.deleted), 'created_at', 'desc'), count)
  },

  async deleteFromFilesystem (songs: Song[]) {
    const ids = songs.map(song => {
      // Whenever a vault sync is requested (e.g. upon playlist/album/artist fetching)
      // songs marked as "deleted" will be excluded.
      song.deleted = true
      return song.id
    })

    await http.delete('songs', { songs: ids })
  }
}

import { arrayify, logger, pluralize } from '@/utils'
import { albumStore, artistStore, playlistStore, songStore } from '@/stores'

type Draggable = Song | Song[] | Album | Artist | Playlist
type DraggableType = 'songs' | 'album' | 'artist' | 'playlist'

const createGhostDragImage = (event: DragEvent, text: string): void => {
  if (!event.dataTransfer) {
    return
  }

  let dragGhost = document.querySelector<HTMLElement>('#dragGhost')

  if (!dragGhost) {
    // Create the element to be the ghost drag image.
    dragGhost = document.createElement('div')
    dragGhost.id = 'dragGhost'
    document.body.appendChild(dragGhost)
  }

  dragGhost.innerText = text
  event.dataTransfer.setDragImage(dragGhost, 0, 0)
}

const getDragType = (event: DragEvent) => {
  const types: DraggableType[] = ['songs', 'album', 'artist', 'playlist']

  for (let i = 0, count = types.length; i < count; ++i) {
    if (event.dataTransfer?.types.includes(`application/x-koel.${types[i]}`)) return types[i]
  }
}

export const useDraggable = (type: DraggableType) => {
  const startDragging = (event: DragEvent, dragged: Draggable) => {
    if (!event.dataTransfer) {
      return
    }

    let text
    let data: any

    switch (type) {
      case 'songs':
        dragged = arrayify(<Song>dragged)
        text = dragged.length === 1 ? `${dragged[0].title} by ${dragged[0].artist_name}` : pluralize(dragged, 'song')

        data = dragged.map(song => song.id)
        break

      case 'album':
        dragged = <Album>dragged
        text = `All songs in ${dragged.name}`
        data = dragged.id
        break

      case 'artist':
        dragged = <Artist>dragged
        text = `All songs by ${dragged.name}`
        data = dragged.id
        break

      case 'playlist':
        dragged = <Playlist>dragged
        text = dragged.name
        data = dragged.id
        break

      default:
        return
    }

    event.dataTransfer.setData(`application/x-koel.${type}`, JSON.stringify(data))

    createGhostDragImage(event, text)
  }

  return {
    startDragging
  }
}

export const useDroppable = (acceptedTypes: DraggableType[]) => {
  const acceptsDrop = (event: DragEvent) => {
    const type = getDragType(event)
    return type && acceptedTypes.includes(type)
  }

  const getDroppedData = (event: DragEvent) => {
    const type = getDragType(event)

    if (!type) return null

    try {
      return JSON.parse(event.dataTransfer?.getData(`application/x-koel.${type}`)!)
    } catch (e) {
      logger.warn('Failed to parse dropped data', e)
      return null
    }
  }

  const resolveDroppedValue = async <T = Playlist> (event: DragEvent): Promise<T | undefined> => {
    try {
      switch (getDragType(event)) {
        case 'playlist':
          return playlistStore
            .byId(parseInt(event.dataTransfer!.getData('application/x-koel.playlist'))) as T | undefined
        default:
          return
      }
    } catch (error) {
      logger.error(error, event)
    }
  }

  const resolveDroppedSongs = async (event: DragEvent) => {
    try {
      const type = getDragType(event)
      if (!type) return <Song[]>[]

      const data = getDroppedData(event)
      switch (type) {
        case 'songs':
          return songStore.byIds(<string[]>data)
        case 'album':
          const album = await albumStore.resolve(<number>data)
          return album ? await songStore.fetchForAlbum(album) : <Song[]>[]
        case 'artist':
          const artist = await artistStore.resolve(<number>data)
          return artist ? await songStore.fetchForArtist(artist) : <Song[]>[]
        case 'playlist':
          const playlist = await playlistStore.byId(<number>data)
          return playlist ? await songStore.fetchForPlaylist(playlist) : <Song[]>[]
      }
    } catch (error) {
      logger.error(error, event)
      return <Song[]>[]
    }
  }

  return {
    acceptsDrop,
    resolveDroppedValue,
    resolveDroppedSongs
  }
}

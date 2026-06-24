import * as ecs from '@8thwall/ecs'

// Component: Toggle Video Cylinder on Target
// Uses 8th Wall's native cylinder geometry + ECS video controls (videoControls in .expanse.json).
// The video is configured as textureSrc on the entity material — no Three.js VideoTexture needed.
// The component only handles show/hide and play/pause when the image target is found/lost.

ecs.registerComponent({
  name: 'Toggle Video Cylinder on Target',
  schema: {
    // @required — the entity that holds the cylinder geometry + video material
    videoEntity: ecs.eid,
    imageTargetName: ecs.string,
    // Keep these for future reference / config panel display (not used for texture loading)
    videoUrl: ecs.string,
    meshName: ecs.string,
  },
  schemaDefaults: {
    imageTargetName: 'wanglaoji',
    videoUrl: '',
    meshName: 'labelMesh',
  },
  stateMachine: ({ world, eid, schemaAttribute }) => {
    const pauseAndHide = () => {
      const { videoEntity } = schemaAttribute.get(eid)
      if (!videoEntity) return
      ecs.Hidden.set(world, videoEntity)
      // Pause via ECS VideoControls
      if (ecs.VideoControls.has(world, videoEntity)) {
        ecs.VideoControls.mutate(world, videoEntity, (c) => {
          c.paused = true
        })
      }
    }

    const showAndPlay = () => {
      const { videoEntity } = schemaAttribute.get(eid)
      if (!videoEntity) return
      ecs.Hidden.remove(world, videoEntity)
      // Play via ECS VideoControls
      if (ecs.VideoControls.has(world, videoEntity)) {
        ecs.VideoControls.mutate(world, videoEntity, (c) => {
          c.paused = false
        })
      }
    }

    ecs.defineState('default')
      .initial()
      .onEnter(() => {
        pauseAndHide()
      })
      .listen(world.events.globalId, ecs.events.REALITY_IMAGE_FOUND, (event) => {
        const { name } = event.data as any
        const { imageTargetName } = schemaAttribute.get(eid)
        if (name === imageTargetName) {
          showAndPlay()
        }
      })
      .listen(world.events.globalId, ecs.events.REALITY_IMAGE_LOST, (event) => {
        const { name } = event.data as any
        const { imageTargetName } = schemaAttribute.get(eid)
        if (name === imageTargetName) {
          pauseAndHide()
        }
      })
  },
})

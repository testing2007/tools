import * as ecs from '@8thwall/ecs'

ecs.registerComponent({
  name: 'Load Video from URL',
  schema: {
    videoUrl: ecs.string,
  },
  schemaDefaults: {
    videoUrl: 'https://qphong.cn/statics/waves.mp4',
  },
  add: (world, component) => {
    const {videoUrl} = component.schemaAttribute.get(component.eid)

    if (!videoUrl) {
      console.warn('[Load Video from URL] No videoUrl specified.')
      return
    }

    ecs.assets.load({
      url: videoUrl,
    })
      .then((result) => {
        const eid = component.eid
        if (ecs.UnlitMaterial.has(world, eid)) {
          ecs.UnlitMaterial.mutate(world, eid, (material) => {
            material.textureSrc = result.remoteUrl
          })
        } else if (ecs.Material.has(world, eid)) {
          ecs.Material.mutate(world, eid, (material) => {
            material.textureSrc = result.remoteUrl
          })
        } else if (ecs.VideoMaterial.has(world, eid)) {
          ecs.VideoMaterial.mutate(world, eid, (material) => {
            material.textureSrc = result.remoteUrl
          })
        } else {
          console.warn('[Load Video from URL] No compatible material component (UnlitMaterial, Material, or VideoMaterial) found on entity.', eid)
        }
      })
      .catch((error) => {
        console.error('[Load Video from URL] Failed to load video texture from URL:', videoUrl, error)
      })
  },
})

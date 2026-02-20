<template>
  <canvas id="fishTankCanvas" type="webgl" class="tank-canvas" @touchstart="onTouchStart"></canvas>
</template>

<script>
import FishTankRenderer from './renderer'

export default {
  emits: ['fish-tap'],
  data() {
    return {}
  },
  methods: {
    /**
     * 初始化 canvas 和 renderer
     * @returns {Promise<void>}
     */
    init() {
      return new Promise((resolve, reject) => {
        const query = uni.createSelectorQuery().in(this)
        query.select('#fishTankCanvas')
          .fields({ node: true, size: true })
          .exec((res) => {
            if (!res[0]) {
              console.error('Canvas 节点获取失败')
              return reject(new Error('Canvas 节点获取失败'))
            }

            const canvas = res[0].node
            this._canvas = canvas
            this._cssWidth = res[0].width
            this._cssHeight = res[0].height

            const sysInfo = uni.getSystemInfoSync()
            this._dpr = sysInfo.pixelRatio || 1

            const gl = canvas.getContext('webgl', { alpha: false, antialias: true })
            if (!gl) {
              console.error('WebGL 初始化失败')
              return reject(new Error('WebGL 初始化失败'))
            }

            canvas.width = res[0].width * this._dpr
            canvas.height = res[0].height * this._dpr

            gl.viewport(0, 0, canvas.width, canvas.height)
            gl.enable(gl.BLEND)
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

            this._renderer = new FishTankRenderer(canvas, gl, this._dpr)
            this._renderer.init()

            resolve()
          })
      })
    },

    getRenderer() {
      return this._renderer
    },

    startRenderLoop() {
      const canvas = this._canvas
      if (!canvas || !this._renderer) return

      const render = () => {
        if (this._paused) return
        this._renderer.render()
        this._animFrameId = canvas.requestAnimationFrame(render)
      }
      this._paused = false
      this._animFrameId = canvas.requestAnimationFrame(render)
    },

    stopRenderLoop() {
      this._paused = true
      if (this._canvas && this._animFrameId) {
        this._canvas.cancelAnimationFrame(this._animFrameId)
        this._animFrameId = 0
      }
    },

    destroy() {
      this.stopRenderLoop()
      if (this._renderer) {
        this._renderer.destroy()
        this._renderer = null
      }
    },

    onTouchStart(e) {
      if (!this._renderer) return
      const touch = e.touches[0]
      if (!touch) return

      const logicX = touch.x != null ? touch.x : touch.clientX
      const logicY = touch.y != null ? touch.y : touch.clientY

      const fish = this._renderer.hitTest(logicX, logicY)
      if (fish) {
        this.$emit('fish-tap', {
          fishId: fish.fishId,
          likes: fish.likes,
          x: logicX,
          y: logicY,
        })
      }
    },
  },
}
</script>

<style scoped>
.tank-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>

<template>
  <canvas
    id="drawCanvas"
    type="2d"
    class="draw-canvas"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  />
</template>

<script>
import DrawingPainter from './painter'

export default {
  props: {
    currentTool: {
      type: String,
      default: 'pen',
    },
    currentColor: {
      type: String,
      default: '#FD5900',
    },
    currentSize: {
      type: Number,
      default: 6,
    },
  },
  methods: {
    /**
     * 初始化 canvas 和 painter
     * @returns {Promise<void>}
     */
    init() {
      return new Promise((resolve, reject) => {
        const query = uni.createSelectorQuery().in(this)
        query
          .select('#drawCanvas')
          .fields({ node: true, size: true, rect: true })
          .exec((res) => {
            if (!res || !res[0]) {
              console.error('[draw-fish] canvas 节点未找到')
              return reject(new Error('canvas 节点未找到'))
            }

            const info = res[0]
            const canvas = info.node
            const ctx = canvas.getContext('2d')

            const dpr = uni.getSystemInfoSync().pixelRatio
            canvas.width = info.width * dpr
            canvas.height = info.height * dpr
            ctx.scale(dpr, dpr)

            ctx.clearRect(0, 0, info.width, info.height)
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'

            const rect = {
              left: info.left || 0,
              top: info.top || 0,
              width: info.width,
              height: info.height,
            }

            this._painter = new DrawingPainter(canvas, ctx, dpr, rect)
            this._painter.drawGuide()

            resolve()
          })
      })
    },

    getPainter() {
      return this._painter
    },

    onTouchStart(e) {
      if (!this._painter) return
      const touch = e.touches[0]

      if (this.currentTool === 'fill') {
        const point = this._painter._getPoint(touch)
        this._painter.floodFill(point.x, point.y, this.currentColor)
        return
      }

      const isEraser = this.currentTool === 'eraser'
      this._painter.beginStroke(touch, {
        color: isEraser ? '#FFFFFF' : this.currentColor,
        lineWidth: isEraser ? this.currentSize * 3 : this.currentSize,
        isEraser,
      })
    },

    onTouchMove(e) {
      if (!this._painter) return
      const touch = e.touches[0]
      this._painter.addPoint(touch)
    },

    onTouchEnd() {
      if (!this._painter) return
      this._painter.endStroke()
    },
  },
}
</script>

<style scoped>
.draw-canvas {
  width: 100%;
  height: 100%;
}
</style>

/**
 * DrawingPainter — Canvas 2D 绘图引擎
 * 纯 JS 类，不依赖 Vue / uni-app API
 */
export default class DrawingPainter {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} dpr  设备像素比
   * @param {{ left: number, top: number, width: number, height: number }} rect  逻辑坐标信息
   */
  constructor(canvas, ctx, dpr, rect) {
    this._canvas = canvas
    this._ctx = ctx
    this._dpr = dpr
    this._rect = rect

    this._strokes = []       // 笔画历史
    this._currentStroke = null
    this._showGuide = true
  }

  // ---------- 引导绘制 ----------

  drawGuide() {
    const ctx = this._ctx
    if (!ctx || !this._rect) return

    const { width, height } = this._rect
    const cx = width / 2
    const cy = height * 0.45

    const bodyRx = width * 0.18
    const bodyRy = height * 0.22
    const headR = bodyRx * 0.7
    const headCy = cy - bodyRy - headR * 0.5
    const tailCy = cy + bodyRy

    ctx.save()

    // 鱼身轮廓（虚线椭圆）
    ctx.strokeStyle = '#D0D0D0'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 5])
    ctx.beginPath()
    ctx.ellipse(cx, cy, bodyRx, bodyRy, 0, 0, Math.PI * 2)
    ctx.stroke()

    // 鱼头轮廓（虚线半圆）
    ctx.beginPath()
    ctx.arc(cx, headCy, headR, Math.PI * 0.8, Math.PI * 0.2)
    ctx.stroke()

    // 眼睛
    ctx.setLineDash([])
    ctx.globalAlpha = 0.25
    ctx.fillStyle = '#666'
    const eyeR = headR * 0.15
    ctx.beginPath()
    ctx.arc(cx - headR * 0.35, headCy, eyeR, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + headR * 0.35, headCy, eyeR, 0, Math.PI * 2)
    ctx.fill()

    // 鱼尾轮廓（虚线 V 形）
    ctx.globalAlpha = 1
    ctx.strokeStyle = '#D0D0D0'
    ctx.setLineDash([8, 5])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx - bodyRx * 0.3, tailCy)
    ctx.lineTo(cx - bodyRx * 0.7, tailCy + height * 0.08)
    ctx.moveTo(cx + bodyRx * 0.3, tailCy)
    ctx.lineTo(cx + bodyRx * 0.7, tailCy + height * 0.08)
    ctx.moveTo(cx - bodyRx * 0.7, tailCy + height * 0.08)
    ctx.quadraticCurveTo(cx, tailCy + height * 0.12, cx + bodyRx * 0.7, tailCy + height * 0.08)
    ctx.stroke()

    // 标注文字
    ctx.setLineDash([])

    ctx.globalAlpha = 0.7
    ctx.fillStyle = '#FD5900'
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('鱼头朝这边', cx, headCy - headR - 12)

    // 上方箭头
    ctx.beginPath()
    ctx.moveTo(cx, headCy - headR - 6)
    ctx.lineTo(cx - 8, headCy - headR + 4)
    ctx.moveTo(cx, headCy - headR - 6)
    ctx.lineTo(cx + 8, headCy - headR + 4)
    ctx.strokeStyle = '#FD5900'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // 鱼尾标注
    ctx.globalAlpha = 0.5
    ctx.fillStyle = '#999'
    ctx.font = '13px sans-serif'
    ctx.fillText('鱼尾', cx, tailCy + height * 0.12 + 20)

    // 鱼肚/鱼背
    ctx.globalAlpha = 0.45
    ctx.fillStyle = '#888'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('← 鱼肚', cx - bodyRx - 10, cy)
    ctx.textAlign = 'left'
    ctx.fillText('鱼背 →', cx + bodyRx + 10, cy)

    // 底部提示
    // ctx.globalAlpha = 0.5
    // ctx.fillStyle = '#FD5900'
    // ctx.font = 'bold 13px sans-serif'
    // ctx.textAlign = 'center'
    // ctx.fillText('在鱼缸中，你画的鱼会旋转 90° 横着游', cx, height - 16)

    ctx.restore()
  }

  clearGuide() {
    if (!this._showGuide) return
    this._showGuide = false

    const ctx = this._ctx
    if (!ctx) return
    const { width, height } = this._rect

    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, width, height)
  }

  // ---------- 坐标转换 ----------

  _getPoint(touch) {
    return {
      x: touch.clientX - this._rect.left,
      y: touch.clientY - this._rect.top,
    }
  }

  // ---------- 绘图核心 ----------

  /**
   * 开始一笔
   * @param {{ clientX: number, clientY: number }} touch  原始 touch 对象
   * @param {{ color: string, lineWidth: number, isEraser: boolean }} options
   */
  beginStroke(touch, options) {
    // 第一笔自动清除引导
    if (this._showGuide) {
      this.clearGuide()
    }

    const point = this._getPoint(touch)
    const { color, lineWidth, isEraser } = options

    this._currentStroke = {
      color,
      lineWidth,
      isEraser,
      points: [point],
    }

    const ctx = this._ctx
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
    }
    ctx.lineWidth = lineWidth
  }

  /**
   * 移动时实时绘制
   * @param {{ clientX: number, clientY: number }} touch
   */
  addPoint(touch) {
    if (!this._currentStroke) return

    const point = this._getPoint(touch)
    this._currentStroke.points.push(point)

    const ctx = this._ctx
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  /**
   * 结束一笔，返回完成的 stroke 或 null
   */
  endStroke() {
    if (!this._currentStroke) return null

    const stroke = this._currentStroke
    this._currentStroke = null

    // 恢复合成模式
    this._ctx.globalCompositeOperation = 'source-over'

    // 只有有效笔画才存入历史
    if (stroke.points.length >= 2) {
      this._strokes.push(stroke)
      return stroke
    }
    return null
  }

  /**
   * 填充并返回 fill 记录
   * @param {number} x  逻辑坐标 x
   * @param {number} y  逻辑坐标 y
   * @param {string} color  hex 颜色
   */
  floodFill(x, y, color) {
    // 第一次填充时也清除引导
    if (this._showGuide) {
      this.clearGuide()
    }

    this._floodFillDirect(x, y, color)
    const record = { isFill: true, x, y, color }
    this._strokes.push(record)
    return record
  }

  // ---------- 历史管理 ----------

  undo() {
    if (this._strokes.length === 0) return 0
    this._strokes.pop()
    this._redrawAll()
    return this._strokes.length
  }

  clearAll() {
    this._strokes = []
    this._redrawAll()
    // 清空后重新显示引导
    this._showGuide = true
    this.drawGuide()
  }

  getStrokeCount() {
    return this._strokes.length
  }

  // ---------- 导出 ----------

  getContentBounds() {
    const ctx = this._ctx
    const canvas = this._canvas
    if (!ctx || !canvas) return null

    const w = canvas.width
    const h = canvas.height
    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data

    let minX = w, minY = h, maxX = 0, maxY = 0
    let hasContent = false

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3]
        if (alpha > 10) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
          hasContent = true
        }
      }
    }

    if (!hasContent) return null

    const pad = Math.ceil(4 * this._dpr)
    minX = Math.max(0, minX - pad)
    minY = Math.max(0, minY - pad)
    maxX = Math.min(w - 1, maxX + pad)
    maxY = Math.min(h - 1, maxY + pad)

    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
  }

  getCanvasNode() {
    return this._canvas
  }

  // ---------- 内部方法 ----------

  _redrawAll() {
    const ctx = this._ctx
    if (!ctx) return

    const { width, height } = this._rect

    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, width, height)

    for (const stroke of this._strokes) {
      if (stroke.isFill) {
        this._floodFillDirect(stroke.x, stroke.y, stroke.color)
        continue
      }

      if (stroke.points.length < 2) continue

      ctx.beginPath()
      ctx.lineWidth = stroke.lineWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (stroke.isEraser) {
        ctx.globalCompositeOperation = 'destination-out'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = stroke.color
      }

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.stroke()
    }

    ctx.globalCompositeOperation = 'source-over'
  }

  _floodFillDirect(logicX, logicY, color) {
    const ctx = this._ctx
    const canvas = this._canvas
    if (!ctx || !canvas) return

    const dpr = this._dpr
    const w = canvas.width
    const h = canvas.height

    const startX = Math.round(logicX * dpr)
    const startY = Math.round(logicY * dpr)
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return

    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data

    const fillR = parseInt(color.slice(1, 3), 16)
    const fillG = parseInt(color.slice(3, 5), 16)
    const fillB = parseInt(color.slice(5, 7), 16)
    const fillA = 255

    const startIdx = (startY * w + startX) * 4
    const srcR = data[startIdx]
    const srcG = data[startIdx + 1]
    const srcB = data[startIdx + 2]
    const srcA = data[startIdx + 3]

    if (srcR === fillR && srcG === fillG && srcB === fillB && srcA === fillA) return

    const tolerance = 32

    function colorMatch(idx) {
      const dr = data[idx] - srcR
      const dg = data[idx + 1] - srcG
      const db = data[idx + 2] - srcB
      const da = data[idx + 3] - srcA
      return (dr * dr + dg * dg + db * db + da * da) <= tolerance * tolerance * 4
    }

    function setPixel(idx) {
      data[idx] = fillR
      data[idx + 1] = fillG
      data[idx + 2] = fillB
      data[idx + 3] = fillA
    }

    const stack = [[startX, startY]]
    const visited = new Uint8Array(w * h)

    while (stack.length > 0) {
      let [x, y] = stack.pop()
      let idx = (y * w + x) * 4

      while (x >= 0 && colorMatch(idx) && !visited[y * w + x]) {
        x--
        idx -= 4
      }
      x++
      idx += 4

      let spanUp = false
      let spanDown = false

      while (x < w && colorMatch((y * w + x) * 4) && !visited[y * w + x]) {
        const ci = (y * w + x) * 4
        setPixel(ci)
        visited[y * w + x] = 1

        if (y > 0) {
          const upIdx = ((y - 1) * w + x) * 4
          const upMatch = colorMatch(upIdx) && !visited[(y - 1) * w + x]
          if (!spanUp && upMatch) {
            stack.push([x, y - 1])
            spanUp = true
          } else if (spanUp && !upMatch) {
            spanUp = false
          }
        }

        if (y < h - 1) {
          const downIdx = ((y + 1) * w + x) * 4
          const downMatch = colorMatch(downIdx) && !visited[(y + 1) * w + x]
          if (!spanDown && downMatch) {
            stack.push([x, y + 1])
            spanDown = true
          } else if (spanDown && !downMatch) {
            spanDown = false
          }
        }

        x++
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }
}

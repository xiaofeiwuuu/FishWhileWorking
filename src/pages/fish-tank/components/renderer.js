// 点赞影响鱼大小的常量
const MIN_TARGET_H = 50   // 最小高度（0 赞）
const MAX_TARGET_H = 120  // 最大高度（30+ 赞）
const LIKES_FOR_MAX = 30  // 达到最大尺寸的点赞数

function calcTargetH(likes) {
  return MIN_TARGET_H + (MAX_TARGET_H - MIN_TARGET_H) * Math.min((likes || 0) / LIKES_FOR_MAX, 1)
}

// 预设鱼颜色
const FISH_PRESETS = [
  { name: '小橙', body: '#FF6B35', fin: '#E85D26', belly: '#FFB088' },
  { name: '蓝蓝', body: '#4ECDC4', fin: '#38B2A8', belly: '#A8E6E0' },
  { name: '金金', body: '#FFD93D', fin: '#F0C420', belly: '#FFF0A0' },
  { name: '紫霞', body: '#C084FC', fin: '#A855F7', belly: '#E0C0FF' },
  { name: '粉粉', body: '#FB7185', fin: '#E5556A', belly: '#FECDD3' },
]

// 顶点着色器
const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  uniform vec2 u_resolution;
  uniform mat3 u_matrix;
  varying vec2 v_texCoord;
  void main() {
    vec2 position = (u_matrix * vec3(a_position, 1.0)).xy;
    vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_texCoord = a_texCoord;
  }
`

// 片段着色器
const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D u_texture;
  uniform float u_alpha;
  varying vec2 v_texCoord;
  void main() {
    vec4 texColor = texture2D(u_texture, v_texCoord);
    gl_FragColor = vec4(texColor.rgb, texColor.a * u_alpha);
  }
`

// 背景顶点着色器（纯色顶点着色）
const BG_VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec4 a_color;
  uniform vec2 u_resolution;
  varying vec4 v_color;
  void main() {
    vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_color = a_color;
  }
`

const BG_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec4 v_color;
  void main() {
    gl_FragColor = v_color;
  }
`

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

export default class FishTankRenderer {
  constructor(canvas, gl, dpr) {
    this._canvas = canvas
    this._gl = gl
    this._dpr = dpr
    this._width = canvas.width / dpr   // CSS 宽（逻辑像素）
    this._height = canvas.height / dpr  // CSS 高（逻辑像素）

    this._program = null
    this._bgProgram = null
    this._positionBuffer = null
    this._texCoordBuffer = null
    this._bgPositionBuffer = null
    this._bgColorBuffer = null
    this._textures = []
    this._userTextures = []
    this._fishes = []
  }

  // ==================== 公共方法 ====================

  init() {
    this._createShaderPrograms()
    this._generateFishTextures()
  }

  destroy() {
    const gl = this._gl
    if (!gl) return
    this._textures.forEach(t => t && gl.deleteTexture(t))
    this._userTextures.forEach(t => t && gl.deleteTexture(t))
    if (this._positionBuffer) gl.deleteBuffer(this._positionBuffer)
    if (this._texCoordBuffer) gl.deleteBuffer(this._texCoordBuffer)
    if (this._bgPositionBuffer) gl.deleteBuffer(this._bgPositionBuffer)
    if (this._bgColorBuffer) gl.deleteBuffer(this._bgColorBuffer)
    if (this._program) gl.deleteProgram(this._program)
    if (this._bgProgram) gl.deleteProgram(this._bgProgram)
    this._textures = []
    this._userTextures = []
    this._fishes = []
  }

  addFish(fishData) {
    const goRight = Math.random() > 0.5
    const likes = fishData.likes || 0
    const targetH = calcTargetH(likes)
    this._fishes.push({
      x: Math.random() * this._width,
      y: 80 + Math.random() * (this._height - 200),
      vx: (0.3 + Math.random() * 0.8) * (goRight ? 1 : -1),
      tailPhase: Math.random() * Math.PI * 2,
      floatPhase: Math.random() * Math.PI * 2,
      floatAmp: 2 + Math.random() * 3,
      isUserFish: true,
      textureIndex: fishData.textureIndex,
      imgW: fishData.imgW,
      imgH: fishData.imgH,
      swimMode: fishData.swimMode != null ? fishData.swimMode : 1,
      fishId: fishData.fishId || null,
      likes,
      targetH,
    })
  }

  getFishCount() {
    return this._fishes.length
  }

  /**
   * 碰撞检测：判断逻辑坐标 (logicX, logicY) 是否命中某条鱼
   * 鱼旋转 -90° 横着游，碰撞区域是以 (fish.x, fish.y) 为中心的矩形
   * @returns {object|null} 命中的鱼对象或 null
   */
  hitTest(logicX, logicY) {
    const dpr = this._dpr
    for (let i = this._fishes.length - 1; i >= 0; i--) {
      const fish = this._fishes[i]
      if (!fish.isUserFish) continue

      const targetH = fish.targetH || MIN_TARGET_H
      const scale = targetH / fish.imgW
      // 鱼旋转了 -90°，所以宽高互换
      const halfW = fish.imgH * scale / 2  // 屏幕上的半宽
      const halfH = fish.imgW * scale / 2  // 屏幕上的半高

      const dx = logicX - fish.x
      const dy = logicY - fish.y

      if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
        return fish
      }
    }
    return null
  }

  getFishById(fishId) {
    return this._fishes.find(f => f.fishId === fishId) || null
  }

  updateFishLikes(fishId, likes) {
    const fish = this.getFishById(fishId)
    if (fish) {
      fish.likes = likes
      fish.targetH = calcTargetH(likes)
    }
  }

  pauseFish(fishId) {
    const fish = this.getFishById(fishId)
    if (fish) {
      fish._paused = true
      fish._savedVx = fish.vx
    }
  }

  resumeFish(fishId) {
    const fish = this.getFishById(fishId)
    if (fish && fish._paused) {
      fish._paused = false
      fish.vx = fish._savedVx || fish.vx
    }
  }

  hasFishByFileID(fileID) {
    // fileID 去重由外部维护，此方法保留接口一致性
    return false
  }

  /**
   * 加载用户图片为纹理
   * @param {Image} image - canvas.createImage() 创建并已加载的图片对象
   * @param {number} imgW - 图片原始宽
   * @param {number} imgH - 图片原始高
   * @returns {number} textureIndex
   */
  loadUserTexture(image, imgW, imgH) {
    const gl = this._gl
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    const textureIndex = this._userTextures.length
    this._userTextures.push(texture)
    return textureIndex
  }

  render() {
    const gl = this._gl
    if (!gl) return

    this._drawBackground()
    this._drawSeaweed()

    // 先更新所有鱼的位置
    this._fishes.forEach((fish) => this._updateFish(fish))

    // 鱼间碰撞推开
    this._separateFishes()

    gl.useProgram(this._program)
    this._fishes.forEach((fish) => this._drawFish(fish))
  }

  // ==================== 内部方法 ====================

  _createShaderPrograms() {
    const gl = this._gl

    this._program = this._createProgram(VERTEX_SHADER, FRAGMENT_SHADER)
    this._bgProgram = this._createProgram(BG_VERTEX_SHADER, BG_FRAGMENT_SHADER)

    gl.useProgram(this._program)
    this._positionBuffer = gl.createBuffer()
    this._texCoordBuffer = gl.createBuffer()

    gl.useProgram(this._bgProgram)
    this._bgPositionBuffer = gl.createBuffer()
    this._bgColorBuffer = gl.createBuffer()
  }

  _createProgram(vSrc, fSrc) {
    const gl = this._gl
    const vs = this._createShader(gl.VERTEX_SHADER, vSrc)
    const fs = this._createShader(gl.FRAGMENT_SHADER, fSrc)
    if (!vs || !fs) return null

    const prog = gl.createProgram()
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('程序链接失败:', gl.getProgramInfoLog(prog))
      return null
    }
    return prog
  }

  _createShader(type, source) {
    const gl = this._gl
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('着色器编译失败:', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }
    return shader
  }

  _generateFishTextures() {
    const gl = this._gl
    const texSize = 128
    this._textures = []

    FISH_PRESETS.forEach((preset, index) => {
      let offCanvas = null
      let ctx = null
      try {
        // #ifdef MP-WEIXIN
        offCanvas = wx.createOffscreenCanvas({ type: '2d', width: texSize, height: texSize })
        ctx = offCanvas.getContext('2d')
        // #endif
        // #ifndef MP-WEIXIN
        offCanvas = null
        // #endif
      } catch (e) {
        offCanvas = null
      }

      if (!offCanvas || !ctx) {
        const pixels = this._generateFishPixels(texSize, preset)
        const texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texSize, texSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        this._textures[index] = texture
        return
      }

      this._drawFishToCanvas(ctx, texSize, preset)

      const imageData = ctx.getImageData(0, 0, texSize, texSize)
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texSize, texSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(imageData.data))
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      this._textures[index] = texture
    })
  }

  _drawFishToCanvas(ctx, size, preset) {
    ctx.clearRect(0, 0, size, size)

    const cx = size * 0.42
    const cy = size * 0.5
    const bodyRx = size * 0.32
    const bodyRy = size * 0.22

    // 身体（椭圆）
    ctx.fillStyle = preset.body
    ctx.beginPath()
    ctx.ellipse(cx, cy, bodyRx, bodyRy, 0, 0, Math.PI * 2)
    ctx.fill()

    // 肚皮
    ctx.fillStyle = preset.belly
    ctx.beginPath()
    ctx.ellipse(cx + bodyRx * 0.05, cy + bodyRy * 0.25, bodyRx * 0.7, bodyRy * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // 尾巴（三角形）
    const tailX = cx + bodyRx
    ctx.fillStyle = preset.fin
    ctx.beginPath()
    ctx.moveTo(tailX - 2, cy - bodyRy * 0.3)
    ctx.lineTo(tailX + size * 0.28, cy - bodyRy * 0.7)
    ctx.lineTo(tailX + size * 0.28, cy + bodyRy * 0.7)
    ctx.lineTo(tailX - 2, cy + bodyRy * 0.3)
    ctx.closePath()
    ctx.fill()

    // 背鳍
    ctx.fillStyle = preset.fin
    ctx.beginPath()
    ctx.moveTo(cx - bodyRx * 0.2, cy - bodyRy)
    ctx.quadraticCurveTo(cx + bodyRx * 0.1, cy - bodyRy - size * 0.1, cx + bodyRx * 0.4, cy - bodyRy + bodyRy * 0.1)
    ctx.lineTo(cx - bodyRx * 0.1, cy - bodyRy + bodyRy * 0.15)
    ctx.closePath()
    ctx.fill()

    // 胸鳍
    ctx.fillStyle = preset.fin
    ctx.globalAlpha = 0.7
    ctx.beginPath()
    ctx.ellipse(cx + bodyRx * 0.1, cy + bodyRy * 0.5, bodyRx * 0.22, bodyRy * 0.4, Math.PI * 0.25, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1.0

    // 眼睛（白色底 + 黑色瞳孔）
    const eyeX = cx - bodyRx * 0.45
    const eyeY = cy - bodyRy * 0.2
    const eyeR = size * 0.06

    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#1A1A2E'
    ctx.beginPath()
    ctx.arc(eyeX - eyeR * 0.2, eyeY, eyeR * 0.55, 0, Math.PI * 2)
    ctx.fill()

    // 眼睛高光
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(eyeX - eyeR * 0.4, eyeY - eyeR * 0.25, eyeR * 0.2, 0, Math.PI * 2)
    ctx.fill()

    // 嘴巴
    ctx.strokeStyle = preset.fin
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx - bodyRx * 0.7, cy + bodyRy * 0.1, size * 0.03, -0.3, Math.PI * 0.6)
    ctx.stroke()
  }

  _generateFishPixels(size, preset) {
    const pixels = new Uint8Array(size * size * 4)
    const bodyColor = hexToRgb(preset.body)
    const finColor = hexToRgb(preset.fin)
    const bellyColor = hexToRgb(preset.belly)

    const cx = size * 0.42
    const cy = size * 0.5
    const bodyRx = size * 0.32
    const bodyRy = size * 0.22

    const tailStartX = cx + bodyRx - 2
    const tailEndX = cx + bodyRx + size * 0.28
    const tailTopY = cy - bodyRy * 0.7
    const tailBotY = cy + bodyRy * 0.7

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4

        const dx = (x - cx) / bodyRx
        const dy = (y - cy) / bodyRy
        const inBody = (dx * dx + dy * dy) <= 1.0

        const bellyCx = cx + bodyRx * 0.05
        const bellyCy = cy + bodyRy * 0.25
        const bellyRx = bodyRx * 0.7
        const bellyRy = bodyRy * 0.5
        const bdx = (x - bellyCx) / bellyRx
        const bdy = (y - bellyCy) / bellyRy
        const inBelly = (bdx * bdx + bdy * bdy) <= 1.0

        let inTail = false
        if (x >= tailStartX && x <= tailEndX) {
          const t = (x - tailStartX) / (tailEndX - tailStartX)
          const topAtX = cy - bodyRy * 0.3 + (tailTopY - (cy - bodyRy * 0.3)) * t
          const botAtX = cy + bodyRy * 0.3 + (tailBotY - (cy + bodyRy * 0.3)) * t
          if (y >= topAtX && y <= botAtX) inTail = true
        }

        const eyeX = cx - bodyRx * 0.45
        const eyeY = cy - bodyRy * 0.2
        const eyeR = size * 0.06
        const edx = x - eyeX
        const edy = y - eyeY
        const inEyeWhite = (edx * edx + edy * edy) <= eyeR * eyeR
        const pupilR = eyeR * 0.55
        const pdx = x - (eyeX - eyeR * 0.2)
        const pdy = y - eyeY
        const inPupil = (pdx * pdx + pdy * pdy) <= pupilR * pupilR

        if (inPupil) {
          pixels[idx] = 26
          pixels[idx + 1] = 26
          pixels[idx + 2] = 46
          pixels[idx + 3] = 255
        } else if (inEyeWhite) {
          pixels[idx] = 255
          pixels[idx + 1] = 255
          pixels[idx + 2] = 255
          pixels[idx + 3] = 255
        } else if (inBelly && inBody) {
          pixels[idx] = Math.round(bellyColor[0] * 255)
          pixels[idx + 1] = Math.round(bellyColor[1] * 255)
          pixels[idx + 2] = Math.round(bellyColor[2] * 255)
          pixels[idx + 3] = 255
        } else if (inBody) {
          pixels[idx] = Math.round(bodyColor[0] * 255)
          pixels[idx + 1] = Math.round(bodyColor[1] * 255)
          pixels[idx + 2] = Math.round(bodyColor[2] * 255)
          pixels[idx + 3] = 255
        } else if (inTail) {
          pixels[idx] = Math.round(finColor[0] * 255)
          pixels[idx + 1] = Math.round(finColor[1] * 255)
          pixels[idx + 2] = Math.round(finColor[2] * 255)
          pixels[idx + 3] = 255
        } else {
          pixels[idx] = 0
          pixels[idx + 1] = 0
          pixels[idx + 2] = 0
          pixels[idx + 3] = 0
        }
      }
    }
    return pixels
  }

  _separateFishes() {
    const fishes = this._fishes
    for (let i = 0; i < fishes.length; i++) {
      for (let j = i + 1; j < fishes.length; j++) {
        const a = fishes[i]
        const b = fishes[j]
        const rA = (a.targetH || MIN_TARGET_H) * 0.45
        const rB = (b.targetH || MIN_TARGET_H) * 0.45
        const minDist = rA + rB

        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < minDist && dist > 0.01) {
          const overlap = (minDist - dist) / 2
          const nx = dx / dist
          const ny = dy / dist
          if (!a._paused) { a.x -= nx * overlap; a.y -= ny * overlap }
          if (!b._paused) { b.x += nx * overlap; b.y += ny * overlap }
        }
      }
    }
  }

  _updateFish(fish) {
    if (fish._paused) return

    fish.x += fish.vx
    fish.tailPhase += 0.08
    fish.floatPhase += 0.02

    fish.y += Math.sin(fish.floatPhase) * fish.floatAmp * 0.1

    const margin = fish.isUserFish ? (fish.targetH || MIN_TARGET_H) : fish.size * fish.scale
    if (fish.vx > 0 && fish.x > this._width + margin) {
      const speed = 0.3 + Math.random() * 0.8
      if (Math.random() > 0.5) {
        fish.x = this._width + margin
        fish.vx = -speed
      } else {
        fish.x = -margin
        fish.vx = speed
      }
      fish.y = 80 + Math.random() * (this._height - 200)
    } else if (fish.vx < 0 && fish.x < -margin) {
      const speed = 0.3 + Math.random() * 0.8
      if (Math.random() > 0.5) {
        fish.x = -margin
        fish.vx = speed
      } else {
        fish.x = this._width + margin
        fish.vx = -speed
      }
      fish.y = 80 + Math.random() * (this._height - 200)
    }
  }

  _drawFish(fish) {
    const gl = this._gl
    if (!this._program) return

    if (fish.isUserFish) {
      this._drawUserFish(fish)
      return
    }

    if (this._textures.length === 0) return
    const texture = this._textures[fish.colorIndex]
    if (!texture) return

    gl.bindTexture(gl.TEXTURE_2D, texture)

    this._drawFishBody(fish)

    const tailSlices = 5
    for (let i = 0; i < tailSlices; i++) {
      this._drawTailSlice(fish, i, tailSlices)
    }
  }

  _drawFishBody(fish) {
    const gl = this._gl
    const dpr = this._dpr
    const bodyWidth = fish.size * 0.7 * fish.scale * dpr
    const bodyHeight = fish.size * 0.5 * fish.scale * dpr

    const facingLeft = fish.vx < 0

    const positions = new Float32Array([
      0, 0,
      bodyWidth, 0,
      0, bodyHeight,
      bodyWidth, bodyHeight
    ])

    gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW)
    const posLoc = gl.getAttribLocation(this._program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    let texCoords
    if (facingLeft) {
      texCoords = new Float32Array([0.7, 0, 0, 0, 0.7, 1, 0, 1])
    } else {
      texCoords = new Float32Array([0, 0, 0.7, 0, 0, 1, 0.7, 1])
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this._texCoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.DYNAMIC_DRAW)
    const texLoc = gl.getAttribLocation(this._program, 'a_texCoord')
    gl.enableVertexAttribArray(texLoc)
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0)

    let drawX
    if (facingLeft) {
      drawX = fish.x * dpr - bodyWidth
    } else {
      drawX = fish.x * dpr
    }

    const matrix = this._createTransformMatrix(drawX, fish.y * dpr, 0, 1, 1)
    const matLoc = gl.getUniformLocation(this._program, 'u_matrix')
    gl.uniformMatrix3fv(matLoc, false, matrix)

    const resLoc = gl.getUniformLocation(this._program, 'u_resolution')
    gl.uniform2f(resLoc, this._canvas.width, this._canvas.height)

    const alphaLoc = gl.getUniformLocation(this._program, 'u_alpha')
    gl.uniform1f(alphaLoc, 1.0)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  _drawTailSlice(fish, sliceIndex, totalSlices) {
    const gl = this._gl
    const dpr = this._dpr
    const bodyWidth = fish.size * 0.7 * fish.scale * dpr
    const tailWidth = fish.size * 0.3 * fish.scale * dpr
    const sliceWidth = tailWidth / totalSlices
    const bodyHeight = fish.size * 0.5 * fish.scale * dpr

    const facingLeft = fish.vx < 0

    const waveAngle = Math.sin(fish.tailPhase + sliceIndex * 0.3) * 12 * (Math.PI / 180) * ((sliceIndex + 1) / totalSlices)

    const positions = new Float32Array([
      0, 0,
      sliceWidth, 0,
      0, bodyHeight,
      sliceWidth, bodyHeight
    ])

    gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW)
    const posLoc = gl.getAttribLocation(this._program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    let texCoords
    if (facingLeft) {
      const texStartX = 0.7 - ((sliceIndex + 1) / totalSlices) * 0.3
      const texEndX = 0.7 - (sliceIndex / totalSlices) * 0.3
      texCoords = new Float32Array([texEndX, 0, texStartX, 0, texEndX, 1, texStartX, 1])
    } else {
      const texStartX = 0.7 + (sliceIndex / totalSlices) * 0.3
      const texEndX = 0.7 + ((sliceIndex + 1) / totalSlices) * 0.3
      texCoords = new Float32Array([texStartX, 0, texEndX, 0, texStartX, 1, texEndX, 1])
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this._texCoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.DYNAMIC_DRAW)
    const texLoc = gl.getAttribLocation(this._program, 'a_texCoord')
    gl.enableVertexAttribArray(texLoc)
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0)

    let offsetX
    if (facingLeft) {
      offsetX = fish.x * dpr + sliceIndex * sliceWidth
    } else {
      offsetX = fish.x * dpr + bodyWidth + sliceIndex * sliceWidth
    }
    const offsetY = fish.y * dpr

    const flipAngle = facingLeft ? -waveAngle : waveAngle
    const matrix = this._createTransformMatrix(offsetX, offsetY, flipAngle, 1, 1)
    const matLoc = gl.getUniformLocation(this._program, 'u_matrix')
    gl.uniformMatrix3fv(matLoc, false, matrix)

    const resLoc = gl.getUniformLocation(this._program, 'u_resolution')
    gl.uniform2f(resLoc, this._canvas.width, this._canvas.height)

    const alphaLoc = gl.getUniformLocation(this._program, 'u_alpha')
    gl.uniform1f(alphaLoc, 1.0)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  _drawBackground() {
    const gl = this._gl
    const w = this._canvas.width
    const h = this._canvas.height

    gl.useProgram(this._bgProgram)

    const topColor = [255 / 255, 246 / 255, 235 / 255, 1.0]  // #FFF6EB 与首页一致
    const botColor = [255 / 255, 236 / 255, 210 / 255, 1.0]  // #FFECD2 底部略深

    const positions = new Float32Array([
      0, 0, w, 0, 0, h, w, h
    ])
    const colors = new Float32Array([
      ...topColor, ...topColor, ...botColor, ...botColor
    ])

    gl.bindBuffer(gl.ARRAY_BUFFER, this._bgPositionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(this._bgProgram, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this._bgColorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW)
    const colLoc = gl.getAttribLocation(this._bgProgram, 'a_color')
    gl.enableVertexAttribArray(colLoc)
    gl.vertexAttribPointer(colLoc, 4, gl.FLOAT, false, 0, 0)

    const resLoc = gl.getUniformLocation(this._bgProgram, 'u_resolution')
    gl.uniform2f(resLoc, w, h)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  _drawSeaweed() {
    const gl = this._gl
    const w = this._canvas.width
    const h = this._canvas.height
    const dpr = this._dpr

    gl.useProgram(this._bgProgram)

    // 底部沙地
    const sandY = h * 0.88
    const sandColor = [230 / 255, 200 / 255, 140 / 255, 1.0]  // 沙黄 #E6C88C
    const sandBot = [210 / 255, 175 / 255, 110 / 255, 1.0]   // 深沙 #D2AF6E

    const sandPos = new Float32Array([0, sandY, w, sandY, 0, h, w, h])
    const sandCol = new Float32Array([...sandColor, ...sandColor, ...sandBot, ...sandBot])

    gl.bindBuffer(gl.ARRAY_BUFFER, this._bgPositionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, sandPos, gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(this._bgProgram, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this._bgColorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, sandCol, gl.STATIC_DRAW)
    const colLoc = gl.getAttribLocation(this._bgProgram, 'a_color')
    gl.enableVertexAttribArray(colLoc)
    gl.vertexAttribPointer(colLoc, 4, gl.FLOAT, false, 0, 0)

    const resLoc = gl.getUniformLocation(this._bgProgram, 'u_resolution')
    gl.uniform2f(resLoc, w, h)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // 水草条
    const seaweedPositions = [
      { x: w * 0.12, baseY: sandY, width: 6 * dpr, height: 80 * dpr },
      { x: w * 0.18, baseY: sandY, width: 5 * dpr, height: 60 * dpr },
      { x: w * 0.4, baseY: sandY, width: 6 * dpr, height: 90 * dpr },
      { x: w * 0.45, baseY: sandY, width: 5 * dpr, height: 65 * dpr },
      { x: w * 0.7, baseY: sandY, width: 6 * dpr, height: 75 * dpr },
      { x: w * 0.75, baseY: sandY, width: 5 * dpr, height: 55 * dpr },
      { x: w * 0.9, baseY: sandY, width: 5 * dpr, height: 70 * dpr },
    ]

    const grassColor1 = [80 / 255, 160 / 255, 60 / 255, 0.6]   // 明绿
    const grassColor2 = [100 / 255, 180 / 255, 80 / 255, 0.4]  // 浅绿

    seaweedPositions.forEach((s) => {
      const x = s.x
      const y1 = s.baseY - s.height
      const y2 = s.baseY

      const pos = new Float32Array([
        x, y1, x + s.width, y1, x, y2, x + s.width, y2
      ])
      const col = new Float32Array([
        ...grassColor2, ...grassColor2, ...grassColor1, ...grassColor1
      ])

      gl.bindBuffer(gl.ARRAY_BUFFER, this._bgPositionBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(posLoc)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, this._bgColorBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, col, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(colLoc)
      gl.vertexAttribPointer(colLoc, 4, gl.FLOAT, false, 0, 0)

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    })
  }

  _drawUserFish(fish) {
    if (fish.swimMode === 1) {
      this._drawUserFishPulse(fish)
    } else {
      this._drawUserFishWave(fish)
    }
  }

  _drawUserFishWave(fish) {
    const gl = this._gl
    const texture = this._userTextures[fish.textureIndex]
    if (!texture) return

    const dpr = this._dpr
    const facingLeft = fish.vx < 0
    const targetH = (fish.targetH || MIN_TARGET_H) * dpr
    const scale = targetH / fish.imgW
    const hw = fish.imgW * scale / 2
    const hh = fish.imgH * scale / 2

    const headRatio = 0.4
    const tailSlices = 5
    const sliceRatio = (1.0 - headRatio) / tailSlices

    gl.bindTexture(gl.TEXTURE_2D, texture)
    const posLoc = gl.getAttribLocation(this._program, 'a_position')
    const texLoc = gl.getAttribLocation(this._program, 'a_texCoord')
    const matLoc = gl.getUniformLocation(this._program, 'u_matrix')
    const resLoc = gl.getUniformLocation(this._program, 'u_resolution')
    const alphaLoc = gl.getUniformLocation(this._program, 'u_alpha')
    const cx = fish.x * dpr
    const cy = fish.y * dpr

    for (let i = 0; i < 1 + tailSlices; i++) {
      let vStart, vEnd
      if (i === 0) {
        vStart = 0; vEnd = headRatio
      } else {
        const ti = i - 1
        vStart = headRatio + ti * sliceRatio
        vEnd = headRatio + (ti + 1) * sliceRatio
      }

      const yStart = -hh + vStart * (hh * 2)
      const yEnd = -hh + vEnd * (hh * 2)

      let waveAngle = 0
      if (i > 0) {
        waveAngle = Math.sin(fish.tailPhase + i * 0.35) * 10 * (Math.PI / 180) * (i / tailSlices)
      }

      const rotation = -Math.PI / 2 + waveAngle
      const positions = new Float32Array([-hw, yStart, hw, yStart, -hw, yEnd, hw, yEnd])

      let texCoords
      if (facingLeft) {
        texCoords = new Float32Array([0, vStart, 1, vStart, 0, vEnd, 1, vEnd])
      } else {
        texCoords = new Float32Array([0, 1 - vStart, 1, 1 - vStart, 0, 1 - vEnd, 1, 1 - vEnd])
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW)
      gl.enableVertexAttribArray(posLoc)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, this._texCoordBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.DYNAMIC_DRAW)
      gl.enableVertexAttribArray(texLoc)
      gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0)

      gl.uniformMatrix3fv(matLoc, false, this._createTransformMatrix(cx, cy, rotation, 1, 1))
      gl.uniform2f(resLoc, this._canvas.width, this._canvas.height)
      gl.uniform1f(alphaLoc, 1.0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
  }

  _drawUserFishPulse(fish) {
    const gl = this._gl
    const texture = this._userTextures[fish.textureIndex]
    if (!texture) return

    const dpr = this._dpr
    const facingLeft = fish.vx < 0
    const targetH = (fish.targetH || MIN_TARGET_H) * dpr
    const scale = targetH / fish.imgW
    const hw = fish.imgW * scale / 2
    const hh = fish.imgH * scale / 2

    const headRatio = 0.6
    const tailSlices = 6
    const sliceRatio = (1.0 - headRatio) / tailSlices

    gl.bindTexture(gl.TEXTURE_2D, texture)
    const posLoc = gl.getAttribLocation(this._program, 'a_position')
    const texLoc = gl.getAttribLocation(this._program, 'a_texCoord')
    const matLoc = gl.getUniformLocation(this._program, 'u_matrix')
    const resLoc = gl.getUniformLocation(this._program, 'u_resolution')
    const alphaLoc = gl.getUniformLocation(this._program, 'u_alpha')
    const cx = fish.x * dpr
    const cy = fish.y * dpr
    const baseRotation = -Math.PI / 2

    for (let i = 0; i < 1 + tailSlices; i++) {
      let vStart, vEnd
      if (i === 0) {
        vStart = 0; vEnd = headRatio
      } else {
        const ti = i - 1
        vStart = headRatio + ti * sliceRatio
        vEnd = headRatio + (ti + 1) * sliceRatio
      }

      const yStart = -hh + vStart * (hh * 2)
      const yEnd = -hh + vEnd * (hh * 2)

      let scaleX = 1.0
      if (i > 0) {
        const tailProgress = i / tailSlices
        scaleX = 1.0 + Math.sin(fish.tailPhase + i * 0.5) * 0.15 * tailProgress
      }

      const positions = new Float32Array([
        -hw * scaleX, yStart,
         hw * scaleX, yStart,
        -hw * scaleX, yEnd,
         hw * scaleX, yEnd,
      ])

      let texCoords
      if (facingLeft) {
        texCoords = new Float32Array([0, vStart, 1, vStart, 0, vEnd, 1, vEnd])
      } else {
        texCoords = new Float32Array([0, 1 - vStart, 1, 1 - vStart, 0, 1 - vEnd, 1, 1 - vEnd])
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW)
      gl.enableVertexAttribArray(posLoc)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, this._texCoordBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.DYNAMIC_DRAW)
      gl.enableVertexAttribArray(texLoc)
      gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0)

      gl.uniformMatrix3fv(matLoc, false, this._createTransformMatrix(cx, cy, baseRotation, 1, 1))
      gl.uniform2f(resLoc, this._canvas.width, this._canvas.height)
      gl.uniform1f(alphaLoc, 1.0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
  }

  _createTransformMatrix(tx, ty, rotation, sx, sy) {
    const c = Math.cos(rotation)
    const s = Math.sin(rotation)
    return new Float32Array([
      sx * c, sx * s, 0,
      -sy * s, sy * c, 0,
      tx, ty, 1
    ])
  }
}

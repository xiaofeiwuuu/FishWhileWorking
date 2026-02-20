<template>
  <view class="container">
    <!-- 控制面板 -->
    <view class="control-panel">
      <view class="title">方案3: WebGL Canvas (GPU渲染)</view>
      <view class="stats">
        <text>鱼数量: {{ fishCount }}</text>
        <text>尾部切片: {{ tailSlices }}</text>
        <text>FPS: {{ fps }}</text>
      </view>
      <view class="controls">
        <button @tap="changeFishCount(-1)" size="mini">鱼-1</button>
        <button @tap="changeFishCount(1)" size="mini">鱼+1</button>
        <button @tap="changeSlices(-1)" size="mini">切片-1</button>
        <button @tap="changeSlices(1)" size="mini">切片+1</button>
        <button @tap="toggleAnimation" size="mini">
          {{ isAnimating ? '暂停' : '播放' }}
        </button>
      </view>
    </view>

    <!-- WebGL Canvas -->
    <canvas
      id="webglCanvas"
      type="webgl"
      class="webgl-canvas"
      @touchstart="onTouchStart"
    ></canvas>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// 配置
const fishCount = ref(5)
const tailSlices = ref(5)
const isAnimating = ref(true)
const fps = ref(0)

// Canvas 相关
let canvas: any = null
let gl: any = null
let canvasWidth = 375
let canvasHeight = 667

// 鱼数据
interface Fish {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  imageIndex: number
  angle: number
  tailPhase: number
}

const fishes = ref<Fish[]>([])

// 图片纹理
let textures: WebGLTexture[] = []
const fishImages = ['/static/1.jpg', '/static/2.jpg']

// WebGL 程序
let program: WebGLProgram | null = null
let positionBuffer: WebGLBuffer | null = null
let texCoordBuffer: WebGLBuffer | null = null

// 顶点着色器
const vertexShaderSource = `
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
const fragmentShaderSource = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform float u_alpha;

  varying vec2 v_texCoord;

  void main() {
    vec4 texColor = texture2D(u_texture, v_texCoord);
    gl_FragColor = vec4(texColor.rgb, texColor.a * u_alpha);
  }
`

// 初始化 WebGL
const initWebGL = async () => {
  const query = uni.createSelectorQuery()
  query.select('#webglCanvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      if (!res[0]) {
        console.error('Canvas 节点获取失败')
        return
      }

      canvas = res[0].node
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: true
      })

      if (!gl) {
        console.error('WebGL 初始化失败')
        return
      }

      // 获取设备像素比
      const dpr = uni.getSystemInfoSync().pixelRatio || 1
      canvasWidth = res[0].width
      canvasHeight = res[0].height
      canvas.width = canvasWidth * dpr
      canvas.height = canvasHeight * dpr

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0.12, 0.23, 0.37, 1.0) // 海洋背景色
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

      // 创建着色器程序
      createShaderProgram()

      // 加载纹理
      loadTextures()

      // 初始化鱼群
      initFishes()

      // 开始渲染循环
      startRenderLoop()
    })
}

// 创建着色器程序
const createShaderProgram = () => {
  const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource)

  if (!vertexShader || !fragmentShader) return

  program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('程序链接失败:', gl.getProgramInfoLog(program))
    return
  }

  gl.useProgram(program)

  // 创建缓冲区
  positionBuffer = gl.createBuffer()
  texCoordBuffer = gl.createBuffer()
}

// 创建着色器
const createShader = (type: number, source: string) => {
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

// 加载纹理
const loadTextures = () => {
  fishImages.forEach((imgPath, index) => {
    const texture = gl.createTexture()
    const img = canvas.createImage()

    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }

    img.onerror = (e: any) => {
      console.error('图片加载失败:', imgPath, e)
    }

    img.src = imgPath
    textures[index] = texture
  })
}

// 初始化鱼群
const initFishes = () => {
  fishes.value = []
  for (let i = 0; i < fishCount.value; i++) {
    fishes.value.push({
      x: Math.random() * canvasWidth,
      y: 100 + Math.random() * (canvasHeight - 200),
      vx: 1 + Math.random() * 2,
      vy: (Math.random() - 0.5) * 0.5,
      size: 60 + Math.random() * 40,
      imageIndex: Math.floor(Math.random() * fishImages.length),
      angle: 0,
      tailPhase: Math.random() * Math.PI * 2
    })
  }
}

// 渲染循环
let animationFrameId = 0
let lastFrameTime = 0
let frameCount = 0

const startRenderLoop = () => {
  const render = (timestamp: number) => {
    if (!isAnimating.value) {
      animationFrameId = canvas.requestAnimationFrame(render)
      return
    }

    // 计算 FPS
    frameCount++
    if (timestamp - lastFrameTime >= 1000) {
      fps.value = Math.round(frameCount * 1000 / (timestamp - lastFrameTime))
      frameCount = 0
      lastFrameTime = timestamp
    }

    // 清屏
    gl.clear(gl.COLOR_BUFFER_BIT)

    // 更新和绘制每条鱼
    fishes.value.forEach((fish) => {
      updateFish(fish)
      drawFish(fish, timestamp)
    })

    animationFrameId = canvas.requestAnimationFrame(render)
  }

  animationFrameId = canvas.requestAnimationFrame(render)
}

// 更新鱼的位置
const updateFish = (fish: Fish) => {
  fish.x += fish.vx
  fish.y += fish.vy

  // 边界检测
  if (fish.x > canvasWidth + fish.size) {
    fish.x = -fish.size
    fish.y = 100 + Math.random() * (canvasHeight - 200)
  }

  // 尾巴摆动相位
  fish.tailPhase += 0.1
}

// 绘制鱼
const drawFish = (fish: Fish, timestamp: number) => {
  if (!program || textures.length === 0) return

  const texture = textures[fish.imageIndex]
  if (!texture) return

  gl.bindTexture(gl.TEXTURE_2D, texture)

  // 绘制鱼身体（前70%）
  drawFishBody(fish)

  // 绘制鱼尾巴切片（后30%）
  for (let i = 0; i < tailSlices.value; i++) {
    drawTailSlice(fish, i, timestamp)
  }
}

// 绘制鱼身体
const drawFishBody = (fish: Fish) => {
  const bodyWidth = fish.size * 0.7
  const bodyHeight = fish.size * 0.5

  // 设置顶点位置
  const positions = new Float32Array([
    0, 0,
    bodyWidth, 0,
    0, bodyHeight,
    bodyWidth, bodyHeight
  ])

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

  const positionLocation = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

  // 设置纹理坐标（只取前70%）
  const texCoords = new Float32Array([
    0, 0,
    0.7, 0,
    0, 1,
    0.7, 1
  ])

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)

  const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord')
  gl.enableVertexAttribArray(texCoordLocation)
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)

  // 设置变换矩阵
  const matrix = createTransformMatrix(fish.x, fish.y, 0, 1, 1)
  const matrixLocation = gl.getUniformLocation(program, 'u_matrix')
  gl.uniformMatrix3fv(matrixLocation, false, matrix)

  // 设置分辨率
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
  gl.uniform2f(resolutionLocation, canvas.width, canvas.height)

  // 设置透明度
  const alphaLocation = gl.getUniformLocation(program, 'u_alpha')
  gl.uniform1f(alphaLocation, 1.0)

  // 绘制
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

// 绘制尾巴切片
const drawTailSlice = (fish: Fish, sliceIndex: number, timestamp: number) => {
  const bodyWidth = fish.size * 0.7
  const tailWidth = fish.size * 0.3
  const sliceWidth = tailWidth / tailSlices.value
  const bodyHeight = fish.size * 0.5

  // 计算摆动角度
  const waveAngle = Math.sin(fish.tailPhase + sliceIndex * 0.3) * 15 * (Math.PI / 180)

  // 切片位置
  const sliceX = bodyWidth + sliceIndex * sliceWidth
  const offsetX = fish.x + sliceX
  const offsetY = fish.y

  // 设置顶点位置
  const positions = new Float32Array([
    0, 0,
    sliceWidth, 0,
    0, bodyHeight,
    sliceWidth, bodyHeight
  ])

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

  const positionLocation = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

  // 设置纹理坐标（对应尾部区域）
  const texStartX = 0.7 + (sliceIndex / tailSlices.value) * 0.3
  const texEndX = 0.7 + ((sliceIndex + 1) / tailSlices.value) * 0.3

  const texCoords = new Float32Array([
    texStartX, 0,
    texEndX, 0,
    texStartX, 1,
    texEndX, 1
  ])

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)

  const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord')
  gl.enableVertexAttribArray(texCoordLocation)
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)

  // 设置变换矩阵（包含旋转）
  const matrix = createTransformMatrix(offsetX, offsetY, waveAngle, 1, 1)
  const matrixLocation = gl.getUniformLocation(program, 'u_matrix')
  gl.uniformMatrix3fv(matrixLocation, false, matrix)

  // 设置分辨率
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
  gl.uniform2f(resolutionLocation, canvas.width, canvas.height)

  // 设置透明度
  const alphaLocation = gl.getUniformLocation(program, 'u_alpha')
  gl.uniform1f(alphaLocation, 1.0)

  // 绘制
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

// 创建变换矩阵
const createTransformMatrix = (
  tx: number,
  ty: number,
  rotation: number,
  sx: number,
  sy: number
): Float32Array => {
  const c = Math.cos(rotation)
  const s = Math.sin(rotation)

  return new Float32Array([
    sx * c, sx * s, 0,
    -sy * s, sy * c, 0,
    tx, ty, 1
  ])
}

// 改变鱼数量
const changeFishCount = (delta: number) => {
  const newCount = Math.max(1, Math.min(50, fishCount.value + delta))
  fishCount.value = newCount
  initFishes()
}

// 改变切片数量
const changeSlices = (delta: number) => {
  tailSlices.value = Math.max(2, Math.min(20, tailSlices.value + delta))
}

// 切换动画
const toggleAnimation = () => {
  isAnimating.value = !isAnimating.value
}

// 触摸事件
const onTouchStart = (e: any) => {
  // 可以添加交互逻辑
  console.log('触摸位置:', e.touches[0])
}

onMounted(() => {
  initWebGL()
})

onUnmounted(() => {
  if (canvas && animationFrameId) {
    canvas.cancelAnimationFrame(animationFrameId)
  }
})
</script>

<style scoped lang="scss">
.container {
  width: 100%;
  height: 100vh;
  background: #1e3a5f;
  overflow: hidden;
}

.control-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  padding: 20rpx;
  z-index: 100;

  .title {
    color: #fff;
    font-size: 28rpx;
    font-weight: bold;
    margin-bottom: 10rpx;
  }

  .stats {
    display: flex;
    justify-content: space-around;
    margin-bottom: 10rpx;

    text {
      color: #2196F3;
      font-size: 24rpx;
    }
  }

  .controls {
    display: flex;
    justify-content: space-around;
    flex-wrap: wrap;
    gap: 10rpx;

    button {
      flex: 0 0 auto;
    }
  }
}

.webgl-canvas {
  position: absolute;
  top: 150rpx;
  left: 0;
  width: 100%;
  height: calc(100vh - 150rpx);
}
</style>

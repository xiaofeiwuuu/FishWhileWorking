<template>
  <view class="draw-page">
    <!-- 方向提示条 -->
    <view class="direction-tip">
      <text class="tip-icon">⚠️</text>
      <text class="tip-text">请让鱼头朝上画！方向不对可能审核不通过哦</text>
    </view>

    <!-- Canvas 画板区域 -->
    <view class="canvas-wrapper">
      <DrawCanvas
        ref="drawCanvas"
        :current-tool="currentTool"
        :current-color="currentColor"
        :current-size="currentSize"
      />
    </view>

    <!-- 底部工具栏 -->
    <view class="toolbar">
      <!-- 工具行 -->
      <view class="tool-row">
        <view
          class="tool-btn"
          :class="{ active: currentTool === 'pen' }"
          @tap="currentTool = 'pen'"
        >
          <text class="tool-icon">✏️</text>
          <text class="tool-label">画笔</text>
        </view>
        <view
          class="tool-btn"
          :class="{ active: currentTool === 'fill' }"
          @tap="currentTool = 'fill'"
        >
          <text class="tool-icon">🪣</text>
          <text class="tool-label">填充</text>
        </view>
        <view
          class="tool-btn"
          :class="{ active: currentTool === 'eraser' }"
          @tap="currentTool = 'eraser'"
        >
          <text class="tool-icon">🧹</text>
          <text class="tool-label">橡皮</text>
        </view>
        <view class="tool-btn" @tap="undo">
          <text class="tool-icon">↩️</text>
          <text class="tool-label">撤销</text>
        </view>
        <view class="tool-btn" @tap="clearCanvas">
          <text class="tool-icon">🗑️</text>
          <text class="tool-label">清空</text>
        </view>
      </view>

      <!-- 颜色 + 画笔大小 -->
      <view class="option-row">
        <scroll-view class="color-scroll" scroll-x enable-flex>
          <view class="color-list">
            <view
              v-for="c in colors"
              :key="c"
              class="color-dot"
              :class="{ selected: currentColor === c }"
              :style="{ background: c, borderColor: c === '#FFFFFF' ? '#ddd' : c }"
              @tap="selectColor(c)"
            />
          </view>
        </scroll-view>
        <view class="size-group">
          <view
            v-for="s in sizes"
            :key="s.label"
            class="size-btn"
            :class="{ active: currentSize === s.value }"
            @tap="currentSize = s.value"
          >
            <text class="size-label">{{ s.label }}</text>
          </view>
        </view>
      </view>

      <!-- 保存按钮 -->
      <view class="save-row">
        <view class="save-btn" :class="{ disabled: isSaving }" @tap="saveFish">
          <text class="save-text">{{ isSaving ? '保存中...' : '💾 保存我的鱼' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { userStore } from '@/store/user'
import { callFunction } from '@/utils/cloud'
import DrawCanvas from './components/DrawCanvas.vue'

export default {
  components: { DrawCanvas },
  data() {
    return {
      currentTool: 'pen',
      currentColor: '#FD5900',
      currentSize: 6,
      isSaving: false,
      colors: [
        '#FD5900', '#FF3B30', '#FF9500', '#FFCC00',
        '#34C759', '#00C7BE', '#007AFF', '#5856D6',
        '#FF2D55', '#333333', '#999999', '#FFFFFF',
      ],
      sizes: [
        { label: 'S', value: 3 },
        { label: 'M', value: 6 },
        { label: 'L', value: 14 },
      ],
    }
  },

  onReady() {
    this.$refs.drawCanvas.init().catch((e) => {
      console.error('[draw-fish] 画板初始化失败', e)
    })
  },

  methods: {
    selectColor(c) {
      this.currentColor = c
      if (this.currentTool !== 'fill') {
        this.currentTool = 'pen'
      }
    },

    undo() {
      const painter = this.$refs.drawCanvas.getPainter()
      if (!painter || painter.getStrokeCount() === 0) {
        uni.showToast({ title: '没有可撤销的操作', icon: 'none' })
        return
      }
      painter.undo()
    },

    clearCanvas() {
      const painter = this.$refs.drawCanvas.getPainter()
      if (!painter || painter.getStrokeCount() === 0) return
      uni.showModal({
        title: '确认清空',
        content: '清空后将无法恢复，确定吗？',
        success: (res) => {
          if (res.confirm) {
            painter.clearAll()
          }
        },
      })
    },

    async saveFish() {
      if (this.isSaving) return
      if (!userStore.isLogged) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const painter = this.$refs.drawCanvas.getPainter()
      if (!painter || painter.getStrokeCount() === 0) {
        uni.showToast({ title: '画布是空的，先画点什么吧', icon: 'none' })
        return
      }

      this.isSaving = true
      uni.showLoading({ title: '保存中...' })

      try {
        const tempFilePath = await this.canvasToTempFile(painter)
        const fileID = await this.uploadToCloud(tempFilePath)
        await callFunction('saveFish', { fileID })

        uni.hideLoading()
        uni.showToast({ title: '保存成功！', icon: 'success' })

        setTimeout(() => {
          uni.navigateBack()
        }, 1500)
      } catch (err) {
        console.error('[draw-fish] 保存失败', err)
        uni.hideLoading()
        uni.showToast({ title: '保存失败，请重试', icon: 'none' })
      } finally {
        this.isSaving = false
      }
    },

    canvasToTempFile(painter) {
      return new Promise((resolve, reject) => {
        // #ifdef MP-WEIXIN
        const bounds = painter.getContentBounds()
        if (!bounds) {
          return reject(new Error('画布是空的'))
        }

        const dpr = painter._dpr
        const cropX = bounds.x / dpr
        const cropY = bounds.y / dpr
        const cropW = bounds.width / dpr
        const cropH = bounds.height / dpr

        const maxSize = 256
        const scale = Math.min(maxSize / bounds.width, maxSize / bounds.height, 1)
        const destW = Math.round(bounds.width * scale)
        const destH = Math.round(bounds.height * scale)

        wx.canvasToTempFilePath({
          canvas: painter.getCanvasNode(),
          x: cropX,
          y: cropY,
          width: cropW,
          height: cropH,
          destWidth: destW,
          destHeight: destH,
          fileType: 'png',
          quality: 1,
          success: (res) => resolve(res.tempFilePath),
          fail: (err) => {
            console.error('[draw-fish] 导出图片失败', err)
            reject(err)
          },
        })
        // #endif
        // #ifndef MP-WEIXIN
        reject(new Error('仅支持微信小程序'))
        // #endif
      })
    },

    uploadToCloud(filePath) {
      return new Promise((resolve, reject) => {
        // #ifdef MP-WEIXIN
        const cloudPath = `fishes/${userStore.openid}_${Date.now()}.png`
        wx.cloud.uploadFile({
          cloudPath,
          filePath,
          success: (res) => resolve(res.fileID),
          fail: (err) => {
            console.error('[draw-fish] 上传失败', err)
            reject(err)
          },
        })
        // #endif
        // #ifndef MP-WEIXIN
        reject(new Error('仅支持微信小程序'))
        // #endif
      })
    },
  },
}
</script>

<style scoped>
.draw-page {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #FFF6EB;
  box-sizing: border-box;
}

/* 方向提示条 */
.direction-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin: 12rpx 24rpx 0;
  padding: 12rpx 20rpx;
  background: #FFF3E0;
  border-radius: 16rpx;
  border: 2rpx solid #FFB74D;
}

.tip-icon {
  font-size: 28rpx;
  flex-shrink: 0;
}

.tip-text {
  font-size: 24rpx;
  color: #E65100;
  font-weight: 600;
}

/* Canvas 容器 */
.canvas-wrapper {
  flex: 1;
  margin: 16rpx 24rpx 0;
  border-radius: 24rpx;
  overflow: hidden;
  background: #FFFFFF;
  box-shadow: 0 4rpx 24rpx rgba(253, 89, 0, 0.08);
}

/* 底部工具栏 */
.toolbar {
  background: #FFFFFF;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #f0f0f0;
}

/* 工具行 */
.tool-row {
  display: flex;
  justify-content: space-around;
  margin-bottom: 16rpx;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 24rpx;
  border-radius: 16rpx;
  background: #f8f8f8;
  min-width: 100rpx;
}

.tool-btn.active {
  background: #FFF6EB;
  box-shadow: 0 0 0 2rpx #FD5900;
}

.tool-icon {
  font-size: 36rpx;
  margin-bottom: 4rpx;
}

.tool-label {
  font-size: 20rpx;
  color: #666;
}

.tool-btn.active .tool-label {
  color: #FD5900;
  font-weight: 600;
}

/* 颜色 + 大小行 */
.option-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
  gap: 16rpx;
}

.color-scroll {
  flex: 1;
  white-space: nowrap;
}

.color-list {
  display: flex;
  gap: 12rpx;
  padding: 8rpx 0;
}

.color-dot {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  border: 4rpx solid transparent;
  flex-shrink: 0;
  transition: transform 0.15s;
}

.color-dot.selected {
  transform: scale(1.2);
  border-width: 4rpx;
  box-shadow: 0 0 0 4rpx rgba(253, 89, 0, 0.2);
}

.size-group {
  display: flex;
  gap: 8rpx;
  flex-shrink: 0;
}

.size-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 12rpx;
  background: #f8f8f8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.size-btn.active {
  background: #FD5900;
}

.size-label {
  font-size: 22rpx;
  color: #666;
  font-weight: 600;
}

.size-btn.active .size-label {
  color: #FFFFFF;
}

/* 保存按钮 */
.save-row {
  padding: 0 16rpx;
}

.save-btn {
  width: 100%;
  height: 80rpx;
  background: linear-gradient(135deg, #FFDE00, #FD5900);
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 16rpx rgba(253, 89, 0, 0.3);
}

.save-btn.disabled {
  opacity: 0.6;
}

.save-text {
  font-size: 30rpx;
  color: #FFFFFF;
  font-weight: 600;
}
</style>

<template>
  <view class="fish-tank-page" @tap="onPageTap">
    <!-- 半透明标题栏 -->
    <view class="title-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <text class="title-text">公共鱼缸</text>
      <text class="fish-count">{{ fishCount }}条鱼在游</text>
    </view>

    <!-- WebGL Canvas 全屏 -->
    <FishTankCanvas ref="tankCanvas" @fish-tap="onFishTap" />

    <!-- 点赞气泡 -->
    <view v-if="bubbleFish" class="like-bubble" :style="bubbleStyle" @tap.stop>
      <view class="bubble-content">
        <text class="bubble-likes">❤️ {{ bubbleFish.likes }}</text>
        <view
          class="bubble-btn"
          :class="{ liked: isFishLiked(bubbleFish.fishId) }"
          @tap.stop="toggleLike"
        >
          <text class="bubble-btn-text">{{ isFishLiked(bubbleFish.fishId) ? '💔 取消' : '❤️ 点赞' }}</text>
        </view>
      </view>
    </view>

    <!-- 画鱼入口 -->
    <view class="draw-fish-btn" @tap="goToDrawFish">
      <text class="draw-fish-icon">🎨</text>
    </view>

    <CustomTabBar :current="1" />
  </view>
</template>

<script>
import CustomTabBar from '@/components/CustomTabBar.vue'
import FishTankCanvas from './components/FishTankCanvas.vue'
import { callFunction } from '@/utils/cloud'

export default {
  components: { CustomTabBar, FishTankCanvas },
  data() {
    return {
      fishCount: 0,
      statusBarHeight: 0,
      bubbleFish: null,
      myLikedFishIds: [],
    }
  },
  computed: {
    bubbleStyle() {
      if (!this.bubbleFish) return {}
      // 气泡定位在点击位置上方
      const x = this.bubbleFish.x
      const y = this.bubbleFish.y
      return {
        left: x + 'px',
        top: (y - 80) + 'px',
        transform: 'translateX(-50%)',
      }
    },
  },
  onLoad() {
    const sysInfo = uni.getSystemInfoSync()
    this.statusBarHeight = sysInfo.statusBarHeight || 0
    this._loadedFishFileIDs = new Set()
    this._canvasReady = false
    this._bubbleTimer = null
  },
  onReady() {
    this.$refs.tankCanvas.init().then(() => {
      this._canvasReady = true
      this.$refs.tankCanvas.startRenderLoop()
      this.loadUserFishes()
      this.loadMyLikes()
    }).catch((e) => {
      console.error('鱼缸初始化失败:', e)
    })
  },
  onShow() {
    if (this._canvasReady) {
      this.$refs.tankCanvas.startRenderLoop()
      this.loadUserFishes()
      this.loadMyLikes()
    }
  },
  onHide() {
    if (this._canvasReady) {
      this.$refs.tankCanvas.stopRenderLoop()
    }
    this.closeBubble()
  },
  onUnload() {
    if (this._canvasReady) {
      this.$refs.tankCanvas.destroy()
    }
    this.closeBubble()
  },
  methods: {
    goToDrawFish() {
      uni.navigateTo({ url: '/pages/draw-fish/index' })
    },

    isFishLiked(fishId) {
      return this.myLikedFishIds.indexOf(fishId) !== -1
    },

    onFishTap({ fishId, likes, x, y }) {
      if (!fishId) return
      this.closeBubble()
      this.bubbleFish = { fishId, likes, x, y }

      // 暂停这条鱼的移动
      const renderer = this.$refs.tankCanvas.getRenderer()
      if (renderer) {
        renderer.pauseFish(fishId)
      }

      // 防止本次 touchstart 冒泡产生的 tap 立刻关闭气泡
      this._justOpened = true
      setTimeout(() => { this._justOpened = false }, 300)

      this.resetBubbleTimer()
    },

    resetBubbleTimer() {
      if (this._bubbleTimer) {
        clearTimeout(this._bubbleTimer)
      }
      this._bubbleTimer = setTimeout(() => {
        this.closeBubble()
      }, 2000)
    },

    onPageTap() {
      if (this._justOpened) return
      if (this.bubbleFish) {
        this.closeBubble()
      }
    },

    closeBubble() {
      if (this.bubbleFish) {
        const renderer = this.$refs.tankCanvas.getRenderer()
        if (renderer) {
          renderer.resumeFish(this.bubbleFish.fishId)
        }
      }

      this.bubbleFish = null
      if (this._bubbleTimer) {
        clearTimeout(this._bubbleTimer)
        this._bubbleTimer = null
      }
    },

    async toggleLike() {
      if (!this.bubbleFish) return
      const { fishId } = this.bubbleFish
      const isLiked = this.isFishLiked(fishId)
      const action = isLiked ? 'unlike' : 'like'

      try {
        const res = await callFunction('saveFish', { action, fishId })
        if (res.code === 0) {
          // 更新本地已赞列表
          if (isLiked) {
            this.myLikedFishIds = this.myLikedFishIds.filter(id => id !== fishId)
          } else {
            this.myLikedFishIds = [...this.myLikedFishIds, fishId]
          }

          // 更新气泡中的赞数
          const newLikes = res.data && res.data.likes != null ? res.data.likes : (this.bubbleFish.likes + (isLiked ? -1 : 1))
          this.bubbleFish = { ...this.bubbleFish, likes: Math.max(newLikes, 0) }

          // 更新 renderer 中鱼的 likes（即时生效大小变化）
          const renderer = this.$refs.tankCanvas.getRenderer()
          if (renderer) {
            renderer.updateFishLikes(fishId, this.bubbleFish.likes)
          }

          // 操作后重置 2 秒计时器
          this.resetBubbleTimer()
        }
      } catch (e) {
        console.warn('点赞操作失败:', e)
      }
    },

    async loadMyLikes() {
      try {
        const res = await callFunction('saveFish', { action: 'listMyLikes' })
        if (res.code === 0 && Array.isArray(res.data)) {
          this.myLikedFishIds = res.data
        }
      } catch (e) {
        console.warn('获取已赞列表失败:', e)
      }
    },

    async loadUserFishes() {
      const renderer = this.$refs.tankCanvas.getRenderer()
      if (!renderer) return

      try {
        const res = await callFunction('saveFish', { action: 'list' })
        if (res.code !== 0 || !res.data || res.data.length === 0) return

        const fishList = res.data.slice(0, 10)
        for (const fishData of fishList) {
          if (this._loadedFishFileIDs.has(fishData.fileID)) continue
          try {
            await this.loadUserFishTexture(fishData, renderer)
          } catch (e) {
            console.warn('加载用户鱼失败:', fishData.fileID, e)
          }
        }
      } catch (e) {
        console.warn('获取用户鱼列表失败:', e)
      }
    },

    loadUserFishTexture(fishData, renderer) {
      return new Promise((resolve, reject) => {
        const canvas = this.$refs.tankCanvas._canvas
        if (!canvas) return reject('Canvas 未初始化')

        // #ifdef MP-WEIXIN
        wx.cloud.getTempFileURL({
          fileList: [fishData.fileID],
          success: (urlRes) => {
            const fileItem = urlRes.fileList && urlRes.fileList[0]
            if (!fileItem || fileItem.status !== 0 || !fileItem.tempFileURL) {
              return reject('获取临时 URL 失败')
            }

            wx.getImageInfo({
              src: fileItem.tempFileURL,
              success: (imgInfo) => {
                const image = canvas.createImage()
                image.onload = () => {
                  try {
                    const textureIndex = renderer.loadUserTexture(image, imgInfo.width, imgInfo.height)
                    this._loadedFishFileIDs.add(fishData.fileID)

                    renderer.addFish({
                      textureIndex,
                      imgW: imgInfo.width,
                      imgH: imgInfo.height,
                      swimMode: 1,
                      fishId: fishData._id,
                      likes: fishData.likes || 0,
                    })
                    this.fishCount = renderer.getFishCount()

                    resolve()
                  } catch (e) {
                    reject(e)
                  }
                }
                image.onerror = (e) => reject(e)
                image.src = imgInfo.path
              },
              fail: (e) => reject(e)
            })
          },
          fail: (e) => reject(e)
        })
        // #endif

        // #ifndef MP-WEIXIN
        reject('仅支持微信小程序')
        // #endif
      })
    },
  }
}
</script>

<style scoped>
.fish-tank-page {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #FFF6EB;
}

.title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 32rpx;
  padding-right: 32rpx;
  padding-bottom: 16rpx;
  background: rgba(255, 246, 235, 0.6);
  z-index: 100;
}

.title-text {
  font-size: 34rpx;
  font-weight: bold;
  color: rgba(120, 80, 20, 0.9);
}

.fish-count {
  font-size: 24rpx;
  color: rgba(120, 80, 20, 0.5);
}

/* 点赞气泡 */
.like-bubble {
  position: absolute;
  z-index: 200;
  pointer-events: auto;
}

.bubble-content {
  background: rgba(0, 0, 0, 0.75);
  border-radius: 24rpx;
  padding: 16rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  white-space: nowrap;
}

.bubble-likes {
  font-size: 28rpx;
  color: #fff;
}

.bubble-btn {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 16rpx;
  padding: 8rpx 20rpx;
}

.bubble-btn.liked {
  background: rgba(255, 80, 80, 0.3);
}

.bubble-btn-text {
  font-size: 24rpx;
  color: #fff;
}

/* 画鱼浮动按钮 */
.draw-fish-btn {
  position: fixed;
  right: 32rpx;
  bottom: calc(200rpx + env(safe-area-inset-bottom));
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #FFDE00, #FD5900);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 20rpx rgba(253, 89, 0, 0.4);
  z-index: 100;
}

.draw-fish-icon {
  font-size: 44rpx;
}
</style>

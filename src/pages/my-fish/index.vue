<template>
  <view class="page-container">
    <!-- 顶部标题 -->
    <view class="header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-back" @tap="goBack">
        <text class="back-arrow">‹</text>
      </view>
      <text class="header-title">我的鱼</text>
      <view class="header-right">
        <text class="fish-total">共 {{ fishList.length }} 条</text>
      </view>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <view v-else-if="fishList.length === 0" class="empty-wrap">
      <text class="empty-icon">🐟</text>
      <text class="empty-text">还没有画过鱼</text>
      <view class="empty-btn" @tap="goToDrawFish">
        <text class="empty-btn-text">🎨 去画一条</text>
      </view>
    </view>

    <!-- 鱼列表 -->
    <scroll-view v-else class="fish-list" scroll-y>
      <view class="fish-grid">
        <view
          v-for="fish in fishList"
          :key="fish._id"
          class="fish-card"
          @tap="previewFish(fish)"
        >
          <image
            class="fish-img"
            :src="fish.tempUrl || ''"
            mode="aspectFit"
          />
          <view class="fish-info">
            <view class="fish-likes">
              <text class="likes-icon">❤️</text>
              <text class="likes-num">{{ fish.likes || 0 }}</text>
            </view>
            <text class="fish-date">{{ formatDate(fish.createdAt) }}</text>
          </view>
          <view class="fish-delete" @tap.stop="deleteFish(fish)">
            <text class="delete-icon">✕</text>
          </view>
        </view>
      </view>

      <!-- 画鱼入口 -->
      <view class="add-card" @tap="goToDrawFish">
        <text class="add-icon">+</text>
        <text class="add-text">画一条新鱼</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { userStore } from '@/store/user'
import { callFunction } from '@/utils/cloud'

export default {
  data() {
    return {
      fishList: [],
      loading: true,
      statusBarHeight: 0,
    }
  },
  onLoad() {
    const sysInfo = uni.getSystemInfoSync()
    this.statusBarHeight = sysInfo.statusBarHeight || 0
  },
  onShow() {
    this.loadMyFishes()
  },
  methods: {
    goBack() {
      uni.navigateBack()
    },

    goToDrawFish() {
      uni.navigateTo({ url: '/pages/draw-fish/index' })
    },

    formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      const m = d.getMonth() + 1
      const day = d.getDate()
      return `${m}月${day}日`
    },

    async loadMyFishes() {
      if (!userStore.isLogged) {
        this.loading = false
        return
      }

      this.loading = true
      try {
        const res = await callFunction('saveFish', { action: 'listMine' })
        if (res.code === 0 && Array.isArray(res.data)) {
          // 获取临时 URL
          const fishes = res.data
          // #ifdef MP-WEIXIN
          if (fishes.length > 0) {
            const fileList = fishes.map(f => f.fileID)
            const urlRes = await new Promise((resolve, reject) => {
              wx.cloud.getTempFileURL({
                fileList,
                success: resolve,
                fail: reject,
              })
            })
            const urlMap = {}
            urlRes.fileList.forEach(item => {
              if (item.status === 0) {
                urlMap[item.fileID] = item.tempFileURL
              }
            })
            fishes.forEach(f => {
              f.tempUrl = urlMap[f.fileID] || ''
            })
          }
          // #endif
          this.fishList = fishes
        }
      } catch (e) {
        console.warn('加载我的鱼失败:', e)
      } finally {
        this.loading = false
      }
    },

    previewFish(fish) {
      if (!fish.tempUrl) return
      uni.previewImage({
        urls: [fish.tempUrl],
        current: fish.tempUrl,
      })
    },

    deleteFish(fish) {
      uni.showModal({
        title: '确认删除',
        content: '删除后鱼缸里也会消失，确定吗？',
        success: async (res) => {
          if (!res.confirm) return
          try {
            uni.showLoading({ title: '删除中...' })
            const delRes = await callFunction('saveFish', {
              action: 'delete',
              fishId: fish._id,
            })
            uni.hideLoading()
            if (delRes.code === 0) {
              this.fishList = this.fishList.filter(f => f._id !== fish._id)
              uni.showToast({ title: '已删除', icon: 'success' })
            } else {
              uni.showToast({ title: delRes.message || '删除失败', icon: 'none' })
            }
          } catch (e) {
            uni.hideLoading()
            uni.showToast({ title: '删除失败', icon: 'none' })
          }
        },
      })
    },
  },
}
</script>

<style scoped>
.page-container {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(180deg, #FFF6EB 0%, #FFFFFF 100%);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* 顶部标题栏 */
.header {
  display: flex;
  align-items: center;
  padding-left: 16rpx;
  padding-right: 32rpx;
  padding-bottom: 16rpx;
  background: rgba(255, 246, 235, 0.95);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-back {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-arrow {
  font-size: 48rpx;
  color: #333;
  font-weight: 300;
}

.header-title {
  flex: 1;
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.header-right {
  flex-shrink: 0;
}

.fish-total {
  font-size: 24rpx;
  color: #999;
}

/* 加载中 */
.loading-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-text {
  font-size: 28rpx;
  color: #999;
}

/* 空状态 */
.empty-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-bottom: 200rpx;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 30rpx;
  color: #999;
  margin-bottom: 40rpx;
}

.empty-btn {
  background: linear-gradient(135deg, #FFDE00, #FD5900);
  border-radius: 40rpx;
  padding: 20rpx 60rpx;
}

.empty-btn-text {
  font-size: 30rpx;
  color: #FFF;
  font-weight: 600;
}

/* 鱼列表 */
.fish-list {
  flex: 1;
  padding: 16rpx 24rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

.fish-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

/* 鱼卡片 */
.fish-card {
  width: calc(50% - 10rpx);
  background: #FFF;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(253, 89, 0, 0.06);
  position: relative;
}

.fish-img {
  width: 100%;
  height: 260rpx;
  background: #FFF9F0;
}

.fish-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 20rpx;
}

.fish-likes {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.likes-icon {
  font-size: 24rpx;
}

.likes-num {
  font-size: 24rpx;
  color: #FF5050;
  font-weight: 600;
}

.fish-date {
  font-size: 22rpx;
  color: #bbb;
}

/* 删除按钮 */
.fish-delete {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  width: 48rpx;
  height: 48rpx;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-icon {
  font-size: 24rpx;
  color: #FFF;
}

/* 添加卡片 */
.add-card {
  width: 100%;
  margin-top: 20rpx;
  background: #FFF;
  border-radius: 24rpx;
  padding: 40rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  border: 3rpx dashed #FFD0A0;
}

.add-icon {
  font-size: 56rpx;
  color: #FD5900;
  font-weight: 300;
  line-height: 1;
}

.add-text {
  font-size: 26rpx;
  color: #FD5900;
}
</style>

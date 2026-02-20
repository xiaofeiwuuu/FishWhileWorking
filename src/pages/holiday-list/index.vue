<template>
  <view class="page-container">
    <!-- 顶部标题栏 -->
    <view class="header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-back" @tap="goBack">
        <text class="back-arrow">&#x2039;</text>
      </view>
      <text class="header-title">{{ year }}年节假日</text>
      <view class="header-right">
        <text class="year-switch" @tap="switchYear(-1)">&#x2039;</text>
        <text class="year-switch" @tap="switchYear(1)">&#x203A;</text>
      </view>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <view v-else-if="holidays.length === 0" class="empty-wrap">
      <text class="empty-icon">📅</text>
      <text class="empty-text">暂无节假日数据</text>
    </view>

    <!-- 假期列表 -->
    <scroll-view v-else class="holiday-scroll" scroll-y>
      <view class="holiday-list">
        <view
          v-for="(h, idx) in holidays"
          :key="h.startDate"
          class="holiday-card"
          :class="{ 'is-past': h.isPast, 'is-current': h.isCurrent }"
        >
          <!-- 左侧序号 -->
          <view class="card-index" :class="{ 'index-active': !h.isPast }">
            <text class="index-num">{{ idx + 1 }}</text>
          </view>

          <!-- 中间内容 -->
          <view class="card-body">
            <view class="card-top">
              <text class="card-name">{{ h.name }}</text>
              <view v-if="h.isCurrent" class="current-tag">
                <text class="tag-text">放假中</text>
              </view>
              <view v-else-if="!h.isPast && h.daysLeft !== undefined" class="days-tag">
                <text class="tag-text">{{ h.daysLeft }}天后</text>
              </view>
            </view>
            <view class="card-bottom">
              <text class="card-date">{{ formatRange(h) }}</text>
              <text class="card-duration">共{{ h.totalDays }}天</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 底部说明 -->
      <view class="footer-note">
        <text class="note-text">数据来源：国务院办公厅发布的节假日安排</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { callFunction } from '@/utils/cloud'

export default {
  data() {
    return {
      year: new Date().getFullYear(),
      holidays: [],
      loading: true,
      statusBarHeight: 0,
    }
  },
  onLoad() {
    const sysInfo = uni.getSystemInfoSync()
    this.statusBarHeight = sysInfo.statusBarHeight || 0
    this.loadHolidays()
  },
  methods: {
    goBack() {
      uni.navigateBack()
    },

    switchYear(delta) {
      this.year += delta
      this.loadHolidays()
    },

    async loadHolidays() {
      const year = this.year.toString()
      const cacheKey = `holidays_${year}`

      this.loading = true
      this.holidays = []

      // 先读本地缓存
      try {
        const cached = uni.getStorageSync(cacheKey)
        if (cached && Array.isArray(cached)) {
          this.holidays = this.enrichHolidays(cached)
          this.loading = false
          return
        }
      } catch (e) { /* ignore */ }

      // 请求云函数
      try {
        const res = await callFunction('getHolidays', { year })
        if (res.code === 0 && Array.isArray(res.data)) {
          this.holidays = this.enrichHolidays(res.data)
          try { uni.setStorageSync(cacheKey, res.data) } catch (e) { /* ignore */ }
        }
      } catch (e) {
        console.warn('获取节假日失败:', e)
      } finally {
        this.loading = false
      }
    },

    enrichHolidays(list) {
      const now = new Date()
      const todayStr = this.toDateStr(now)

      return list.map(h => {
        const isPast = h.endDate < todayStr
        const isCurrent = todayStr >= h.startDate && todayStr <= h.endDate
        let daysLeft
        if (!isPast && !isCurrent) {
          const target = new Date(h.startDate + 'T00:00:00')
          daysLeft = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
          if (daysLeft < 0) daysLeft = 0
        }
        return { ...h, isPast, isCurrent, daysLeft }
      })
    },

    toDateStr(date) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    },

    formatRange(h) {
      const s = h.startDate.slice(5).replace('-', '月') + '日'
      const e = h.endDate.slice(5).replace('-', '月') + '日'
      if (h.startDate === h.endDate) return s
      return s + ' ~ ' + e
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
  padding-right: 24rpx;
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
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.year-switch {
  font-size: 44rpx;
  color: #FD5900;
  font-weight: 600;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
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
}

/* 假期列表 */
.holiday-scroll {
  flex: 1;
  padding: 16rpx 24rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

.holiday-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

/* 假期卡片 */
.holiday-card {
  display: flex;
  align-items: stretch;
  background: #FFF;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(253, 89, 0, 0.06);
}

.holiday-card.is-past {
  opacity: 0.5;
}

.holiday-card.is-current {
  border: 2rpx solid #FD5900;
  box-shadow: 0 4rpx 24rpx rgba(253, 89, 0, 0.15);
}

/* 左侧序号 */
.card-index {
  width: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F5F5F5;
}

.card-index.index-active {
  background: linear-gradient(135deg, #FFDE00, #FD5900);
}

.index-num {
  font-size: 28rpx;
  font-weight: bold;
  color: #999;
}

.index-active .index-num {
  color: #FFF;
}

/* 中间内容 */
.card-body {
  flex: 1;
  padding: 20rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.card-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.current-tag {
  background: #FD5900;
  border-radius: 8rpx;
  padding: 2rpx 12rpx;
}

.days-tag {
  background: #FFF2E5;
  border-radius: 8rpx;
  padding: 2rpx 12rpx;
}

.current-tag .tag-text {
  font-size: 20rpx;
  color: #FFF;
  font-weight: 600;
}

.days-tag .tag-text {
  font-size: 20rpx;
  color: #FD5900;
}

.card-bottom {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.card-date {
  font-size: 24rpx;
  color: #666;
}

.card-duration {
  font-size: 24rpx;
  color: #FD5900;
  font-weight: 600;
}

/* 底部说明 */
.footer-note {
  padding: 40rpx 0 20rpx;
  text-align: center;
}

.note-text {
  font-size: 22rpx;
  color: #ccc;
}
</style>

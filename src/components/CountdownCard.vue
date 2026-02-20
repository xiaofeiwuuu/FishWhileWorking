<template>
  <view class="countdown-card">
    <view class="countdown-list">
      <view class="countdown-item">
        <text class="countdown-icon">🏖️</text>
        <view class="countdown-num">
          <text class="countdown-days">{{ daysToRest }}</text>
          <text class="countdown-unit">天</text>
        </view>
        <text class="countdown-text">距休息日</text>
      </view>
      <view class="countdown-item">
        <text class="countdown-icon">💰</text>
        <view class="countdown-num">
          <text class="countdown-days">{{ daysToPayday }}</text>
          <text class="countdown-unit">天</text>
        </view>
        <text class="countdown-text">距发工资</text>
      </view>
      <view
        class="countdown-item"
        :class="{ 'item-holiday': currentHoliday }"
        @tap="goToHolidayList"
      >
        <text class="countdown-icon">🎉</text>
        <template v-if="currentHoliday">
          <text class="countdown-status">放假中</text>
          <text class="countdown-text holiday-text">{{ currentHoliday.name }}</text>
        </template>
        <template v-else>
          <view class="countdown-num">
            <text class="countdown-days">{{ daysToHoliday }}</text>
            <text class="countdown-unit">天</text>
          </view>
          <text class="countdown-text">{{ holidayLabel }}</text>
        </template>
      </view>
    </view>

  </view>
</template>

<script>
import { callFunction } from '@/utils/cloud'

export default {
  name: 'CountdownCard',
  props: {
    restDays: {
      type: Array,
      default: () => [0, 6],
    },
    salaryType: {
      type: String,
      default: 'monthly',
    },
    paydays: {
      type: Array,
      default: () => [15],
    },
  },
  data() {
    return {
      daysToRest: '--',
      daysToPayday: '--',
      daysToHoliday: '--',
      holidayLabel: '距节假日',
      currentHoliday: null,
      holidays: [],
    }
  },
  watch: {
    restDays: { handler() { this.calculate() }, deep: true },
    salaryType() { this.calculate() },
    paydays: { handler() { this.calculate() }, deep: true },
  },
  mounted() {
    this.calculate()
    this.loadHolidays()
  },
  methods: {
    calculate() {
      const now = new Date()
      this.daysToRest = this.calcDaysToRest(now)
      this.daysToPayday = this.calcDaysToPayday(now)
      this.calcHolidayInfo(now)
    },

    async loadHolidays() {
      const year = new Date().getFullYear().toString()
      const cacheKey = `holidays_${year}`

      // 1. 先读本地缓存
      try {
        const cached = uni.getStorageSync(cacheKey)
        if (cached && Array.isArray(cached)) {
          this.holidays = cached
          this.calcHolidayInfo(new Date())
          return
        }
      } catch (e) { /* 缓存读取失败，继续请求 */ }

      // 2. 本地没有，请求云函数
      try {
        const res = await callFunction('getHolidays', { year })
        if (res.code === 0 && Array.isArray(res.data)) {
          this.holidays = res.data
          this.calcHolidayInfo(new Date())
          // 存入本地缓存
          try { uni.setStorageSync(cacheKey, res.data) } catch (e) { /* ignore */ }
        }
      } catch (e) {
        console.warn('获取节假日失败:', e)
      }
    },

    calcDaysToRest(now) {
      if (!this.restDays || this.restDays.length === 0) return '--'
      const todayDay = now.getDay()
      if (this.restDays.includes(todayDay)) return 0
      for (let i = 1; i <= 7; i++) {
        const futureDay = (todayDay + i) % 7
        if (this.restDays.includes(futureDay)) return i
      }
      return '--'
    },

    calcDaysToPayday(now) {
      const type = this.salaryType
      const pays = this.paydays.filter(v => v)

      if (type === 'daily') return 0

      if (type === 'weekly') {
        const payWeekDay = pays[0] || 5
        const todayDay = now.getDay() || 7
        if (todayDay === payWeekDay) return 0
        const diff = payWeekDay - todayDay
        return diff > 0 ? diff : diff + 7
      }

      const today = now.getDate()
      const year = now.getFullYear()
      const month = now.getMonth()

      let minDays = Infinity
      for (const payDay of pays) {
        if (!payDay) continue
        let targetDate
        if (today <= payDay) {
          targetDate = new Date(year, month, payDay)
        } else {
          targetDate = new Date(year, month + 1, payDay)
        }
        const diff = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24))
        if (diff < minDays) minDays = diff
      }
      return minDays === Infinity ? '--' : Math.max(0, minDays)
    },

    calcHolidayInfo(now) {
      const todayStr = this.toDateStr(now)

      // 检查是否在假期中
      this.currentHoliday = null

      if (this.holidays.length === 0) {
        this.daysToHoliday = '--'
        this.holidayLabel = '距节假日'
        return
      }

      // 检查今天是否在某个假期中
      for (const h of this.holidays) {
        if (todayStr >= h.startDate && todayStr <= h.endDate) {
          this.currentHoliday = h
          break
        }
      }

      // 找下一个假期
      if (!this.currentHoliday) {
        let found = false
        for (const h of this.holidays) {
          if (h.startDate > todayStr) {
            if (!found) {
              const target = new Date(h.startDate + 'T00:00:00')
              const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
              this.daysToHoliday = diff <= 0 ? 0 : diff
              this.holidayLabel = '距' + h.name
              found = true
            }
          }
        }
        if (!found) {
          this.daysToHoliday = '--'
          this.holidayLabel = '距节假日'
        }
      }

    },

    toDateStr(date) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    },

    goToHolidayList() {
      uni.navigateTo({ url: '/pages/holiday-list/index' })
    },
  },
}
</script>

<style scoped>
.countdown-card {
  padding: 24rpx 32rpx;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.countdown-list {
  display: flex;
  flex: 1;
  gap: 16rpx;
}

.countdown-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  background: linear-gradient(135deg, #FFF8F0, #FFF2E5);
  border-radius: 16rpx;
  padding: 20rpx 12rpx;
}

.countdown-icon {
  font-size: 36rpx;
}

.countdown-num {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}

.countdown-days {
  font-size: 48rpx;
  font-weight: bold;
  color: #FD5900;
}

.countdown-unit {
  font-size: 22rpx;
  color: #999;
}

.countdown-text {
  font-size: 22rpx;
  color: #666;
}

/* 放假中卡片 */
.item-holiday {
  background: linear-gradient(135deg, #FFDE00, #FD5900) !important;
}

.countdown-status {
  font-size: 36rpx;
  font-weight: bold;
  color: #FFF;
}

.holiday-text {
  color: rgba(255, 255, 255, 0.9) !important;
}

</style>

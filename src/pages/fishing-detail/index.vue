<template>
  <view class="page-container">
    <!-- 月份切换 -->
    <view class="month-nav">
      <view class="month-arrow" @tap="prevMonth">◀</view>
      <text class="month-text">{{ currentMonth }}</text>
      <view class="month-arrow" :class="{ disabled: isCurrentMonth }" @tap="nextMonth">▶</view>
    </view>

    <!-- 月度汇总卡片 -->
    <view class="summary-card">
      <view class="summary-item">
        <text class="summary-num">{{ monthData.totalMinutes || 0 }}</text>
        <text class="summary-label">总分钟</text>
      </view>
      <view class="summary-divider" />
      <view class="summary-item">
        <text class="summary-num">¥{{ monthEarned }}</text>
        <text class="summary-label">摸鱼收入</text>
      </view>
      <view class="summary-divider" />
      <view class="summary-item">
        <text class="summary-num">{{ activeDays }}</text>
        <text class="summary-label">摸鱼天数</text>
      </view>
    </view>

    <!-- 分类统计 -->
    <view class="category-stats" v-if="categoryTotals.length">
      <view
        v-for="item in categoryTotals"
        :key="item.name"
        class="cat-stat-item"
      >
        <text class="cat-emoji">{{ item.emoji }}</text>
        <view class="cat-bar-wrap">
          <view class="cat-bar" :style="{ width: item.percent + '%' }" />
        </view>
        <text class="cat-minutes">{{ item.minutes }}分钟</text>
      </view>
    </view>

    <!-- 日历视图 -->
    <view class="calendar-card">
      <view class="section-title">每日记录</view>
      <view v-if="loading" class="empty-tip">
        <text>加载中...</text>
      </view>
      <template v-else>
        <!-- 星期标题行 -->
        <view class="calendar-weekdays">
          <text v-for="w in ['日','一','二','三','四','五','六']" :key="w" class="weekday-cell">{{ w }}</text>
        </view>
        <!-- 日期网格 -->
        <view class="calendar-grid">
          <view
            v-for="(cell, idx) in calendarDays"
            :key="idx"
            class="calendar-cell"
            :class="{
              'cell-empty': !cell.day,
              'cell-today': cell.isToday,
              'cell-has-record': cell.hasRecord,
              'cell-selected': cell.day && String(cell.day) === selectedDay,
            }"
            @tap="cell.day && cell.hasRecord && onDayTap(String(cell.day))"
          >
            <text v-if="cell.day" class="cell-num">{{ cell.day }}</text>
            <text v-if="cell.hasRecord" class="cell-minutes">{{ cell.data.total }}′</text>
          </view>
        </view>
        <!-- 点击展开的详情面板 -->
        <view v-if="selectedDayDetail" class="day-detail-panel">
          <view class="detail-header">
            <text class="detail-date">{{ selectedDay }}日</text>
            <text class="detail-weekday">{{ selectedDayDetail.weekday }}</text>
          </view>
          <view class="detail-cats">
            <view v-if="selectedDayDetail.cats[0]" class="detail-cat-item">
              <text class="detail-cat-emoji">🚽</text>
              <text class="detail-cat-val">{{ selectedDayDetail.cats[0] }}分钟</text>
            </view>
            <view v-if="selectedDayDetail.cats[1]" class="detail-cat-item">
              <text class="detail-cat-emoji">📺</text>
              <text class="detail-cat-val">{{ selectedDayDetail.cats[1] }}分钟</text>
            </view>
            <view v-if="selectedDayDetail.cats[2]" class="detail-cat-item">
              <text class="detail-cat-emoji">📚</text>
              <text class="detail-cat-val">{{ selectedDayDetail.cats[2] }}分钟</text>
            </view>
          </view>
          <view class="detail-footer">
            <text class="detail-total">合计 {{ selectedDayDetail.total }}分钟</text>
            <text class="detail-earned">摸鱼收入 ¥{{ selectedDayDetail.earned }}</text>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script>
import { callFunction } from '@/utils/cloud'
import { userStore } from '@/store/user'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const CAT_META = [
  { emoji: '🚽', name: '拉屎' },
  { emoji: '📺', name: '闲逛' },
  { emoji: '📚', name: '学习' },
];

export default {
  data() {
    return {
      year: 0,
      month: 0,
      monthData: {},
      loading: false,
      selectedDay: '',
    };
  },
  computed: {
    currentMonth() {
      return `${this.year}年${this.month}月`;
    },
    isCurrentMonth() {
      const now = new Date();
      return this.year === now.getFullYear() && this.month === now.getMonth() + 1;
    },
    monthKey() {
      return `${this.year}-${String(this.month).padStart(2, '0')}`;
    },
    monthEarned() {
      return (this.monthData.totalEarned || 0).toFixed(2);
    },
    activeDays() {
      if (!this.monthData.days) return 0;
      return Object.keys(this.monthData.days).length;
    },
    categoryTotals() {
      if (!this.monthData.days) return [];
      const totals = [0, 0, 0];
      for (const d of Object.values(this.monthData.days)) {
        totals[0] += d['0'] || 0;
        totals[1] += d['1'] || 0;
        totals[2] += d['2'] || 0;
      }
      const max = Math.max(...totals, 1);
      return CAT_META.map((cat, i) => ({
        ...cat,
        minutes: totals[i],
        percent: Math.round((totals[i] / max) * 100),
      }));
    },
    calendarDays() {
      const firstDay = new Date(this.year, this.month - 1, 1).getDay(); // 1号是周几（0=周日）
      const totalDays = new Date(this.year, this.month, 0).getDate(); // 当月总天数
      const now = new Date();
      const isThisMonth = this.year === now.getFullYear() && this.month === now.getMonth() + 1;
      const today = isThisMonth ? now.getDate() : -1;
      const days = this.monthData.days || {};
      const cells = [];
      // 前面补空格子
      for (let i = 0; i < firstDay; i++) {
        cells.push({ day: 0, hasRecord: false, isToday: false, data: null });
      }
      // 生成每天
      for (let d = 1; d <= totalDays; d++) {
        const dayStr = String(d);
        const record = days[dayStr];
        cells.push({
          day: d,
          hasRecord: !!record,
          isToday: d === today,
          data: record || null,
        });
      }
      return cells;
    },
    selectedDayDetail() {
      if (!this.selectedDay || !this.monthData.days) return null;
      const d = this.monthData.days[this.selectedDay];
      if (!d) return null;
      const dateObj = new Date(this.year, this.month - 1, Number(this.selectedDay));
      return {
        weekday: '周' + WEEKDAYS[dateObj.getDay()],
        cats: [d['0'] || 0, d['1'] || 0, d['2'] || 0],
        total: d.total || 0,
        earned: (d.earned || 0).toFixed(2),
      };
    },
  },
  onLoad() {
    const now = new Date();
    this.year = now.getFullYear();
    this.month = now.getMonth() + 1;
    this.loadData();
  },
  methods: {
    onDayTap(dayStr) {
      this.selectedDay = this.selectedDay === dayStr ? '' : dayStr;
    },
    prevMonth() {
      if (this.month === 1) {
        this.year -= 1;
        this.month = 12;
      } else {
        this.month -= 1;
      }
      this.selectedDay = '';
      this.loadData();
    },
    nextMonth() {
      if (this.isCurrentMonth) return;
      if (this.month === 12) {
        this.year += 1;
        this.month = 1;
      } else {
        this.month += 1;
      }
      this.selectedDay = '';
      this.loadData();
    },
    async loadData() {
      // 先加载本地数据
      this.loadLocalData();
      // 再尝试云端
      if (userStore.isLogged) {
        await this.fetchCloudData();
      }
    },
    loadLocalData() {
      const records = uni.getStorageSync('fishingRecords') || {};
      const days = {};
      // 本地格式: { "2026-02-18": { "0":5, "1":3, "2":2 } }
      // 筛选出当前月的记录
      const prefix = this.monthKey + '-';
      for (const [key, val] of Object.entries(records)) {
        if (key.startsWith(prefix)) {
          const dayStr = String(Number(key.split('-')[2])); // "18" -> "18"（去前导零）
          const total = Object.values(val).reduce((s, v) => s + (Number(v) || 0), 0);
          days[dayStr] = { ...val, total, earned: 0 };
        }
      }
      if (Object.keys(days).length > 0) {
        let totalMinutes = 0;
        for (const d of Object.values(days)) {
          totalMinutes += d.total || 0;
        }
        this.monthData = { days, totalMinutes, totalEarned: 0 };
      } else {
        this.monthData = {};
      }
    },
    async fetchCloudData() {
      this.loading = true;
      try {
        const res = await callFunction('syncFishRecords', {
          action: 'get',
          month: this.monthKey,
        });
        if (res && res.code === 0 && res.data) {
          // 云端数据更全（有 earned），直接用
          this.monthData = res.data;
        }
      } catch (e) {
        console.warn('[fishing-detail] 云端获取失败', e);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.page-container {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(180deg, #FFF6EB 0%, #FFFFFF 100%);
  box-sizing: border-box;
  padding: 24rpx 32rpx;
  padding-bottom: 60rpx;
}

/* 月份导航 */
.month-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40rpx;
  padding: 20rpx 0 32rpx;
}

.month-arrow {
  font-size: 28rpx;
  color: #FD5900;
  padding: 12rpx 16rpx;
}

.month-arrow.disabled {
  color: #DDD;
}

.month-text {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

/* 汇总卡片 */
.summary-card {
  display: flex;
  align-items: center;
  background: #FFF;
  border-radius: 24rpx;
  padding: 32rpx 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(253, 89, 0, 0.06);
  margin-bottom: 24rpx;
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.summary-num {
  font-size: 40rpx;
  font-weight: bold;
  color: #FD5900;
}

.summary-label {
  font-size: 24rpx;
  color: #999;
}

.summary-divider {
  width: 1rpx;
  height: 60rpx;
  background: #EEE;
}

/* 分类统计 */
.category-stats {
  background: #FFF;
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(253, 89, 0, 0.06);
  margin-bottom: 24rpx;
}

.cat-stat-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.cat-stat-item:last-child {
  margin-bottom: 0;
}

.cat-emoji {
  font-size: 32rpx;
  width: 40rpx;
  text-align: center;
}

.cat-bar-wrap {
  flex: 1;
  height: 20rpx;
  background: #F5F5F5;
  border-radius: 10rpx;
  overflow: hidden;
}

.cat-bar {
  height: 100%;
  background: linear-gradient(90deg, #FD5900, #FF8A50);
  border-radius: 10rpx;
  transition: width 0.3s;
}

.cat-minutes {
  font-size: 24rpx;
  color: #666;
  width: 120rpx;
  text-align: right;
}

/* 日历卡片 */
.calendar-card {
  background: #FFF;
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(253, 89, 0, 0.06);
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.empty-tip {
  text-align: center;
  padding: 40rpx 0;
  color: #CCC;
  font-size: 28rpx;
}

/* 星期标题行 */
.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 12rpx;
}

.weekday-cell {
  text-align: center;
  font-size: 24rpx;
  color: #999;
  padding: 8rpx 0;
}

/* 日期网格 */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8rpx 0;
}

.calendar-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12rpx 0;
  min-height: 80rpx;
  border-radius: 16rpx;
}

.cell-empty {
  visibility: hidden;
}

.cell-num {
  font-size: 28rpx;
  color: #BBB;
  line-height: 1;
}

.cell-has-record .cell-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #FD5900;
  color: #FFF;
  font-weight: 600;
}

.cell-today {
  position: relative;
}

.cell-today::after {
  content: '';
  position: absolute;
  top: 6rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  border: 3rpx solid #FD5900;
  pointer-events: none;
}

.cell-selected {
  background: #FFF6EB;
}

.cell-minutes {
  font-size: 20rpx;
  color: #FD5900;
  margin-top: 4rpx;
  line-height: 1;
}

/* 详情面板 */
.day-detail-panel {
  margin-top: 20rpx;
  padding: 24rpx;
  background: #FFF8F0;
  border-radius: 16rpx;
  border-left: 6rpx solid #FD5900;
}

.detail-header {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.detail-date {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.detail-weekday {
  font-size: 24rpx;
  color: #999;
}

.detail-cats {
  display: flex;
  gap: 24rpx;
  margin-bottom: 16rpx;
}

.detail-cat-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: #FFF;
  border-radius: 12rpx;
  padding: 8rpx 16rpx;
}

.detail-cat-emoji {
  font-size: 28rpx;
}

.detail-cat-val {
  font-size: 24rpx;
  color: #666;
}

.detail-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-total {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.detail-earned {
  font-size: 26rpx;
  color: #FD5900;
  font-weight: 600;
}
</style>

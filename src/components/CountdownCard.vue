<template>
  <view class="countdown-card">
    <view class="countdown-title">倒数日</view>
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
      <view class="countdown-item">
        <text class="countdown-icon">🎉</text>
        <view class="countdown-num">
          <text class="countdown-days">{{ daysToHoliday }}</text>
          <text class="countdown-unit">天</text>
        </view>
        <text class="countdown-text">距节假日</text>
      </view>
    </view>
  </view>
</template>

<script>
// 2026 年中国法定节假日（预估）
const HOLIDAYS_2026 = [
  { name: '元旦', date: '2026-01-01' },
  { name: '春节', date: '2026-02-17' },
  { name: '春节', date: '2026-02-18' },
  { name: '春节', date: '2026-02-19' },
  { name: '春节', date: '2026-02-20' },
  { name: '春节', date: '2026-02-21' },
  { name: '春节', date: '2026-02-22' },
  { name: '春节', date: '2026-02-23' },
  { name: '清明节', date: '2026-04-04' },
  { name: '清明节', date: '2026-04-05' },
  { name: '清明节', date: '2026-04-06' },
  { name: '劳动节', date: '2026-05-01' },
  { name: '劳动节', date: '2026-05-02' },
  { name: '劳动节', date: '2026-05-03' },
  { name: '劳动节', date: '2026-05-04' },
  { name: '劳动节', date: '2026-05-05' },
  { name: '端午节', date: '2026-05-31' },
  { name: '端午节', date: '2026-06-01' },
  { name: '端午节', date: '2026-06-02' },
  { name: '中秋节', date: '2026-09-25' },
  { name: '中秋节', date: '2026-09-26' },
  { name: '中秋节', date: '2026-09-27' },
  { name: '国庆节', date: '2026-10-01' },
  { name: '国庆节', date: '2026-10-02' },
  { name: '国庆节', date: '2026-10-03' },
  { name: '国庆节', date: '2026-10-04' },
  { name: '国庆节', date: '2026-10-05' },
  { name: '国庆节', date: '2026-10-06' },
  { name: '国庆节', date: '2026-10-07' },
];

export default {
  name: 'CountdownCard',
  props: {
    /** 休息日：0=周日 1=周一 ... 6=周六 */
    restDays: {
      type: Array,
      default: () => [0, 6],
    },
    /** 薪资类型 */
    salaryType: {
      type: String,
      default: 'monthly',
    },
    /** 发薪日数组 */
    paydays: {
      type: Array,
      default: () => [15],
    },
  },
  data() {
    return {
      daysToRest: 0,
      daysToPayday: 0,
      daysToHoliday: 0,
    };
  },
  watch: {
    restDays: { handler() { this.calculate(); }, deep: true },
    salaryType() { this.calculate(); },
    paydays: { handler() { this.calculate(); }, deep: true },
  },
  mounted() {
    this.calculate();
  },
  methods: {
    calculate() {
      const now = new Date();
      this.daysToRest = this.calcDaysToRest(now);
      this.daysToPayday = this.calcDaysToPayday(now);
      this.daysToHoliday = this.calcDaysToHoliday(now);
    },

    /**
     * 距离最近休息日
     * 从今天开始往后找，遇到 restDays 中的周几就返回天数
     * 今天就是休息日则返回 0
     */
    calcDaysToRest(now) {
      if (!this.restDays || this.restDays.length === 0) return '--';

      const todayDay = now.getDay(); // 0~6
      // 今天就是休息日
      if (this.restDays.includes(todayDay)) return 0;

      // 往后找最近的休息日（最多 7 天内必命中）
      for (let i = 1; i <= 7; i++) {
        const futureDay = (todayDay + i) % 7;
        if (this.restDays.includes(futureDay)) return i;
      }
      return '--';
    },

    /**
     * 距离最近发薪日
     * daily: 永远是 0（每天发）
     * weekly: paydays[0] 是周几（1=周一 ... 7=周日）
     * bimonthly: paydays 有两个日期，取最近的
     * monthly: paydays[0] 是几号
     */
    calcDaysToPayday(now) {
      const type = this.salaryType;
      const pays = this.paydays.filter(v => v);

      if (type === 'daily') return 0;

      if (type === 'weekly') {
        // paydays[0] 表示周几发，1~7（1=周一, 7=周日）
        const payWeekDay = pays[0] || 5; // 默认周五
        const todayDay = now.getDay() || 7;  // 转成 1~7
        if (todayDay === payWeekDay) return 0;
        const diff = payWeekDay - todayDay;
        return diff > 0 ? diff : diff + 7;
      }

      // monthly 或 bimonthly：按日期算
      const today = now.getDate();
      const year = now.getFullYear();
      const month = now.getMonth();

      let minDays = Infinity;
      for (const payDay of pays) {
        if (!payDay) continue;
        let targetDate;
        if (today <= payDay) {
          targetDate = new Date(year, month, payDay);
        } else {
          targetDate = new Date(year, month + 1, payDay);
        }
        const diff = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
        if (diff < minDays) minDays = diff;
      }
      return minDays === Infinity ? '--' : Math.max(0, minDays);
    },

    calcDaysToHoliday(now) {
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      for (const h of HOLIDAYS_2026) {
        if (h.date >= todayStr) {
          const target = new Date(h.date + 'T00:00:00');
          const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
          return diff <= 0 ? 0 : diff;
        }
      }
      return '--';
    },
  },
};
</script>

<style scoped>
.countdown-card {
  padding: 24rpx 32rpx;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.countdown-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 24rpx;
}

.countdown-list {
  display: flex;
  gap: 16rpx;
  flex: 1;
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
</style>

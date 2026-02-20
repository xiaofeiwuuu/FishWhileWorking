<template>
  <view class="container">
    <view class="content-wrapper">
      <view class="earnings-info">
        <view class="info-header">
          <view class="earnings-label">距离下班</view>
          <image class="settings-btn" src="/static/home/setting.png" mode="aspectFit" @tap="showSettings = true" />
        </view>
        <view class="earnings-amount">{{ gaugeTitle }}</view>
      </view>
      <GaugeChart
        v-show="!showSettings"
        canvas-id="gauge-chart"
        :width="750"
        :height="800"
        :value="gaugeValue"
        :colors="['#FFDE00', '#FD5900']"
        :title="earningsAmount"
        :subtitle="earningsLabel"
      />
    </view>
    <view class="bottom-section">
      <view class="card-tabs">
        <view
          class="card-tab"
          :class="{ active: activeCard === 0 }"
          @tap="activeCard = 0"
        >
          <text>📅 倒数日</text>
        </view>
        <view
          class="card-tab"
          :class="{ active: activeCard === 1 }"
          @tap="activeCard = 1"
        >
          <text>🎣 带薪摸鱼</text>
        </view>
      </view>
      <view class="card-body">
        <CountdownCard
          v-if="activeCard === 0"
          :rest-days="workSettings.restDays"
          :salary-type="workSettings.salaryType"
          :paydays="workSettings.paydays"
        />
        <FishingCard v-if="activeCard === 1" :hourly-wage="hourlyWage" />
      </view>
    </view>
    <CustomTabBar :current="0" />

    <!-- 设置弹窗 -->
    <view class="settings-mask" v-if="showSettings" @tap="closeSettings">
      <view class="settings-popup" @tap.stop>
        <view class="popup-header">
          <text class="popup-title">设置</text>
          <text class="popup-close" @tap="closeSettings">✕</text>
        </view>
        <view class="popup-body">
          <view class="setting-item">
            <text class="setting-label">上班时间</text>
            <picker mode="time" :value="workSettings.workStartTime" @change="workSettings.workStartTime = $event.detail.value">
              <view class="setting-value">{{ workSettings.workStartTime }}</view>
            </picker>
          </view>
          <view class="setting-item">
            <text class="setting-label">下班时间</text>
            <picker mode="time" :value="workSettings.workEndTime" @change="workSettings.workEndTime = $event.detail.value">
              <view class="setting-value">{{ workSettings.workEndTime }}</view>
            </picker>
          </view>
          <view class="setting-item">
            <text class="setting-label">午休开始</text>
            <picker mode="time" :value="workSettings.lunchStartTime" @change="workSettings.lunchStartTime = $event.detail.value">
              <view class="setting-value">{{ workSettings.lunchStartTime }}</view>
            </picker>
          </view>
          <view class="setting-item">
            <text class="setting-label">午休结束</text>
            <picker mode="time" :value="workSettings.lunchEndTime" @change="workSettings.lunchEndTime = $event.detail.value">
              <view class="setting-value">{{ workSettings.lunchEndTime }}</view>
            </picker>
          </view>
          <!-- 休息日多选 -->
          <view class="setting-item setting-item-col">
            <text class="setting-label">休息日</text>
            <view class="rest-days-row">
              <view
                v-for="(name, idx) in weekDayNames"
                :key="idx"
                class="rest-day-chip"
                :class="{ active: workSettings.restDays.includes(idx) }"
                @tap="toggleRestDay(idx)"
              >
                <text>{{ name }}</text>
              </view>
            </view>
          </view>

          <!-- 薪资类型 -->
          <view class="setting-item setting-item-col">
            <text class="setting-label">薪资类型</text>
            <view class="salary-type-row">
              <view
                v-for="item in salaryTypes"
                :key="item.value"
                class="salary-type-chip"
                :class="{ active: workSettings.salaryType === item.value }"
                @tap="workSettings.salaryType = item.value"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>

          <view class="setting-item">
            <text class="setting-label">薪资(元)</text>
            <input class="setting-input" type="digit" :value="workSettings.monthlySalary" @input="workSettings.monthlySalary = $event.detail.value.replace(/[^\d]/g, '')" placeholder="请输入金额" />
          </view>
          <view class="setting-item">
            <text class="setting-label">每月工作天数</text>
            <input class="setting-input" type="digit" :value="workSettings.workDaysPerMonth" @input="onWorkDaysInput" placeholder="请输入天数" />
          </view>

          <!-- 发薪日 -->
          <view class="setting-item setting-item-col" v-if="workSettings.salaryType !== 'daily'">
            <text class="setting-label">发薪日（{{ paydayHint }}）</text>
            <view class="paydays-row">
              <view class="payday-input-group">
                <text class="payday-prefix">第1个</text>
                <input
                  class="setting-input payday-input"
                  type="number"
                  :value="workSettings.paydays[0]"
                  @input="onPaydayInput(0, $event)"
                  placeholder="日期"
                />
                <text class="payday-suffix">{{ paydaySuffix }}</text>
              </view>
              <view class="payday-input-group" v-if="workSettings.salaryType === 'bimonthly'">
                <text class="payday-prefix">第2个</text>
                <input
                  class="setting-input payday-input"
                  type="number"
                  :value="workSettings.paydays[1] || ''"
                  @input="onPaydayInput(1, $event)"
                  placeholder="日期"
                />
                <text class="payday-suffix">{{ paydaySuffix }}</text>
              </view>
            </view>
          </view>

          <!-- 公式提示 -->
          <view class="formula-hint">
            <text class="formula-text">秒薪 = {{ salaryTypeLabel }} ÷ 工作天数 ÷ (上班时长 - 午休时长)</text>
          </view>
        </view>
        <view class="popup-footer">
          <button class="save-btn" @tap="handleSave">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import GaugeChart from "@/components/GaugeChart.vue";
import CustomTabBar from "@/components/CustomTabBar.vue";
import CountdownCard from "@/components/CountdownCard.vue";
import FishingCard from "@/components/FishingCard.vue";
import { callFunction } from "@/utils/cloud";
import { userStore } from "@/store/user";

export default {
  components: {
    GaugeChart,
    CustomTabBar,
    CountdownCard,
    FishingCard,
  },
  data() {
    return {
      // 工作设置(合并到一个对象)
      workSettings: {
        workStartTime: "09:00",
        workEndTime: "18:00",
        lunchStartTime: "12:00",
        lunchEndTime: "13:00",
        monthlySalary: "10000",
        workDaysPerMonth: "22",
        // 休息日：0=周日 1=周一 ... 6=周六，默认周六周日
        restDays: [0, 6],
        // 薪资类型：daily/weekly/bimonthly/monthly
        salaryType: "monthly",
        // 发薪日：数组，支持 1~2 个日期
        paydays: [15],
      },

      // 薪资类型选项
      salaryTypes: [
        { value: 'daily', label: '日薪' },
        { value: 'weekly', label: '周薪' },
        { value: 'bimonthly', label: '半月薪' },
        { value: 'monthly', label: '月薪' },
      ],
      // 周几名称
      weekDayNames: ['日', '一', '二', '三', '四', '五', '六'],

      // 显示数据
      gaugeValue: 0,
      gaugeTitle: "00:00:00",
      gaugeSubtitle: "距离下班",

      // Canvas中心显示的今日已挣
      earningsAmount: "¥0.00",
      earningsLabel: "今日已挣",

      // 时薪（传给 FishingCard）
      hourlyWage: 0,

      // 当前卡片 tab：0=摸鱼 1=倒数日
      activeCard: 0,

      // 设置弹窗
      showSettings: false,

      // 定时器
      timer: null,
    };
  },
  onLoad() {
    // 1. 先读本地设置（秒开）
    this.loadLocalSettings();
    // 2. 后台拉云端设置覆盖本地
    this.fetchCloudSettings();
  },
  onReady() {
    this.updateWorkProgress();
    this.timer = setInterval(() => {
      this.updateWorkProgress();
    }, 1000);
  },
  onShow() {
    this.loadLocalSettings();
  },
  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  },
  computed: {
    paydayHint() {
      const m = { daily: '', weekly: '每周几', bimonthly: '每月2个日期', monthly: '每月几号' };
      return m[this.workSettings.salaryType] || '';
    },
    paydaySuffix() {
      return this.workSettings.salaryType === 'weekly' ? '' : '号';
    },
    salaryTypeLabel() {
      const m = { daily: '日薪', weekly: '周薪', bimonthly: '半月薪', monthly: '月薪' };
      return m[this.workSettings.salaryType] || '月薪';
    },
  },
  methods: {
    /** 从本地加载设置，合并默认值兼容旧数据 */
    loadLocalSettings() {
      const saved = uni.getStorageSync('workSettings');
      if (saved) {
        this.workSettings = { ...this.workSettings, ...saved };
      }
      // 确保新字段有默认值（旧缓存可能没有）
      if (!Array.isArray(this.workSettings.restDays)) this.workSettings.restDays = [0, 6];
      if (!Array.isArray(this.workSettings.paydays)) this.workSettings.paydays = [15];
      if (!this.workSettings.salaryType) this.workSettings.salaryType = 'monthly';
    },
    updateWorkProgress() {
      const now = new Date();

      // 解析时间
      const [startHour, startMin] = this.workSettings.workStartTime.split(":").map(Number);
      const [endHour, endMin] = this.workSettings.workEndTime.split(":").map(Number);
      const [lunchStartHour, lunchStartMin] = this.workSettings.lunchStartTime.split(":").map(Number);
      const [lunchEndHour, lunchEndMin] = this.workSettings.lunchEndTime.split(":").map(Number);

      // 判断是否跨夜班次（下班时间 <= 上班时间，如 19:00~02:00）
      const isOvernightShift = (endHour < startHour) || (endHour === startHour && endMin <= startMin);

      // 创建"今天"的上班时间点
      const todayStart = new Date(now);
      todayStart.setHours(startHour, startMin, 0, 0);

      // 确定当前属于哪个班次的 startTime / endTime
      // 跨夜场景有两种可能：
      //   A) 现在处于"今天上班→明天下班"这个班次（now >= todayStart）
      //   B) 现在处于"昨天上班→今天下班"这个班次（now < todayStart，但可能在昨天开始的班次里）
      let startTime, endTime;

      if (isOvernightShift) {
        // 昨天同一时刻开始的班次
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(yesterdayStart);
        yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);
        yesterdayEnd.setHours(endHour, endMin, 0, 0);

        // 今天开始的班次
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        todayEnd.setHours(endHour, endMin, 0, 0);

        if (now >= todayStart) {
          // 情况A：当前在今天开始的班次中（或班前）
          startTime = todayStart;
          endTime = todayEnd;
        } else if (now < yesterdayEnd) {
          // 情况B：当前在昨天开始的班次中（还没下班）
          startTime = yesterdayStart;
          endTime = yesterdayEnd;
        } else {
          // 已下班（昨天的班结束了，今天的班还没开始）
          startTime = todayStart;
          endTime = todayEnd;
        }
      } else {
        // 非跨夜：正常情况
        startTime = todayStart;
        endTime = new Date(now);
        endTime.setHours(endHour, endMin, 0, 0);
      }

      // 午休时间点 — 落在 startTime 所在日期当天，如果跨夜且午休在上班前的小时则推到次日
      const lunchStart = new Date(startTime);
      lunchStart.setHours(lunchStartHour, lunchStartMin, 0, 0);
      if (lunchStart < startTime) {
        lunchStart.setDate(lunchStart.getDate() + 1);
      }

      const lunchEnd = new Date(lunchStart);
      lunchEnd.setHours(lunchEndHour, lunchEndMin, 0, 0);
      if (lunchEnd < lunchStart) {
        lunchEnd.setDate(lunchEnd.getDate() + 1);
      }

      // 午休是否在工作区间内
      const lunchInShift = lunchStart >= startTime && lunchEnd <= endTime;
      const lunchDuration = lunchInShift ? (lunchEnd - lunchStart) : 0;

      // 有效工作时长（毫秒）= 总时间跨度 - 午休时长
      const effectiveWorkTime = (endTime - startTime) - lunchDuration;

      // 薪资计算：根据薪资类型换算日薪
      const salary = Number(this.workSettings.monthlySalary) || 0;
      const workDays = Number(this.workSettings.workDaysPerMonth) || 22;
      const type = this.workSettings.salaryType || 'monthly';
      let dailyWage = 0;
      if (type === 'daily') {
        dailyWage = salary;
      } else if (type === 'weekly') {
        dailyWage = salary / Math.min(workDays, 7);
      } else if (type === 'bimonthly') {
        dailyWage = salary / (workDays / 2);
      } else {
        // monthly
        dailyWage = salary / workDays;
      }
      const effectiveHours = effectiveWorkTime / (1000 * 60 * 60);
      const hourlyWage = dailyWage / effectiveHours;
      const perSecond = hourlyWage / 3600;

      // 更新时薪给 FishingCard
      this.hourlyWage = hourlyWage;

      // 计算已工作秒数（扣除午休）
      let workedSeconds = 0;
      const nowMs = now.getTime();

      if (nowMs < startTime.getTime()) {
        // 还没上班
        workedSeconds = 0;
      } else if (nowMs >= endTime.getTime()) {
        // 已下班，取有效工时总秒数
        workedSeconds = effectiveWorkTime / 1000;
      } else if (lunchInShift && nowMs < lunchStart.getTime()) {
        // 午休前工作中
        workedSeconds = (nowMs - startTime.getTime()) / 1000;
      } else if (lunchInShift && nowMs >= lunchStart.getTime() && nowMs < lunchEnd.getTime()) {
        // 午休中，只算午休前工作量
        workedSeconds = (lunchStart.getTime() - startTime.getTime()) / 1000;
      } else if (lunchInShift) {
        // 午休后，当前 - 上班 - 午休时长
        workedSeconds = (nowMs - startTime.getTime() - lunchDuration) / 1000;
      } else {
        // 无午休（不在工作区间内），直接算
        workedSeconds = (nowMs - startTime.getTime()) / 1000;
      }

      workedSeconds = Math.max(0, workedSeconds);

      // 今日已挣
      const earned = workedSeconds * perSecond;
      this.earningsAmount = `¥${earned.toFixed(2)}`;

      // 计算进度（基于有效工时）
      let progress = (workedSeconds * 1000) / effectiveWorkTime;
      progress = Math.max(0, Math.min(1, progress));
      this.gaugeValue = progress;

      // 计算剩余时间
      const remainingTime = endTime - now;
      const workedTime = now - startTime;

      // 格式化剩余时间显示
      if (remainingTime > 0 && workedTime >= 0) {
        const hours = Math.floor(remainingTime / (1000 * 60 * 60));
        const minutes = Math.floor(
          (remainingTime % (1000 * 60 * 60)) / (1000 * 60)
        );
        const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

        this.gaugeTitle = `${String(hours).padStart(2, "0")}:${String(
          minutes
        ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        this.gaugeSubtitle = "距离下班";
      } else if (workedTime < 0) {
        // 还没到上班时间
        this.gaugeTitle = "未上班";
        this.gaugeSubtitle = `${this.workSettings.workStartTime} 开始`;
      } else {
        // 已经下班了
        this.gaugeTitle = "已下班";
        this.gaugeSubtitle = "辛苦了！";
      }
    },

    toggleRestDay(day) {
      const idx = this.workSettings.restDays.indexOf(day);
      if (idx >= 0) {
        this.workSettings.restDays.splice(idx, 1);
      } else {
        this.workSettings.restDays.push(day);
        this.workSettings.restDays.sort();
      }
    },
    onPaydayInput(index, e) {
      let val = parseInt(e.detail.value) || '';
      if (val) {
        if (this.workSettings.salaryType === 'weekly') {
          val = Math.min(Math.max(val, 1), 7);
        } else {
          val = Math.min(Math.max(val, 1), 31);
        }
      }
      const paydays = [...this.workSettings.paydays];
      paydays[index] = val;
      this.workSettings.paydays = paydays;
    },
    closeSettings() {
      this.showSettings = false;
    },
    onWorkDaysInput(e) {
      let value = e.detail.value.replace(/[^\d]/g, '');
      if (value) {
        value = Math.min(Math.max(parseInt(value), 1), 31).toString();
      }
      this.workSettings.workDaysPerMonth = value;
    },
    async handleSave() {
      // 1. 存本地
      uni.setStorageSync('workSettings', this.workSettings);
      this.updateWorkProgress();

      // 2. 存云端
      if (userStore.isLogged) {
        try {
          await callFunction('saveSettings', {
            action: 'save',
            settings: { ...this.workSettings },
          });
        } catch (err) {
          console.warn('云端保存失败', err);
        }
      }

      // 3. 保存完成后关闭弹窗并提示
      this.showSettings = false;
      uni.showToast({ title: '修改成功', icon: ' none' });
    },

    /** 从云端拉取设置，有则覆盖本地 */
    async fetchCloudSettings() {
      // 等登录完成再拉
      if (!userStore.isLogged) {
        // 轮询等待登录（最多 5 秒）
        let waited = 0;
        const waitLogin = () => new Promise((resolve) => {
          const check = setInterval(() => {
            waited += 200;
            if (userStore.isLogged || waited >= 5000) {
              clearInterval(check);
              resolve();
            }
          }, 200);
        });
        await waitLogin();
      }

      if (!userStore.isLogged) return;

      try {
        const res = await callFunction('saveSettings', { action: 'get' });
        if (res.code === 0 && res.data) {
          // 云端有设置，合并覆盖本地
          this.workSettings = { ...this.workSettings, ...res.data };
          if (!Array.isArray(this.workSettings.restDays)) this.workSettings.restDays = [0, 6];
          if (!Array.isArray(this.workSettings.paydays)) this.workSettings.paydays = [15];
          if (!this.workSettings.salaryType) this.workSettings.salaryType = 'monthly';
          uni.setStorageSync('workSettings', this.workSettings);
          this.updateWorkProgress();
          console.log('[settings] 已从云端同步设置');
        }
      } catch (err) {
        console.warn('[settings] 云端设置拉取失败，使用本地设置', err);
      }
    },
  },
};
</script>

<style scoped>
.container {
  width: 100%;
  height: 100vh;
  display: flex;
  padding-top: calc(var(--status-bar-height) + 100rpx);
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
  justify-content: center;
  flex-direction: column;
  box-sizing: border-box;
  background: linear-gradient(#FFF6EB 100%, #FFFFFF 0%);
  overflow: hidden;
}

.content-wrapper {
  position: relative;
  width: 100%;
  height: calc(60vh - var(--status-bar-height) - 100rpx);
}

.earnings-info {
  position: absolute;
  top: 40rpx;
  left: 40rpx;
  z-index: 10;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.earnings-label {
  font-size: 36rpx;
  color: #999;
}

.settings-btn {
  width: 40rpx;
  height: 40rpx;
}

.earnings-amount {
  font-size: 56rpx;
  font-weight: bold;
  color: #333;
  line-height: 1;
}

.bottom-section {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #FFF;
  position: relative;
  border-radius: 60rpx 60rpx 0 0;
  overflow: hidden;
}

.card-tabs {
  display: flex;
  padding: 20rpx 32rpx 0;
  gap: 8rpx;
}

.card-tab {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 40rpx;
  font-size: 26rpx;
  color: #999;
  background: #f5f5f5;
  transition: all 0.25s;
}

.card-tab.active {
  background: #FD5900;
  color: #FFF;
  font-weight: 600;
}

.card-body {
  flex: 1;
  overflow: hidden;
}

/* 设置弹窗 */
.settings-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  align-items: flex-end;
}

.settings-popup {
  width: 100%;
  background: #FFF;
  border-radius: 32rpx 32rpx 0 0;
  max-height: 80vh;
  overflow-y: auto;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 40rpx;
  border-bottom: 1px solid #f2f2f2;
}

.popup-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.popup-close {
  font-size: 36rpx;
  color: #999;
  padding: 8rpx;
}

.popup-body {
  padding: 0;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 40rpx;
  border-bottom: 1px solid #f5f5f5;
}

.setting-label {
  font-size: 30rpx;
  color: #333;
}

.setting-value {
  font-size: 30rpx;
  padding: 8rpx 20rpx;
  background: #FFF6EB;
  border-radius: 8rpx;
  min-width: 120rpx;
  text-align: center;
  color: #FD5900;
}

.setting-input {
  font-size: 30rpx;
  text-align: center;
  padding: 8rpx 20rpx;
  background: #FFF6EB;
  border-radius: 8rpx;
  min-width: 120rpx;
  width: 120rpx;
  color: #FD5900;
}

.popup-footer {
  padding: 24rpx 40rpx 48rpx;
}

.save-btn {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  background: linear-gradient(135deg, #FFDE00, #FD5900);
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
  border-radius: 42rpx;
  border: none;
}

/* 公式提示 */
.formula-hint {
  padding: 20rpx 40rpx 8rpx;
}

.formula-text {
  font-size: 22rpx;
  color: #bbb;
  line-height: 1.6;
}

/* 列式设置项 */
.setting-item-col {
  flex-direction: column;
  align-items: flex-start !important;
  gap: 16rpx;
}

/* 休息日多选 */
.rest-days-row {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.rest-day-chip {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f5f5f5;
  font-size: 26rpx;
  color: #666;
  transition: all 0.2s;
}

.rest-day-chip.active {
  background: #FD5900;
  color: #FFF;
  font-weight: 600;
}

/* 薪资类型选择 */
.salary-type-row {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.salary-type-chip {
  padding: 12rpx 28rpx;
  border-radius: 32rpx;
  background: #f5f5f5;
  font-size: 26rpx;
  color: #666;
  transition: all 0.2s;
}

.salary-type-chip.active {
  background: #FD5900;
  color: #FFF;
  font-weight: 600;
}

/* 发薪日 */
.paydays-row {
  display: flex;
  gap: 20rpx;
  width: 100%;
}

.payday-input-group {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.payday-prefix {
  font-size: 24rpx;
  color: #999;
  white-space: nowrap;
}

.payday-input {
  width: 100rpx !important;
  min-width: 100rpx !important;
}

.payday-suffix {
  font-size: 24rpx;
  color: #999;
  white-space: nowrap;
}
</style>

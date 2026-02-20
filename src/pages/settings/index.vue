<template>
  <view class="settings-page">
    <view class="settings-container">
      <!-- 上班时间 -->
      <view class="setting-item">
        <text class="setting-label">上班时间</text>
        <picker mode="time" :value="workSettings.workStartTime" @change="onStartTimeChange">
          <view class="setting-value">{{ workSettings.workStartTime }}</view>
        </picker>
      </view>

      <!-- 下班时间 -->
      <view class="setting-item">
        <text class="setting-label">下班时间</text>
        <picker mode="time" :value="workSettings.workEndTime" @change="onEndTimeChange">
          <view class="setting-value">{{ workSettings.workEndTime }}</view>
        </picker>
      </view>

      <!-- 午休时间 -->
      <view class="setting-item">
        <text class="setting-label">午休开始</text>
        <picker mode="time" :value="workSettings.lunchStartTime" @change="onLunchStartChange">
          <view class="setting-value">{{ workSettings.lunchStartTime }}</view>
        </picker>
      </view>

      <view class="setting-item">
        <text class="setting-label">午休结束</text>
        <picker mode="time" :value="workSettings.lunchEndTime" @change="onLunchEndChange">
          <view class="setting-value">{{ workSettings.lunchEndTime }}</view>
        </picker>
      </view>

      <!-- 月薪 -->
      <view class="setting-item">
        <text class="setting-label">月薪(元)</text>
        <input
          class="setting-input"
          type="digit"
          :value="workSettings.monthlySalary"
          @input="onSalaryInput"
          placeholder="请输入月薪"
        />
      </view>

      <!-- 工作天数 -->
      <view class="setting-item">
        <text class="setting-label">每月工作天数</text>
        <input
          class="setting-input"
          type="digit"
          :value="workSettings.workDaysPerMonth"
          @input="onWorkDaysInput"
          placeholder="请输入工作天数"
        />
      </view>
    </view>

    <!-- 保存按钮 -->
    <view class="save-btn-container">
      <button class="save-btn" @tap="handleSave">保存</button>
    </view>
    <CustomTabBar :current="1" />
  </view>
</template>

<script>
import CustomTabBar from "@/components/CustomTabBar.vue";

export default {
  components: {
    CustomTabBar,
  },
  data() {
    return {
      workSettings: {
        workStartTime: "09:00",
        workEndTime: "18:00",
        lunchStartTime: "12:00",
        lunchEndTime: "13:00",
        monthlySalary: "10000",
        workDaysPerMonth: "22",
      },
    };
  },
  onLoad() {
    // 从本地存储加载设置
    const savedSettings = uni.getStorageSync('workSettings');
    if (savedSettings) {
      this.workSettings = savedSettings;
    }
  },
  methods: {
    onStartTimeChange(e) {
      this.workSettings.workStartTime = e.detail.value;
    },

    onEndTimeChange(e) {
      this.workSettings.workEndTime = e.detail.value;
    },

    onLunchStartChange(e) {
      this.workSettings.lunchStartTime = e.detail.value;
    },

    onLunchEndChange(e) {
      this.workSettings.lunchEndTime = e.detail.value;
    },

    onSalaryInput(e) {
      // 只允许输入数字
      const value = e.detail.value.replace(/[^\d]/g, '');
      this.workSettings.monthlySalary = value;
    },

    onWorkDaysInput(e) {
      // 只允许输入数字,并限制在1-31之间
      let value = e.detail.value.replace(/[^\d]/g, '');
      if (value) {
        value = Math.min(Math.max(parseInt(value), 1), 31).toString();
      }
      this.workSettings.workDaysPerMonth = value;
    },

    handleSave() {
      // 保存到本地存储
      uni.setStorageSync('workSettings', this.workSettings);

      uni.showToast({
        title: '保存成功',
        icon: 'success',
      });
    },
  },
};
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: #FFF6EB;
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.settings-container {
  background: #FFF6EB;
  /* border-radius: 16rpx; */
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 40rpx;
  border-bottom: 1px solid #f2f2f2;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-label {
  font-size: 32rpx;
  color: #333;
  font-weight: 500;
}

.setting-value {
  font-size: 32rpx;
  padding: 10rpx 20rpx;
  background: #FFFFFF;
  border-radius: 8rpx;
  min-width: 120rpx;
  text-align: center;
}

.setting-input {
  font-size: 32rpx;
  text-align: center;
  padding: 10rpx 20rpx;
  background: #FFFFFF;
  border-radius: 8rpx;
  min-width: 120rpx;
  width: 120rpx;
}

.save-btn-container {
  padding: 40rpx 20rpx;
}

.save-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #FFDE00, #FD5900);
  color: #fff;
  font-size: 32rpx;
  font-weight: bold;
  border-radius: 44rpx;
  border: none;
}
</style>

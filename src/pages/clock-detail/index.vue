<template>
  <view class="page-container">
    <view class="page-content">
      <view class="page-icon">⏰</view>
      <text class="page-title">打卡详情</text>
      <text class="page-desc">上下班打卡记录</text>
      <view class="page-placeholder">
        <text class="placeholder-text">功能开发中...</text>
        <text class="placeholder-hint">这里将展示你的打卡历史和出勤统计</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  onLoad(options) {
    // 预留参数接收
  }
}
</script>

<style scoped>
.page-container {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(180deg, #FFF6EB 0%, #FFFFFF 100%);
  box-sizing: border-box;
}

.page-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 40rpx;
}

.page-icon {
  font-size: 120rpx;
  margin-bottom: 20rpx;
}

.page-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 12rpx;
}

.page-desc {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 60rpx;
}

.page-placeholder {
  width: 100%;
  background: #FFF;
  border-radius: 24rpx;
  padding: 80rpx 40rpx;
  text-align: center;
  box-shadow: 0 4rpx 20rpx rgba(253, 89, 0, 0.06);
}

.placeholder-text {
  display: block;
  font-size: 32rpx;
  color: #FD5900;
  font-weight: 600;
  margin-bottom: 16rpx;
}

.placeholder-hint {
  display: block;
  font-size: 26rpx;
  color: #999;
}
</style>

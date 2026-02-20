<template>
  <view class="custom-tabbar" :style="{ paddingBottom: safeAreaBottom + 'px' }">
    <view
      v-for="(item, index) in tabList"
      :key="index"
      class="tabbar-item"
      :class="{ active: current === index }"
      @tap="switchTab(index)"
    >
      <view class="icon-wrapper">
        <image
          v-if="item.icon"
          class="icon-image"
          :src="current === index ? item.selectedIcon : item.icon"
          mode="aspectFit"
        />
        <text v-else class="icon-emoji">{{ current === index ? item.selectedEmoji : item.emoji }}</text>
      </view>
      <text
        class="tabbar-text"
        :style="{ color: current === index ? activeColor : inactiveColor }"
      >
        {{ item.text }}
      </text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'CustomTabBar',
  props: {
    current: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      activeColor: '#FD5900',
      inactiveColor: '#999999',
      safeAreaBottom: 0,
      tabList: [
        {
          text: '首页',
          icon: '/static/tabbar/home.png',
          selectedIcon: '/static/tabbar/home-active.png',
          pagePath: '/pages/index/index'
        },
        {
          text: '鱼缸',
          emoji: '🐠',
          selectedEmoji: '🐠',
          pagePath: '/pages/fish-tank/index'
        },
        {
          text: '我的',
          emoji: '👤',
          selectedEmoji: '👤',
          pagePath: '/pages/profile/index'
        }
      ]
    };
  },
  mounted() {
    const windowInfo = uni.getWindowInfo();
    const safeArea = windowInfo.safeArea;
    if (safeArea) {
      this.safeAreaBottom = windowInfo.screenHeight - safeArea.bottom;
    }
  },
  methods: {
    switchTab(index) {
      if (this.current === index) {
        return;
      }

      const item = this.tabList[index];
      uni.switchTab({
        url: item.pagePath
      });
    }
  }
};
</script>

<style scoped>
.custom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120rpx;
  background: #FFF6EB;
  display: flex;
  align-items: flex-start;
  justify-content: space-around;
  padding-top: 10rpx;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
  z-index: 1000;
}

.tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 8rpx 0;
  transition: all 0.3s ease;
}

.tabbar-item.active {
  transform: scale(1.05);
}

.icon-wrapper {
  margin-bottom: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48rpx;
}

.icon-image {
  width: 48rpx;
  height: 48rpx;
  transition: all 0.3s ease;
}

.icon-emoji {
  font-size: 40rpx;
  line-height: 48rpx;
}

.tabbar-text {
  font-size: 22rpx;
  line-height: 1.2;
  margin-top: 4rpx;
  font-weight: 500;
  transition: all 0.3s ease;
}
</style>

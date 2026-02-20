<template>
  <view class="fishing-card">
    <view class="fishing-header">
      <view class="fishing-title-row">
        <text class="fishing-title">带薪摸鱼：¥{{ totalEarnings }}</text>
      </view>
    </view>

    <view class="fishing-categories">
      <view
        v-for="(cat, index) in categories"
        :key="index"
        class="category-btn"
        @touchstart="onTouchStart(index)"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      >
        <text class="category-emoji">{{ cat.emoji }}</text>
        <text class="category-name">{{ cat.name }}</text>
        <text class="category-time">{{ cat.todayMinutes }}分钟</text>
        <view class="add-btn">
          <text class="add-text">+1min</text>
        </view>
        <!-- 飘字动画 -->
        <text
          v-for="(anim, i) in cat.anims"
          :key="anim.id"
          class="float-text"
          :class="{ 'float-up': anim.active }"
        >+1</text>
      </view>
    </view>
  </view>
</template>

<script>
import { callFunction } from '@/utils/cloud'
import { userStore } from '@/store/user'

let animIdCounter = 0;
let syncTimer = null; // 节流同步定时器

export default {
  name: 'FishingCard',
  props: {
    hourlyWage: {
      type: Number,
      default: 0,
    },
  },
  data() {
    return {
      categories: [
        { emoji: '🚽', name: '拉屎', todayMinutes: 0, anims: [] },
        { emoji: '📺', name: '闲逛', todayMinutes: 0, anims: [] },
        { emoji: '📚', name: '学习', todayMinutes: 0, anims: [] },
      ],
      longPressTimer: null,
      longPressInterval: null,
      dirty: false, // 是否有未同步的数据
    };
  },
  computed: {
    totalEarnings() {
      if (this.hourlyWage <= 0) return '0.00';
      const perSecond = this.hourlyWage / 3600;
      const totalMinutes = this.categories.reduce((sum, c) => sum + c.todayMinutes, 0);
      return (totalMinutes * 60 * perSecond).toFixed(2);
    },
  },
  mounted() {
    this.loadTodayRecords();
    this.fetchCloudRecords();
  },
  beforeUnmount() {
    this.clearTimers();
    // 页面卸载前，如果有脏数据立即同步
    if (this.dirty) {
      this.syncToCloud();
    }
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
  },
  methods: {
    getTodayKey() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },
    getMonthKey() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    },
    getDayOfMonth() {
      return String(new Date().getDate());
    },

    // ===== 本地存储 =====
    loadTodayRecords() {
      const records = uni.getStorageSync('fishingRecords') || {};
      const todayKey = this.getTodayKey();
      const todayData = records[todayKey] || {};

      this.categories.forEach((cat, index) => {
        cat.todayMinutes = todayData[index] || 0;
      });
    },
    saveRecords() {
      const records = uni.getStorageSync('fishingRecords') || {};
      const todayKey = this.getTodayKey();
      const todayData = {};
      this.categories.forEach((cat, index) => {
        todayData[index] = cat.todayMinutes;
      });
      records[todayKey] = todayData;
      uni.setStorageSync('fishingRecords', records);
    },

    // ===== 云端同步 =====
    async fetchCloudRecords() {
      if (!userStore.isLogged) return;
      try {
        const res = await callFunction('syncFishRecords', {
          action: 'get',
          month: this.getMonthKey(),
        });
        if (res && res.code === 0 && res.data) {
          const dayKey = this.getDayOfMonth();
          const cloudDay = res.data.days && res.data.days[dayKey];
          if (cloudDay) {
            // 云端数据 vs 本地数据取较大值（防止覆盖）
            let updated = false;
            this.categories.forEach((cat, index) => {
              const cloudVal = cloudDay[String(index)] || 0;
              if (cloudVal > cat.todayMinutes) {
                cat.todayMinutes = cloudVal;
                updated = true;
              }
            });
            if (updated) {
              this.saveRecords(); // 把云端较大值写回本地
            }
          }
        }
      } catch (e) {
        // 云端获取失败不影响本地使用
        console.warn('[FishingCard] 云端记录获取失败', e);
      }
    },

    /** 节流同步到云端：操作结束后 2 秒执行 */
    scheduleSyncToCloud() {
      this.dirty = true;
      if (syncTimer) {
        clearTimeout(syncTimer);
      }
      syncTimer = setTimeout(() => {
        this.syncToCloud();
        syncTimer = null;
      }, 2000);
    },

    async syncToCloud() {
      if (!userStore.isLogged) return;
      this.dirty = false;
      const dayData = {};
      this.categories.forEach((cat, index) => {
        dayData[String(index)] = cat.todayMinutes;
      });
      try {
        await callFunction('syncFishRecords', {
          action: 'save',
          month: this.getMonthKey(),
          dayKey: this.getDayOfMonth(),
          dayData,
          hourlyWage: this.hourlyWage,
        });
      } catch (e) {
        // 同步失败标记脏，下次再试
        this.dirty = true;
        console.warn('[FishingCard] 云端同步失败', e);
      }
    },

    // ===== 交互逻辑 =====
    addOne(index) {
      this.categories[index].todayMinutes += 1;
      this.saveRecords();
      this.showFloatAnim(index);
    },
    showFloatAnim(index) {
      const id = ++animIdCounter;
      const anim = { id, active: false };
      this.categories[index].anims.push(anim);
      setTimeout(() => { anim.active = true; }, 10);
      setTimeout(() => {
        const arr = this.categories[index].anims;
        const pos = arr.findIndex(a => a.id === id);
        if (pos !== -1) arr.splice(pos, 1);
      }, 600);
    },
    onTouchStart(index) {
      this.addOne(index);
      this.longPressTimer = setTimeout(() => {
        this.longPressInterval = setInterval(() => {
          this.addOne(index);
        }, 150);
      }, 300);
    },
    onTouchEnd() {
      this.clearTimers();
      // 触摸结束后调度云端同步
      this.scheduleSyncToCloud();
    },
    clearTimers() {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      if (this.longPressInterval) {
        clearInterval(this.longPressInterval);
        this.longPressInterval = null;
      }
    },
  },
};
</script>

<style scoped>
.fishing-card {
  padding: 24rpx 32rpx;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.fishing-header {
  margin-bottom: 24rpx;
}

.fishing-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fishing-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.fishing-categories {
  display: flex;
  gap: 16rpx;
  flex: 1;
}

.category-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  background: linear-gradient(135deg, #FFF8F0, #FFF2E5);
  border-radius: 16rpx;
  padding: 16rpx 12rpx;
  position: relative;
  overflow: visible;
}

.category-emoji {
  font-size: 40rpx;
}

.category-name {
  font-size: 24rpx;
  color: #666;
}

.category-time {
  font-size: 22rpx;
  color: #FD5900;
  font-weight: 500;
}

.add-btn {
  margin-top: 4rpx;
  background: #FD5900;
  border-radius: 20rpx;
  padding: 6rpx 20rpx;
}

.add-text {
  color: #FFF;
  font-size: 22rpx;
  font-weight: bold;
}

/* 飘字动画 */
.float-text {
  position: absolute;
  top: 20rpx;
  left: 50%;
  transform: translateX(-50%);
  font-size: 28rpx;
  font-weight: bold;
  color: #FD5900;
  opacity: 1;
  pointer-events: none;
  transition: none;
}

.float-text.float-up {
  transform: translateX(-50%) translateY(-60rpx);
  opacity: 0;
  transition: all 0.5s ease-out;
}
</style>

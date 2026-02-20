<template>
  <view class="page-container">
    <view class="page-content">
      <!-- 头像区域 -->
      <view class="avatar-section">
        <!-- 已有头像：展示；未有头像：授权按钮 -->
        <button
          v-if="!avatarUrl"
          class="avatar-btn"
          open-type="chooseAvatar"
          @chooseavatar="onChooseAvatar"
        >
          <view class="avatar-placeholder">
            <text class="avatar-emoji">👻</text>
          </view>
          <text class="avatar-tip">点击设置头像</text>
        </button>
        <view v-else class="avatar-wrap" @tap="reChooseAvatar">
          <image class="avatar-img" :src="avatarUrl" mode="aspectFill" />
        </view>

        <!-- 昵称：已设置则展示，未设置则输入框 -->
        <view v-if="!isEditingName && displayName !== '未设置昵称'" class="nickname-row" @tap="isEditingName = true">
          <text class="nickname">{{ displayName }}</text>
          <text class="edit-icon">✎</text>
        </view>
        <view v-else class="nickname-input-wrap">
          <input
            class="nickname-input"
            type="nickname"
            :value="inputName"
            placeholder="点击输入昵称"
            @blur="onNicknameConfirm"
            @confirm="onNicknameConfirm"
          />
        </view>

        <view class="title-badge" v-if="isLogged">
          <text class="title-text">{{ userTitle }}</text>
        </view>
        <text class="user-status">{{ statusText }}</text>
      </view>

      <!-- 积分卡片 -->
      <view class="points-card" v-if="isLogged">
        <view class="points-row">
          <text class="points-label">摸鱼积分</text>
          <text class="points-value">{{ userInfo ? userInfo.points : 0 }}</text>
        </view>
      </view>

      <!-- 功能菜单 -->
      <view class="menu-list">
        <view class="menu-item" @tap="goToClockDetail">
          <text class="menu-icon">📋</text>
          <text class="menu-text">打卡记录</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goToDrawFish">
          <text class="menu-icon">🎨</text>
          <text class="menu-text">画鱼</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goToMyFish">
          <text class="menu-icon">🐟</text>
          <text class="menu-text">我的鱼</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goToFishingDetail">
          <text class="menu-icon">🎣</text>
          <text class="menu-text">摸鱼记录</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>
    <CustomTabBar :current="2" />
  </view>
</template>

<script>
import CustomTabBar from '@/components/CustomTabBar.vue'
import { userStore, setUserInfo } from '@/store/user'
import { callFunction } from '@/utils/cloud'

export default {
  components: { CustomTabBar },
  data() {
    return {
      isEditingName: false,
      inputName: '',
      // 本地临时头像（chooseAvatar 返回的是临时路径）
      tempAvatarUrl: '',
    }
  },
  computed: {
    isLogged() {
      return userStore.isLogged
    },
    userInfo() {
      return userStore.userInfo
    },
    avatarUrl() {
      return this.tempAvatarUrl || (userStore.userInfo?.avatarUrl) || ''
    },
    displayName() {
      return userStore.userInfo?.nickName || '未设置昵称'
    },
    userTitle() {
      return userStore.userInfo?.title || '摸鱼新手'
    },
    statusText() {
      if (userStore.isLogging) return '登录中...'
      if (userStore.isLogged) return `ID: ${userStore.openid.slice(-6)}`
      return '请在微信小程序中打开'
    }
  },
  onShow() {
    this.inputName = this.displayName === '摸鱼达人' ? '' : this.displayName
  },
  methods: {
    /** 用户选择头像回调 */
    onChooseAvatar(e) {
      const avatarUrl = e.detail.avatarUrl
      if (!avatarUrl) return

      this.tempAvatarUrl = avatarUrl
      this.saveProfile({ avatarUrl })
    },

    /** 重新选头像（已有头像时点击触发） */
    reChooseAvatar() {
      // #ifdef MP-WEIXIN
      uni.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempFilePath = res.tempFiles[0].tempFilePath
          this.tempAvatarUrl = tempFilePath
          this.saveProfile({ avatarUrl: tempFilePath })
        }
      })
      // #endif
    },

    /** 昵称输入确认 */
    onNicknameConfirm(e) {
      const nickName = (e.detail.value || '').trim()
      this.isEditingName = false
      if (!nickName || nickName === this.displayName) return

      this.inputName = nickName
      this.saveProfile({ nickName })
    },

    /** 上传头像到云存储（Promise 封装） */
    uploadAvatar(filePath) {
      return new Promise((resolve, reject) => {
        // #ifdef MP-WEIXIN
        const cloudPath = `avatars/${userStore.openid}_${Date.now()}.jpg`
        wx.cloud.uploadFile({
          cloudPath,
          filePath,
          success: (res) => resolve(res.fileID),
          fail: (err) => {
            console.error('头像上传失败', err)
            reject(err)
          }
        })
        // #endif
        // #ifndef MP-WEIXIN
        reject(new Error('仅支持微信小程序'))
        // #endif
      })
    },

    /** 判断是否为本地临时文件路径 */
    isLocalFile(path) {
      if (!path) return false
      return path.startsWith('http://tmp') ||
             path.startsWith('wxfile://') ||
             path.startsWith('/tmp') ||
             path.includes('tmp_')
    },

    /** 保存用户资料到云数据库 */
    async saveProfile(updates) {
      if (!userStore.isLogged) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      try {
        // 头像是本地临时文件，需要先上传到云存储
        if (updates.avatarUrl && this.isLocalFile(updates.avatarUrl)) {
          uni.showLoading({ title: '上传头像中...' })
          try {
            const fileID = await this.uploadAvatar(updates.avatarUrl)
            updates.avatarUrl = fileID
          } catch (err) {
            uni.hideLoading()
            // 上传失败，头像先保留本地预览，不写入数据库
            console.warn('头像上传失败，跳过头像更新', err)
            uni.showToast({ title: '头像上传失败，请检查云存储是否已开通', icon: 'none', duration: 3000 })
            delete updates.avatarUrl
            if (Object.keys(updates).length === 0) return
          }
          uni.hideLoading()
        }

        await callFunction('updateProfile', updates)

        // 更新本地状态
        const newInfo = {
          ...userStore.userInfo,
          openid: userStore.openid,
          nickName: updates.nickName || userStore.userInfo?.nickName || '',
          avatarUrl: updates.avatarUrl || userStore.userInfo?.avatarUrl || '',
          points: userStore.userInfo?.points || 0,
          title: userStore.userInfo?.title || '摸鱼新手',
          createTime: userStore.userInfo?.createTime || '',
        }
        setUserInfo(newInfo)
        uni.showToast({ title: '保存成功', icon: 'success' })
      } catch (err) {
        console.error('保存资料失败', err)
        uni.showToast({ title: '保存失败', icon: 'none' })
      }
    },

    goToClockDetail() {
      uni.navigateTo({ url: '/pages/clock-detail/index' })
    },
    goToDrawFish() {
      uni.navigateTo({ url: '/pages/draw-fish/index' })
    },
    goToMyFish() {
      uni.navigateTo({ url: '/pages/my-fish/index' })
    },
    goToFishingDetail() {
      uni.navigateTo({ url: '/pages/fishing-detail/index' })
    }
  }
}
</script>

<style scoped>
.page-container {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(180deg, #FFF6EB 0%, #FFFFFF 100%);
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.page-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: calc(var(--status-bar-height) + 60rpx) 40rpx 40rpx;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40rpx;
}

.avatar-btn {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  line-height: normal;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar-btn::after {
  display: none;
}

.avatar-wrap {
  position: relative;
}

.avatar-img {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  margin-bottom: 16rpx;
  border: 4rpx solid #FD5900;
}

.avatar-placeholder {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #FFF;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8rpx;
  box-shadow: 0 4rpx 20rpx rgba(253, 89, 0, 0.1);
}

.avatar-emoji {
  font-size: 80rpx;
}

.avatar-tip {
  font-size: 22rpx;
  color: #FD5900;
  margin-bottom: 16rpx;
}

.nickname-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 8rpx;
}

.nickname {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.edit-icon {
  font-size: 28rpx;
  color: #999;
}

.nickname-input-wrap {
  margin-bottom: 8rpx;
}

.nickname-input {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  text-align: center;
  width: 400rpx;
  padding: 8rpx 20rpx;
  background: #FFF;
  border-radius: 12rpx;
  border: 2rpx solid #FD5900;
}

.title-badge {
  background: linear-gradient(135deg, #FFDE00, #FD5900);
  border-radius: 20rpx;
  padding: 6rpx 24rpx;
  margin-bottom: 12rpx;
}

.title-text {
  font-size: 22rpx;
  color: #FFF;
  font-weight: 600;
}

.user-status {
  font-size: 24rpx;
  color: #999;
}

.points-card {
  width: 100%;
  background: linear-gradient(135deg, #FFDE00, #FD5900);
  border-radius: 24rpx;
  padding: 32rpx 40rpx;
  margin-bottom: 32rpx;
}

.points-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.points-label {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
}

.points-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #FFF;
}

.menu-list {
  width: 100%;
  background: #FFF;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(253, 89, 0, 0.06);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 32rpx 40rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.menu-text {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.menu-arrow {
  font-size: 36rpx;
  color: #ccc;
}
</style>

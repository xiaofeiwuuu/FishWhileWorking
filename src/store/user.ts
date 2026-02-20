/**
 * 全局用户状态管理
 * 不用 reactive（小程序模块加载时 Vue 可能还没初始化），用普通对象 + getter
 */

export interface UserInfo {
  openid: string
  /** 用户昵称 */
  nickName: string
  avatarUrl: string
  /** 摸鱼积分 */
  points: number
  /** 称号 */
  title: string
  /** 注册时间 */
  createTime: string
}

interface UserState {
  isLogged: boolean
  isLogging: boolean
  openid: string
  userInfo: UserInfo | null
}

/** 全局用户状态（普通对象，跨页面共享） */
export const userStore: UserState = {
  isLogged: false,
  isLogging: false,
  openid: '',
  userInfo: null,
}

/** 设置登录结果 */
export function setLoginResult(openid: string) {
  userStore.openid = openid
  userStore.isLogged = true
  userStore.isLogging = false
  uni.setStorageSync('openid', openid)
}

/** 设置用户信息 */
export function setUserInfo(info: UserInfo) {
  userStore.userInfo = info
  uni.setStorageSync('userInfo', info)
}

/** 从本地缓存恢复状态 */
export function restoreFromCache() {
  const openid = uni.getStorageSync('openid')
  const userInfo = uni.getStorageSync('userInfo')
  if (openid) {
    userStore.openid = openid
    userStore.isLogged = true
  }
  if (userInfo) {
    userStore.userInfo = userInfo
  }
}

/** 清除登录状态 */
export function clearUser() {
  userStore.isLogged = false
  userStore.isLogging = false
  userStore.openid = ''
  userStore.userInfo = null
  uni.removeStorageSync('openid')
  uni.removeStorageSync('userInfo')
}

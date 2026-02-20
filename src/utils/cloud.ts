/**
 * 微信云开发封装
 * - callFunction: 调用云函数
 * - db: 云数据库快捷访问
 */

// TODO: 替换为你的云开发环境 ID（在微信开发者工具 → 云开发 → 设置中获取）
export const CLOUD_ENV = 'cloud1-1g3vf8t32099909f'

let cloudInited = false

/** 初始化云开发（App.vue onLaunch 中调用一次） */
export function initCloud() {
  if (cloudInited) return

  // #ifdef MP-WEIXIN
  if (!wx.cloud) {
    console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    return
  }
  wx.cloud.init({
    env: CLOUD_ENV,
    traceUser: true, // 自动记录用户访问
  })
  cloudInited = true
  console.log('[cloud] 云开发初始化完成')
  // #endif
}

/** 调用云函数（统一封装） */
export function callFunction<T = any>(name: string, data?: Record<string, any>): Promise<T> {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    wx.cloud.callFunction({
      name,
      data,
      success: (res: any) => {
        console.log(`[cloud] ${name} 调用成功`, res.result)
        resolve(res.result as T)
      },
      fail: (err: any) => {
        console.error(`[cloud] ${name} 调用失败`, err)
        uni.showToast({ title: '云函数调用失败', icon: 'none' })
        reject(err)
      },
    })
    // #endif

    // #ifndef MP-WEIXIN
    console.warn('[cloud] 当前平台不支持云开发，仅微信小程序可用')
    reject(new Error('当前平台不支持云开发'))
    // #endif
  })
}

/** 获取云数据库引用 */
export function getDb() {
  // #ifdef MP-WEIXIN
  return wx.cloud.database()
  // #endif

  // #ifndef MP-WEIXIN
  console.warn('[cloud] 当前平台不支持云数据库')
  return null as any
  // #endif
}

/** 获取数据库集合引用的快捷方法 */
export function collection(name: string) {
  return getDb().collection(name)
}

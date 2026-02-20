// 云函数：saveSettings
// 功能：保存/读取用户工作设置
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action, settings } = event

  try {
    if (action === 'get') {
      // 读取设置
      const res = await db.collection('settings').where({ openid }).get()
      if (res.data.length > 0) {
        return { code: 0, data: res.data[0].settings, message: '获取成功' }
      }
      return { code: 0, data: null, message: '暂无云端设置' }
    }

    if (action === 'save') {
      // 保存设置：有则更新，无则新建
      const res = await db.collection('settings').where({ openid }).get()

      if (res.data.length > 0) {
        await db.collection('settings').where({ openid }).update({
          data: {
            settings,
            updateTime: new Date().toISOString(),
          }
        })
      } else {
        await db.collection('settings').add({
          data: {
            openid,
            settings,
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
          }
        })
      }

      return { code: 0, data: null, message: '保存成功' }
    }

    return { code: -1, data: null, message: '未知操作' }
  } catch (err) {
    console.error('saveSettings error:', err)
    return { code: -1, data: null, message: err.message || '操作失败' }
  }
}

// 云函数：updateProfile
// 功能：更新用户昵称、头像等资料
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 只允许更新白名单字段
  const allowedFields = ['nickName', 'avatarUrl']
  const updates = {}
  for (const key of allowedFields) {
    if (event[key] !== undefined) {
      updates[key] = event[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return { code: -1, message: '没有需要更新的字段' }
  }

  updates.updateTime = new Date().toISOString()

  try {
    const res = await db.collection('users').where({ openid }).update({
      data: updates
    })

    return {
      code: 0,
      data: { updated: res.stats.updated },
      message: '更新成功'
    }
  } catch (err) {
    console.error('updateProfile error:', err)
    return {
      code: -1,
      data: null,
      message: '更新失败'
    }
  }
}

// 云函数：login
// 功能：获取用户 openid，查询/创建用户记录
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 查询用户是否已存在
    const userRes = await db.collection('users').where({ openid }).get()

    if (userRes.data.length === 0) {
      // 新用户，创建记录
      const now = new Date().toISOString()
      await db.collection('users').add({
        data: {
          openid,
          nickName: '',
          avatarUrl: '',
          points: 0,
          title: '摸鱼新手',
          createTime: now,
          updateTime: now,
        }
      })

      return {
        code: 0,
        data: {
          openid,
          nickName: '',
          avatarUrl: '',
          points: 0,
          title: '摸鱼新手',
          createTime: now,
          isNewUser: true,
        },
        message: '注册成功'
      }
    }

    // 老用户，返回信息，根据积分计算称号
    const user = userRes.data[0]
    const points = user.points || 0
    let title = '摸鱼新手'
    if (points >= 1000) title = '摸鱼大师'
    else if (points >= 500) title = '摸鱼专家'
    else if (points >= 100) title = '摸鱼达人'

    return {
      code: 0,
      data: {
        openid,
        nickName: user.nickName || '',
        avatarUrl: user.avatarUrl || '',
        points,
        title,
        createTime: user.createTime || '',
        isNewUser: false,
      },
      message: '登录成功'
    }
  } catch (err) {
    console.error('login error:', err)
    return {
      code: -1,
      data: { openid },
      message: '登录处理失败'
    }
  }
}

// 云函数：saveFish
// 功能：保存/删除用户绘制的鱼（fishes 集合 + 云存储图片）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action = 'save', fileID, fishId } = event

  try {
    // ========== save: 保存鱼 ==========
    if (action === 'save') {
      if (!fileID) {
        return { code: -1, data: null, message: '缺少 fileID 参数' }
      }

      const result = await db.collection('fishes').add({
        data: {
          openid,
          fileID,
          likes: 0,
          createdAt: new Date().toISOString(),
        }
      })

      return { code: 0, data: { _id: result._id }, message: '保存成功' }
    }

    // ========== delete: 删除鱼（数据库记录 + 云存储图片） ==========
    if (action === 'delete') {
      if (!fishId) {
        return { code: -1, data: null, message: '缺少 fishId 参数' }
      }

      // 先查出记录，获取 fileID（确保是自己的鱼）
      const res = await db.collection('fishes').doc(fishId).get()
      const fish = res.data

      if (!fish || fish.openid !== openid) {
        return { code: -1, data: null, message: '记录不存在或无权删除' }
      }

      // 删除云存储图片
      if (fish.fileID) {
        await cloud.deleteFile({ fileList: [fish.fileID] })
      }

      // 删除数据库记录
      await db.collection('fishes').doc(fishId).remove()

      // 同时删除该鱼的所有点赞记录
      await db.collection('fish_likes').where({ fishId }).remove()

      return { code: 0, data: null, message: '删除成功' }
    }

    // ========== list: 获取鱼列表（公共鱼缸，不限 openid） ==========
    if (action === 'list') {
      const res = await db.collection('fishes')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get()
      return { code: 0, data: res.data, message: '查询成功' }
    }

    // ========== like: 点赞 ==========
    if (action === 'like') {
      if (!fishId) {
        return { code: -1, data: null, message: '缺少 fishId 参数' }
      }

      // 检查是否已赞
      const existing = await db.collection('fish_likes')
        .where({ fishId, openid })
        .limit(1)
        .get()

      if (existing.data.length > 0) {
        return { code: 0, data: null, message: '已经点过赞了' }
      }

      // 写入点赞记录
      await db.collection('fish_likes').add({
        data: { fishId, openid, createdAt: new Date().toISOString() }
      })

      // fishes.likes 自增 1
      await db.collection('fishes').doc(fishId).update({
        data: { likes: _.inc(1) }
      })

      // 返回最新赞数
      const fishRes = await db.collection('fishes').doc(fishId).get()
      return { code: 0, data: { likes: fishRes.data.likes || 1 }, message: '点赞成功' }
    }

    // ========== unlike: 取消点赞 ==========
    if (action === 'unlike') {
      if (!fishId) {
        return { code: -1, data: null, message: '缺少 fishId 参数' }
      }

      // 删除点赞记录
      const delRes = await db.collection('fish_likes')
        .where({ fishId, openid })
        .remove()

      if (delRes.stats.removed === 0) {
        return { code: 0, data: null, message: '未点过赞' }
      }

      // fishes.likes 自减 1
      await db.collection('fishes').doc(fishId).update({
        data: { likes: _.inc(-1) }
      })

      // 返回最新赞数
      const fishRes = await db.collection('fishes').doc(fishId).get()
      return { code: 0, data: { likes: Math.max(fishRes.data.likes || 0, 0) }, message: '取消成功' }
    }

    // ========== listMine: 获取当前用户自己的鱼 ==========
    if (action === 'listMine') {
      const res = await db.collection('fishes')
        .where({ openid })
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
      return { code: 0, data: res.data, message: '查询成功' }
    }

    // ========== listMyLikes: 获取当前用户已赞的 fishId 列表 ==========
    if (action === 'listMyLikes') {
      const res = await db.collection('fish_likes')
        .where({ openid })
        .limit(100)
        .get()
      const fishIds = res.data.map(item => item.fishId)
      return { code: 0, data: fishIds, message: '查询成功' }
    }

    return { code: -1, data: null, message: '未知操作' }
  } catch (err) {
    console.error('saveFish error:', err)
    return { code: -1, data: null, message: err.message || '操作失败' }
  }
}

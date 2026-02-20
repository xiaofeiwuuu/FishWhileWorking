// 云函数：syncFishRecords
// 功能：摸鱼记录的云端同步（月度聚合，1 个用户 1 个月 1 条文档）
// 集合：fish_records
// 文档结构：{ openid, month, days: { "18": { "0":5,"1":3,"2":2, total:10, earned:12.5 }, ... }, totalMinutes, totalEarned, updateTime }

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action, month, dayKey, dayData, hourlyWage } = event

  try {
    // ========== get: 获取某月记录 ==========
    if (action === 'get') {
      // month: "2026-02"
      if (!month) return { code: -1, data: null, message: '缺少 month 参数' }

      const res = await db.collection('fish_records')
        .where({ openid, month })
        .get()

      if (res.data.length > 0) {
        return { code: 0, data: res.data[0], message: '获取成功' }
      }
      return { code: 0, data: null, message: '该月暂无记录' }
    }

    // ========== save: 更新当天记录（增量合并到月文档） ==========
    if (action === 'save') {
      // dayKey: "18" (日期)
      // dayData: { "0": 5, "1": 3, "2": 2 } (各分类分钟数)
      // hourlyWage: 时薪（用于计算摸鱼金额）
      // month: "2026-02"
      if (!month || !dayKey || !dayData) {
        return { code: -1, data: null, message: '缺少必要参数' }
      }

      // 计算当天汇总
      const total = Object.values(dayData).reduce((s, v) => s + (Number(v) || 0), 0)
      const wage = Number(hourlyWage) || 0
      const earned = wage > 0 ? Number((total * 60 * (wage / 3600)).toFixed(2)) : 0

      const fullDayData = { ...dayData, total, earned }

      // 查询该月文档是否存在
      const res = await db.collection('fish_records')
        .where({ openid, month })
        .get()

      if (res.data.length > 0) {
        // 存在 → 更新该天数据，重算月汇总
        const doc = res.data[0]
        const days = doc.days || {}
        days[dayKey] = fullDayData

        // 重算月汇总
        let totalMinutes = 0
        let totalEarned = 0
        for (const d of Object.values(days)) {
          totalMinutes += d.total || 0
          totalEarned += d.earned || 0
        }
        totalEarned = Number(totalEarned.toFixed(2))

        await db.collection('fish_records')
          .where({ openid, month })
          .update({
            data: {
              [`days.${dayKey}`]: fullDayData,
              totalMinutes,
              totalEarned,
              updateTime: new Date().toISOString(),
            }
          })

        return { code: 0, data: null, message: '更新成功' }
      } else {
        // 不存在 → 新建月文档
        await db.collection('fish_records').add({
          data: {
            openid,
            month,
            days: { [dayKey]: fullDayData },
            totalMinutes: total,
            totalEarned: earned,
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
          }
        })
        return { code: 0, data: null, message: '新建月记录成功' }
      }
    }

    // ========== history: 获取历史月份列表 ==========
    if (action === 'history') {
      // 获取该用户所有月份记录（只返回汇总，不返回 days 明细）
      const res = await db.collection('fish_records')
        .where({ openid })
        .field({ month: true, totalMinutes: true, totalEarned: true, updateTime: true })
        .orderBy('month', 'desc')
        .limit(24) // 最多 2 年
        .get()

      return { code: 0, data: res.data, message: '获取历史成功' }
    }

    return { code: -1, data: null, message: '未知操作' }
  } catch (err) {
    console.error('syncFishRecords error:', err)
    return { code: -1, data: null, message: err.message || '操作失败' }
  }
}

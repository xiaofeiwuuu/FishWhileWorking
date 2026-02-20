// 云函数：getHolidays
// 逻辑：数据库优先 → 没有则请求 timor.tech API → 存回数据库 → 返回
const cloud = require('wx-server-sdk')
const http = require('http')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 请求 timor.tech 节假日 API
 * @param {string} year 年份，如 '2026'
 * @returns {Promise<object>} API 返回的 holiday 对象
 */
function fetchFromAPI(year) {
  return new Promise((resolve, reject) => {
    const url = `http://timor.tech/api/holiday/year/${year}?type=Y&week=Y`
    http.get(url, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.code === 0 && json.holiday) {
            resolve(json)
          } else {
            reject(new Error('API 返回异常: ' + data))
          }
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

/**
 * 将 API 原始数据转为结构化的节假日列表
 * 连续同名假期合并为一段
 */
// 已知的大节名称映射：把子名称归到主节日
const HOLIDAY_GROUP = {
  '除夕': '春节', '初一': '春节', '初二': '春节', '初三': '春节',
  '初四': '春节', '初五': '春节', '初六': '春节', '初七': '春节',
}

function getMainName(name) {
  return HOLIDAY_GROUP[name] || name
}

function nextDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseHolidays(apiData, year) {
  const holiday = apiData.holiday
  const typeInfo = apiData.type || {}

  // 按日期排序
  const entries = Object.entries(holiday).sort((a, b) => a[0].localeCompare(b[0]))

  const holidays = []
  let current = null

  for (const [key, val] of entries) {
    const fullDate = `${year}-${key}`
    const dayType = typeInfo[fullDate]
    // type 2 = 节假日，跳过调休(3)和普通周末
    const isRealHoliday = dayType && dayType.type === 2

    if (!isRealHoliday) continue

    const mainName = getMainName(val.name)

    // 日期连续 且 属于同一个大节 → 合并
    if (current && mainName === current.name && fullDate === nextDay(current.endDate)) {
      current.endDate = fullDate
      current.totalDays += 1
      current.wage = Math.max(current.wage, val.wage)
    } else {
      if (current) holidays.push(current)
      current = {
        name: mainName,
        startDate: fullDate,
        endDate: fullDate,
        totalDays: 1,
        wage: val.wage,
      }
    }
  }
  if (current) holidays.push(current)

  return holidays
}

exports.main = async (event) => {
  const { year: requestYear } = event
  const year = requestYear || new Date().getFullYear().toString()

  try {
    // 1. 先查数据库
    const cacheRes = await db.collection('holidays')
      .where({ year })
      .limit(1)
      .get()

    if (cacheRes.data.length > 0) {
      const cached = cacheRes.data[0]
      return { code: 0, data: cached.holidays, year, source: 'db' }
    }

    // 2. 数据库没有，请求 API
    const apiData = await fetchFromAPI(year)
    const holidays = parseHolidays(apiData, year)

    // 3. 存入数据库
    await db.collection('holidays').add({
      data: {
        year,
        holidays,
        raw: apiData.holiday,
        fetchedAt: new Date().toISOString(),
      }
    })

    return { code: 0, data: holidays, year, source: 'api' }
  } catch (err) {
    console.error('getHolidays error:', err)
    return { code: -1, data: null, message: err.message || '获取节假日失败' }
  }
}

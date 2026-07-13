import React, { useState, useEffect } from 'react'

export default function Dashboard() {
  const [appMode, setAppMode] = useState(null)
  const [scraperState, setScraperState] = useState({ status: 'idle', logs: [] })
  
  // 🌓 CORE STATE THEME MANAGEMENT (No Tailwind configuration changes required)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme')
      if (saved) return saved === 'dark'
      return !window.matchMedia('(prefers-color-scheme: light)').matches
    }
    return true
  })

  // Cache settings locally when updated
  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // Dynamic conditional class blocks for global context rules
  const themeContainer = isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
  const themeCard      = isDark ? 'bg-slate-900 border-slate-800/80 shadow-2xl' : 'bg-white border-slate-200 shadow-xl'
  const themeInput     = isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
  const themeSubtext   = isDark ? 'text-slate-400' : 'text-slate-500'
  const themeBadge     = isDark ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-slate-100 border-slate-200 text-blue-600'
  const themeTableBox  = isDark ? 'border-slate-800/80 bg-slate-950' : 'border-slate-200 bg-slate-50'
  const themeTh        = isDark ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
  const themeTrHover   = isDark ? 'hover:bg-slate-900/40 divide-slate-900 text-slate-300' : 'hover:bg-slate-100/50 divide-slate-200 text-slate-700'
  const themeInnerCard = isDark ? 'bg-slate-950 border-slate-900' : 'bg-slate-50 border-slate-200'

  // 🟢 CREDENTIAL MANAGEMENT STATES
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [savedUser, setSavedUser] = useState(() => localStorage.getItem('cybage_user') || '')

  const [attendanceData, setAttendanceData] = useState(
    () => JSON.parse(localStorage.getItem('cybage_attendance')) || []
  )
  const [timetableData, setTimetableData] = useState(
    () => JSON.parse(localStorage.getItem('cybage_timetable')) || []
  )
  const [metrics, setMetrics] = useState({
    today: '00h 00m',
    status: 'No Data',
    rawSeconds: 0,
    isWfh: false,
    exitTime: 'N/A'
  })
  const [reports, setReports] = useState({ daily: [], weekly: [] })

  const parseHoursToFloat = (timeStr) => {
    if (!timeStr || ['N/A', ''].includes(timeStr)) return 0.0
    try {
      const cleanStr = String(timeStr).trim()
      const parts = cleanStr.includes(':') ? cleanStr.split(':') : [cleanStr, '0']
      
      const hours = parseInt(parts[0], 10) || 0
      const minutes = parseInt(parts[1], 10) || 0
      
      return hours + (minutes / 60.0)
    } catch {
      return 0.0
    }
  }

  const formatHhmm = (val) => {
    let h = Math.floor(val)
    let m = Math.round((val - h) * 60)
    if (m === 60) {
      h += 1
      m = 0
    }
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  const parseCustomDateTime = (dateStr, timeStr) => {
    try {
      const dateParts = dateStr.split('-') 
      const timeParts = timeStr.split(' ')[0].split(':') 
      const isPm = timeStr.toLowerCase().includes('pm')
      
      const monthMap = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
      }
      
      let hours = parseInt(timeParts[0], 10)
      if (isPm && hours < 12) hours += 12
      if (!isPm && hours === 12) hours = 0
      
      return new Date(
        parseInt(dateParts[2], 10),
        monthMap[dateParts[1]],
        parseInt(dateParts[0], 10),
        hours,
        parseInt(timeParts[1], 10) || 0,
        parseInt(timeParts[2], 10) || 0
      )
    } catch {
      return new Date()
    }
  }

  useEffect(() => {
    if (attendanceData.length === 0 && timetableData.length === 0) return

    const now = new Date()
    const currentMonth = now.toLocaleString('default', { month: 'short' })
    const currentYear = now.getFullYear().toString()
    const todayStr = `${now.getDate().toString().padStart(2, '0')}-${currentMonth}-${currentYear}`

    // 1. DATE NORMALIZER
    const normalizeToDdmmyyyy = (dateStr) => {
      if (!dateStr) return ''
      const clean = String(dateStr).replace(/[\s/]/g, '-').trim()
      const parts = clean.split('-')
      if (parts.length < 3) return clean
      if (isNaN(parts[1])) {
        const capitalizedMonth = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase()
        return `${parts[0].padStart(2, '0')}-${capitalizedMonth}-${parts[2]}`
      }
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthIdx = parseInt(parts[1], 10) - 1
      if (monthIdx >= 0 && monthIdx < 12) return `${parts[0].padStart(2, '0')}-${months[monthIdx]}-${parts[2]}`
      return clean
    }

    const swipeTotalsByDateStr = {}
    const daysGroup = {}
    let isCurrentlyInToday = false
    let isWfhToday = false
    let todayLiveSeconds = 0

    timetableData.forEach((log) => {
      if (!log || !log['Machine Name'] || !log['Date'] || !log['Time']) return
      const localizedKey = normalizeToDdmmyyyy(log.Date)
      if (!daysGroup[localizedKey]) daysGroup[localizedKey] = []
      daysGroup[localizedKey].push({ ...log, Date: localizedKey })
    })

    Object.keys(daysGroup).forEach((dStr) => {
      const sortedLogs = daysGroup[dStr].sort((a, b) => {
        return parseCustomDateTime(a.Date, a.Time) - parseCustomDateTime(b.Date, b.Time)
      })
      let totalSeconds = 0
      let currentInTime = null

      sortedLogs.forEach((log) => {
        const machine = String(log['Machine Name']).toLowerCase()
        
        // 2. STRICT MACHINE FILTER (No Main Gate allowed!)
        if ((machine.includes('tripod') || machine.includes('barrier') || machine.includes('basement')) && !machine.includes('main gate')) {
          const logTime = parseCustomDateTime(log.Date, log.Time)
          const direction = String(log.Direction).trim().toLowerCase()

          if (dStr === todayStr && machine.includes('wfh')) isWfhToday = true

          if (direction === 'entry') {
            currentInTime = logTime
          } else if (direction === 'exit' && currentInTime) {
            totalSeconds += (logTime - currentInTime) / 1000
            currentInTime = null
          }
        }
      })

      if (currentInTime) {
        if (dStr === todayStr && !isWfhToday) {
          isCurrentlyInToday = true
          const runningDiff = (new Date() - currentInTime) / 1000
          if (runningDiff > 0) totalSeconds += runningDiff
        }
      }

      if (dStr === todayStr) {
        todayLiveSeconds = totalSeconds
      }

      swipeTotalsByDateStr[dStr] = totalSeconds / 3600
    })

    let dailyLogs = []
    let weeklyTotals = {}
    const processedDates = new Set() // Track portal dates

    const getWeekRangeString = (targetDate) => {
      const dayOfWeek = targetDate.getDay()
      const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const monday = new Date(targetDate)
      monday.setDate(targetDate.getDate() - distanceToMonday)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)

      const opt = { month: 'short', day: 'numeric' }
      return {
        weekStr: `${monday.toLocaleDateString('en-US', opt)} - ${sunday.toLocaleDateString('en-US', opt)}`,
        mondayRef: monday
      }
    }

    attendanceData.forEach((row) => {
      if (!row) return
      const dateStr = row['Date']
      let hoursStr = row['Actual Working Hours - Swipes (A)'] || '00:00'
      let wfhStr = row['Actual Working Hours - WFH (B)'] || '00:00'
      const status = String(row['Status'] || '').toLowerCase()
      if (!dateStr || dateStr === 'N/A') return

      const dateParts = dateStr.split('-')
      if (dateParts.length < 3) return

      processedDates.add(dateStr)

      let dailyOffice = parseHoursToFloat(hoursStr)
      let dailyWfh = parseHoursToFloat(wfhStr)

      if (swipeTotalsByDateStr[dateStr] > 0) {
        if (dateStr === todayStr) {
          if (isWfhToday) {
            dailyWfh = swipeTotalsByDateStr[dateStr]
            wfhStr = formatHhmm(dailyWfh)
          } else {
            dailyOffice = swipeTotalsByDateStr[dateStr]
            hoursStr = formatHhmm(dailyOffice)
          }
        } else if (dailyOffice === 0) {
          dailyOffice = swipeTotalsByDateStr[dateStr]
          hoursStr = formatHhmm(dailyOffice)
        }
      }

      if (status.includes('holiday') || status.includes('leave')) {
        dailyOffice += 8.0
      }
      let dailyTotal = dailyOffice + dailyWfh

      if (dateParts[1] === currentMonth && dateParts[2] === currentYear) {
        let displayHours = appMode === 'wfo' ? hoursStr : `🏢 ${hoursStr}  |  🏠 ${wfhStr}`
        if (status.includes('holiday')) displayHours += ' (+8h Hol)'
        else if (status.includes('leave')) displayHours += ' (+8h Leave)'
        
        dailyLogs.push({ date: dateStr, hours: displayHours + (dateStr === todayStr ? ' (Live)' : ''), status: row['Status'] || 'Regular' })
      }

      const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
      const rowDate = new Date(parseInt(dateParts[2], 10), monthMap[dateParts[1]], parseInt(dateParts[0], 10))

      if (!isNaN(rowDate)) {
        const { weekStr, mondayRef } = getWeekRangeString(rowDate)
        if (!weeklyTotals[weekStr]) {
          weeklyTotals[weekStr] = { office: 0, wfh: 0, total: 0, sortDate: mondayRef }
        }
        weeklyTotals[weekStr].office += dailyOffice
        weeklyTotals[weekStr].wfh += dailyWfh
        weeklyTotals[weekStr].total += dailyTotal
      }
    })

    // 3. UNIVERSAL MISSING DATE INJECTION
    Object.keys(swipeTotalsByDateStr).forEach((missingDateStr) => {
      if (!processedDates.has(missingDateStr)) {
        const totalSecs = swipeTotalsByDateStr[missingDateStr] * 3600
        const isThisToday = missingDateStr === todayStr

        if (totalSecs > 0 || isThisToday) {
          let dailyOffice = (isThisToday && isWfhToday) ? 0 : (totalSecs / 3600)
          let dailyWfh = (isThisToday && isWfhToday) ? (totalSecs / 3600) : 0
          const currentHoursFormatted = formatHhmm(totalSecs / 3600)

          let displayHours = appMode === 'wfo'
              ? currentHoursFormatted
              : (isThisToday && isWfhToday) ? `🏢 00:00  |  🏠 ${currentHoursFormatted}` : `🏢 ${currentHoursFormatted}  |  🏠 00:00`
              
          const dateParts = missingDateStr.split('-')
          
          if (dateParts[1] === currentMonth && dateParts[2] === currentYear) {
            dailyLogs.push({ 
              date: missingDateStr, 
              hours: displayHours + (isThisToday ? ' (Live)' : ' (Calc from Logs)'), 
              status: 'Processing...' 
            })
          }

          const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
          const rowDate = new Date(parseInt(dateParts[2], 10), monthMap[dateParts[1]], parseInt(dateParts[0], 10))
          
          if (!isNaN(rowDate)) {
            const { weekStr, mondayRef } = getWeekRangeString(rowDate)
            if (!weeklyTotals[weekStr]) {
              weeklyTotals[weekStr] = { office: 0, wfh: 0, total: 0, sortDate: mondayRef }
            }
            weeklyTotals[weekStr].office += dailyOffice
            weeklyTotals[weekStr].wfh += dailyWfh
            weeklyTotals[weekStr].total += dailyOffice + dailyWfh
          }
        }
      }
    })

    // Standardized 8-Hour Daily Calculation Rule
    let formattedExitTime = 'N/A'
    const targetSecondsToday = 8 * 3600 

    if (isWfhToday && appMode === 'wfh') {
      formattedExitTime = 'N/A (WFH)'
    } else if (todayLiveSeconds >= targetSecondsToday) {
      formattedExitTime = '✅ Target Met'
    } else if (isCurrentlyInToday) {
      const remainingSeconds = targetSecondsToday - todayLiveSeconds
      const exitDateObj = new Date(now.getTime() + remainingSeconds * 1000)
      
      let extHours = exitDateObj.getHours()
      const extMinutes = exitDateObj.getMinutes()
      const ampm = extHours >= 12 ? 'PM' : 'AM'
      extHours = extHours % 12
      extHours = extHours ? extHours : 12 
      
      formattedExitTime = `${extHours.toString().padStart(2, '0')}:${extMinutes.toString().padStart(2, '0')} ${ampm}`
    }

    let totalLiveHoursDecimal = todayLiveSeconds / 3600
    let tHours = Math.floor(totalLiveHoursDecimal)
    let tMinutes = Math.round((totalLiveHoursDecimal - tHours) * 60)
    if (tMinutes === 60) {
      tHours += 1
      tMinutes = 0
    }

    setMetrics({
      today: `${tHours.toString().padStart(2, '0')}h ${tMinutes.toString().padStart(2, '0')}m`,
      status: isCurrentlyInToday ? 'IN' : isWfhToday ? 'WFH' : todayLiveSeconds > 0 ? 'OUT' : 'No Swipes',
      rawSeconds: todayLiveSeconds,
      isWfh: isWfhToday,
      exitTime: formattedExitTime
    })

    dailyLogs.sort((a, b) => {
      const parseStrDate = (s) => {
        const p = s.replace(' (Live)', '').replace(' (Calc from Logs)', '').split('-')
        const m = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 }
        return new Date(parseInt(p[2]), m[p[1]], parseInt(p[0]))
      }
      return parseStrDate(b.date) - parseStrDate(a.date)
    })

    setReports({ daily: dailyLogs, weekly: Object.keys(weeklyTotals).sort((a, b) => weeklyTotals[a].sortDate - weeklyTotals[b].sortDate).map((wk) => {
        let totals = weeklyTotals[wk]
        let isWfoMode = appMode === 'wfo'
        let rem = isWfoMode ? Math.max(0, 24 - totals.office) : Math.max(0, 40 - totals.total)
        return {
          week: wk,
          total: isWfoMode ? `${formatHhmm(totals.office)} / 24 hrs` : `🏢 ${formatHhmm(totals.office)} │ 🏠 ${formatHhmm(totals.wfh)} (Total: ${formatHhmm(totals.total)}/40)`,
          remaining: rem > 0 ? `${formatHhmm(rem)} left` : '✅ Target Met'
        }
      })
    })

  }, [attendanceData, timetableData, appMode])

  useEffect(() => {
    if (timetableData.length === 0) return
    const interval = setInterval(() => {
      setTimetableData(prev => [...prev])
    }, 1000)
    return () => clearInterval(interval)
  }, [timetableData])

  useEffect(() => {
    if (!appMode) return
    window.electronAPI.getScraperData().then((data) => handleSyncUpdate(data))
    const unsubscribe = window.electronAPI.onScraperUpdate((data) => handleSyncUpdate(data))

    function handleSyncUpdate(data) {
      if (!data) return
      setScraperState(data.scraper)
      if (data.scraper.status === 'success' && data.payload && data.payload.attendance_rows.length > 0) {
        localStorage.setItem('cybage_attendance', JSON.stringify(data.payload.attendance_rows))
        localStorage.setItem('cybage_timetable', JSON.stringify(data.payload.timetable_rows))
        setAttendanceData(data.payload.attendance_rows)
        setTimetableData(data.payload.timetable_rows)
      }
    }
    return () => unsubscribe()
  }, [appMode])

  const handleHardRefresh = async () => {
    const user = localStorage.getItem('cybage_user')
    const pass = localStorage.getItem('cybage_pass')
    if (!user || !pass) { setShowAuthModal(true); return; }
    setScraperState({ status: 'running', logs: ['Dispatched browser refresh pipeline call...'] })
    await window.electronAPI.triggerRefresh(appMode, { username: user, password: pass })
  }

  const saveCredentials = () => {
    if (!usernameInput || !passwordInput) return
    localStorage.setItem('cybage_user', usernameInput)
    localStorage.setItem('cybage_pass', passwordInput)
    setSavedUser(usernameInput)
    setShowAuthModal(false)
    setScraperState({ status: 'running', logs: ['Dispatched browser refresh pipeline call...'] })
    window.electronAPI.triggerRefresh(appMode, { username: usernameInput, password: passwordInput })
  }

  const clearCredentials = () => {
    localStorage.removeItem('cybage_user')
    localStorage.removeItem('cybage_pass')
    setSavedUser('')
    setUsernameInput('')
    setPasswordInput('')
  }

  // Floating Theme Toggle Button
  const themeToggleBtn = (
    <button 
      onClick={() => setIsDark(!isDark)} 
      className={`fixed bottom-4 right-4 p-3 rounded-full shadow-2xl border transition-all hover:scale-110 active:scale-95 cursor-pointer z-50 text-base ${isDark ? 'bg-slate-900 border-slate-800 text-yellow-400' : 'bg-white border-slate-200 text-slate-700'}`}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )

  if (!appMode) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 antialiased transition-colors duration-200 ${themeContainer}`}>
        <div className={`max-w-md w-full rounded-2xl p-8 space-y-6 border ring-1 ring-black/5 dark:ring-white/5 ${themeCard}`}>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 dark:from-blue-400 dark:via-indigo-400 dark:to-emerald-400 bg-clip-text text-transparent">
              Cybage Attendance Hub
            </h1>
            <p className={`text-xs ${themeSubtext}`}>Select your workspace engine calculation metric</p>
          </div>
          
          <div className="flex flex-col gap-3 pt-2">
            <button onClick={() => setAppMode('wfo')} className={`group relative p-4 rounded-xl text-left transition-all shadow-md active:scale-[0.99] cursor-pointer border ${isDark ? 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-750 hover:to-slate-800 border-slate-700/60' : 'bg-gradient-to-b from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-250 border-slate-300/60'}`}>
              <p className={`font-semibold text-center text-sm transition-colors ${isDark ? 'group-hover:text-blue-400' : 'group-hover:text-blue-600'}`}>🏢 Regular Office Tracking (WFO)</p>
            </button>
            <button onClick={() => setAppMode('wfh')} className={`group relative p-4 rounded-xl text-left transition-all shadow-md active:scale-[0.99] cursor-pointer border ${isDark ? 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-750 hover:to-slate-800 border-slate-700/60' : 'bg-gradient-to-b from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-250 border-slate-300/60'}`}>
              <p className={`font-semibold text-center text-sm transition-colors ${isDark ? 'group-hover:text-emerald-400' : 'group-hover:text-emerald-600'}`}>🏠 Hybrid Tracking (WFO + WFH)</p>
            </button>
          </div>

          <div className={`pt-5 border-t text-left space-y-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <p className={`text-[11px] font-bold uppercase tracking-widest ${themeSubtext}`}>Account Details</p>
            {savedUser ? (
              <div className={`flex justify-between items-center p-3 rounded-xl border ${themeInnerCard}`}>
                <span className={`text-xs truncate max-w-[200px] ${themeSubtext}`}>👤 Caching Active: <b className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{savedUser}</b></span>
                <button onClick={clearCredentials} className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-[0.98] cursor-pointer border ${isDark ? 'bg-red-950/30 hover:bg-red-900/40 border-red-900/40 text-red-400' : 'bg-red-100 hover:bg-red-200 border-red-200 text-red-600'}`}>Wipe Data</button>
              </div>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className={`w-full text-xs font-medium p-3 rounded-xl transition-all text-center cursor-pointer border ${isDark ? 'bg-slate-950 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200' : 'bg-slate-100 border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700'}`}>
                ➕ Configure MIS Portal Logins
              </button>
            )}
          </div>
        </div>

        {showAuthModal && (
          <div className={`fixed inset-0 backdrop-blur-md flex items-center justify-center p-4 z-50 ${isDark ? 'bg-slate-950/80' : 'bg-slate-900/40'}`}>
            <div className={`border p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${themeCard}`}>
              <div className="space-y-1">
                <h3 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>MIS Authorization Profile</h3>
                <p className={`text-xs ${themeSubtext}`}>Credentials will be cached inside localized sandbox boundaries securely.</p>
              </div>
              <input type="text" placeholder="Username" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className={`w-full focus:border-blue-500 focus:outline-none p-3 rounded-xl text-sm transition-colors border ${themeInput}`} />
              <input type="password" placeholder="Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className={`w-full focus:border-blue-500 focus:outline-none p-3 rounded-xl text-sm transition-colors border ${themeInput}`} />
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAuthModal(false)} className={`flex-1 text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer ${isDark ? 'bg-slate-800 hover:bg-slate-750 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>Cancel</button>
                <button onClick={saveCredentials} className="flex-1 bg-blue-600 hover:bg-blue-500 text-sm font-medium py-2.5 rounded-xl text-white transition-colors cursor-pointer">Save & Sync</button>
              </div>
            </div>
          </div>
        )}
        {themeToggleBtn}
      </div>
    )
  }

  return (
    <div className={`min-h-screen p-4 sm:p-8 antialiased selection:bg-blue-500/30 transition-colors duration-200 ${themeContainer}`}>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* TOP METRIC PANEL BAR */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${themeCard}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            
            {/* LEFT SYSTEM LOGO & PROFILE TOGGLE */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 min-w-0">
              <button 
                onClick={() => setAppMode(null)} 
                className={`border px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  isDark 
                    ? 'bg-slate-800 hover:bg-slate-750 border-slate-700/50 text-slate-300' 
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
                }`}
              >
                ← <span className="hidden xs:inline">Change Profile</span><span className="xs:hidden">Back</span>
              </button>
              
              <div className="min-w-0 flex items-center gap-2">
                <h1 className={`text-lg sm:text-xl font-bold tracking-tight truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  Cybage Tracker
                </h1>
                <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded shrink-0 ${themeBadge}`}>
                  {appMode} View
                </span>
              </div>
            </div>

            {/* RIGHT OPERATIONAL ACTION CTA's */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
              {savedUser && (
                <button 
                  onClick={clearCredentials} 
                  className={`text-[11px] font-semibold px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-lg transition-all active:scale-[0.98] cursor-pointer border flex-1 sm:flex-initial text-center whitespace-nowrap ${
                    isDark 
                      ? 'bg-red-950/30 hover:bg-red-900/40 border-red-900/40 text-red-400' 
                      : 'bg-red-100 hover:bg-red-200 border-red-200 text-red-600'
                  }`}
                >
                  Wipe Data
                </button>
              )}
              
              <button 
                onClick={handleHardRefresh} 
                disabled={scraperState.status === 'running'} 
                className={`px-4 sm:px-5 py-2.5 sm:py-2 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-md active:scale-[0.98] cursor-pointer flex-1 sm:flex-initial text-center whitespace-nowrap ${
                  scraperState.status === 'running' 
                    ? (isDark ? 'bg-slate-800 text-slate-600 border border-slate-750' : 'bg-slate-200 text-slate-400 border border-slate-300') 
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/10'
                }`}
              >
                {scraperState.status === 'running' ? 'Syncing...' : 'Sync Portal Data'}
              </button>
            </div>

          </div>
        </div>

        {/* METRICS BLOCKS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`relative overflow-hidden p-6 rounded-2xl border ${themeCard}`}>
            <div className={`absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full blur-xl pointer-events-none ${isDark ? 'bg-blue-500/10' : 'bg-blue-500/5'}`} />
            <span className={`${themeSubtext} text-[11px] font-bold tracking-widest uppercase`}>Today's Total Time (Local)</span>
            <p className={`text-4xl font-black my-2 tracking-tight font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{metrics.today}</p>
          </div>
          <div className={`relative overflow-hidden p-6 rounded-2xl border ${themeCard}`}>
            <div className={`absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full blur-xl pointer-events-none ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-500/5'}`} />
            <span className={`${themeSubtext} text-[11px] font-bold tracking-widest uppercase`}>Instant Shift Status</span>
            <div className="my-2 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${metrics.status === 'IN' ? (isDark ? 'bg-green-400' : 'bg-green-500') : (isDark ? 'bg-amber-400' : 'bg-amber-500')}`} />
              <p className={`text-3xl font-black tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{metrics.status}</p>
            </div>
          </div>
          <div className={`relative overflow-hidden p-6 rounded-2xl border ${themeCard}`}>
            <div className={`absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full blur-xl pointer-events-none ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-500/5'}`} />
            <span className={`${themeSubtext} text-[11px] font-bold tracking-widest uppercase`}>Estimated Exit Time</span>
            <p className={`text-3xl font-black my-2 tracking-tight ${metrics.exitTime.includes('✅') ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : metrics.exitTime.includes('WFH') ? (isDark ? 'text-slate-500' : 'text-slate-400') : (isDark ? 'text-indigo-400 font-mono' : 'text-indigo-600 font-mono')}`}>
              {metrics.exitTime}
            </p>
          </div>
        </div>

        {/* SECONDARY WORKING CHARTS BLOCK */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* MONTH LOG MATRIX */}
          <div className={`p-6 rounded-2xl border lg:col-span-2 space-y-4 ${themeCard}`}>
            <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>📊 Local Month Log</h2>
            <div className={`max-h-96 overflow-y-auto border rounded-xl scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] ${themeTableBox}`}>
              <table className="w-full text-left text-xs border-collapse">
                <thead className={`border-b sticky top-0 font-semibold z-10 ${themeTh}`}>
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Tracked Working Hours</th>
                    <th className="p-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${themeTrHover}`}>
                  {reports.daily.map((row, i) => {
                    const isLive = row.hours.includes('(Live)');
                    const statusLower = String(row.status || '').toLowerCase();
                    
                    let badgeClass = isDark ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-slate-200/60 border-slate-300 text-slate-500";
                    if (statusLower.includes('leave')) {
                      badgeClass = isDark ? "bg-red-950/40 border-red-900/40 text-red-400 font-semibold" : "bg-red-100 border-red-200 text-red-600 font-semibold";
                    } else if (statusLower.includes('off')) {
                      badgeClass = isDark ? "bg-amber-950/40 border-amber-900/40 text-amber-400 font-semibold" : "bg-amber-100 border-amber-200 text-amber-600 font-semibold";
                    }

                    return (
                      <tr key={i} className="transition-colors group">
                        <td className={`p-3.5 font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{row.date}</td>
                        <td className="p-3.5 font-mono text-xs">
                          <span className={isLive ? (isDark ? 'text-emerald-400 font-bold' : 'text-emerald-600 font-bold') : (isDark ? 'text-blue-400' : 'text-blue-600')}>
                            {row.hours}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] border transition-colors ${badgeClass}`}>
                            {row.status || 'Regular'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIDE ENGINE CONTROLS */}
          <div className="space-y-6">
            
            {/* WEEKLY METRICS CARD */}
            <div className={`p-6 rounded-2xl border space-y-4 ${themeCard}`}>
              <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>📅 Weekly Targets</h2>
              <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]">
                {reports.weekly.map((wk, i) => (
                  <div key={i} className={`flex flex-col gap-2 p-3 rounded-xl border ${themeInnerCard}`}>
                    <p className={`text-[11px] font-bold tracking-tight ${themeSubtext}`}>{wk.week}</p>
                    <div className="flex justify-between items-center gap-2">
                      <span className={`font-mono text-xs truncate max-w-[70%] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{wk.total}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-tight shrink-0 border ${wk.remaining.includes('✅') ? (isDark ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-400' : 'bg-emerald-100 border-emerald-200 text-emerald-600') : (isDark ? 'bg-slate-900 border-slate-850 text-slate-400' : 'bg-slate-200/60 border-slate-300 text-slate-500')}`}>
                        {wk.remaining}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* LIVE CONSOLE PANEL */}
            <div className={`p-6 rounded-2xl border space-y-3 ${themeCard}`}>
              <h2 className={`text-xs font-bold uppercase tracking-widest ${themeSubtext}`}>Scraper Engine Console</h2>
              <div className={`p-4 rounded-xl h-40 overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] border ${isDark ? 'bg-slate-950 text-emerald-400/90 border-slate-900' : 'bg-slate-50 text-emerald-700 border-slate-200'}`}>
                {scraperState.logs.length === 0 ? (
                  <p className={`italic select-none ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>System communication pipelines idle.</p>
                ) : (
                  scraperState.logs.map((log, i) => <p key={i} className={`leading-relaxed border-l-2 pl-1.5 ${isDark ? 'border-emerald-500/20' : 'border-emerald-500/40'}`}>{log}</p>)
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
      {themeToggleBtn}
    </div>
  )
}
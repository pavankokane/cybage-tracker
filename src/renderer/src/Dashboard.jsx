import React, { useState, useEffect } from 'react'

export default function Dashboard() {
  const [appMode, setAppMode] = useState(null)
  const [scraperState, setScraperState] = useState({ status: 'idle', logs: [] })

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
    isWfh: false
  })
  const [reports, setReports] = useState({ daily: [], weekly: [] })

  const parseHoursToFloat = (timeStr) => {
    if (!timeStr || ['N/A', ''].includes(timeStr)) return 0.0
    try {
      const parts = timeStr.split()[0].split(':')
      return parseInt(parts[0], 10) + (parseInt(parts[1], 10) / 60.0 || 0)
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

  // 1. Hook to track real-time ticking metrics for today
  useEffect(() => {
    if (timetableData.length === 0) return

    const computeLiveToday = () => {
      let totalSeconds = 0
      let isCurrentlyIn = false
      let isWfhToday = false
      let currentInTime = null

      const sortedTimetable = [...timetableData].sort((a, b) => {
        const timeA = new Date(`${a.Date} ${a.Time}`)
        const timeB = new Date(`${b.Date} ${b.Time}`)
        return timeA - timeB
      })

      // Locate this area inside your React Dashboard file's live metric calculation hook:
      sortedTimetable.forEach((log) => {
        if (!log || !log['Machine Name'] || !log['Date'] || !log['Time']) return
        const machine = String(log['Machine Name']).toLowerCase()

        if (
          machine.includes('tripod') ||
          machine.includes('barrier') ||
          machine.includes('basement')
        ) {
          const logTime = new Date(`${log.Date} ${log.Time}`)
          const direction = String(log.Direction).trim().toLowerCase()

          if (machine.includes('wfh')) isWfhToday = true

          // 🟢 FLEXIBLE HARDWARE TRACKING LOGIC
          if (direction === 'entry') {
            // Set or overwrite the entry pin to handle consecutive entries seamlessly
            currentInTime = logTime
          }

          if (direction === 'exit' && currentInTime) {
            // Calculates time elapsed between ANY valid entry point and this exit location
            totalSeconds += (logTime - currentInTime) / 1000
            currentInTime = null // Reset pin, waiting for the next entry event
          }
        }
      })

      if (currentInTime && !isWfhToday) {
        isCurrentlyIn = true
        totalSeconds += (new Date() - currentInTime) / 1000
      }

      let tHours = Math.floor(totalSeconds / 3600)
      let tMinutes = Math.floor((totalSeconds % 3600) / 60)
      let statusString = isCurrentlyIn
        ? 'IN'
        : isWfhToday
          ? 'WFH'
          : totalSeconds > 0
            ? 'OUT'
            : 'No Swipes'

      setMetrics({
        today: `${tHours.toString().padStart(2, '0')}h ${tMinutes.toString().padStart(2, '0')}m`,
        status: statusString,
        rawSeconds: totalSeconds,
        isWfh: isWfhToday
      })
    }

    computeLiveToday()
    const liveTicker = setInterval(computeLiveToday, 1000)
    return () => clearInterval(liveTicker)
  }, [timetableData])

  // 2. Main structural data aggregation hook
  useEffect(() => {
    if (attendanceData.length === 0 && metrics.rawSeconds === 0) return

    const now = new Date()
    const currentMonth = now.toLocaleString('default', { month: 'short' })
    const currentYear = now.getFullYear().toString()
    const todayStr = `${now.getDate().toString().padStart(2, '0')}-${currentMonth}-${currentYear}`

    let dailyLogs = []
    let weeklyTotals = {}
    let todayProcessedInHistory = false

    const getWeekRangeString = (targetDate) => {
      const dayOfWeek = targetDate.getDay()
      const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const monday = new Date(targetDate)
      monday.setDate(targetDate.getDate() - distanceToMonday)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)

      const opt = { month: 'short', day: 'numeric' }
      return {
        weekStr: `${monday.toLocaleDateString('en-US', opt)} to ${sunday.toLocaleDateString('en-US', opt)}`,
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

      let dailyOffice = parseHoursToFloat(hoursStr)
      let dailyWfh = parseHoursToFloat(wfhStr)

      if (dateStr === todayStr) {
        todayProcessedInHistory = true
        const liveHoursFloat = metrics.rawSeconds / 3600
        if (metrics.isWfh) {
          dailyWfh = liveHoursFloat
          wfhStr = formatHhmm(liveHoursFloat)
        } else {
          dailyOffice = liveHoursFloat
          hoursStr = formatHhmm(liveHoursFloat)
        }
      }

      if (status.includes('holiday')) dailyOffice += 8.0
      let dailyTotal = dailyOffice + dailyWfh

      if (dateParts[1] === currentMonth && dateParts[2] === currentYear) {
        let displayHours = appMode === 'wfo' ? hoursStr : `🏢 ${hoursStr} | 🏠 ${wfhStr}`
        if (status.includes('holiday')) displayHours += ' (+8h Hol)'
        dailyLogs.push({ date: dateStr, hours: displayHours, status: row['Status'] || 'Regular' })
      }

      const monthMap = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11
      }
      const rowDate = new Date(
        parseInt(dateParts[2], 10),
        monthMap[dateParts[1]],
        parseInt(dateParts[0], 10)
      )

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

    if (!todayProcessedInHistory && metrics.rawSeconds > 0) {
      let dailyOffice = 0
      let dailyWfh = 0
      const liveHoursFloat = metrics.rawSeconds / 3600
      const currentHoursFormatted = formatHhmm(liveHoursFloat)

      if (metrics.isWfh) dailyWfh = liveHoursFloat
      else dailyOffice = liveHoursFloat

      let displayHours =
        appMode === 'wfo'
          ? currentHoursFormatted
          : metrics.isWfh
            ? `🏢 00:00 | 🏠 ${currentHoursFormatted}`
            : `🏢 ${currentHoursFormatted} | 🏠 00:00`
      dailyLogs.unshift({ date: todayStr, hours: displayHours + ' (Live)', status: 'Regular' })

      const { weekStr, mondayRef } = getWeekRangeString(now)
      if (!weeklyTotals[weekStr]) {
        weeklyTotals[weekStr] = { office: 0, wfh: 0, total: 0, sortDate: mondayRef }
      }
      weeklyTotals[weekStr].office += dailyOffice
      weeklyTotals[weekStr].wfh += dailyWfh
      weeklyTotals[weekStr].total += dailyOffice + dailyWfh
    }

    let weeklyReport = Object.keys(weeklyTotals)
      .sort((a, b) => weeklyTotals[a].sortDate - weeklyTotals[b].sortDate)
      .map((wk) => {
        let totals = weeklyTotals[wk]
        let isWfoMode = appMode === 'wfo'
        let rem = isWfoMode ? Math.max(0, 24 - totals.office) : Math.max(0, 40 - totals.total)

        return {
          week: wk,
          total: isWfoMode
            ? `${formatHhmm(totals.office)} / 24 hrs`
            : `🏢 ${formatHhmm(totals.office)} | 🏠 ${formatHhmm(totals.wfh)} (Total: ${formatHhmm(totals.total)}/40)`,
          remaining: rem > 0 ? `${formatHhmm(rem)} left` : '✅ Target Met'
        }
      })

    setReports({ daily: dailyLogs, weekly: weeklyReport })
  }, [attendanceData, metrics.rawSeconds, appMode])

  // Native Electron background tunnel bridge initialization
  useEffect(() => {
    if (!appMode) return

    window.electronAPI.getScraperData().then((data) => {
      handleSyncUpdate(data)
    })

    const unsubscribe = window.electronAPI.onScraperUpdate((data) => {
      handleSyncUpdate(data)
    })

    function handleSyncUpdate(data) {
      if (!data) return
      setScraperState(data.scraper)
      if (
        data.scraper.status === 'success' &&
        data.payload &&
        data.payload.attendance_rows.length > 0
      ) {
        localStorage.setItem('cybage_attendance', JSON.stringify(data.payload.attendance_rows))
        localStorage.setItem('cybage_timetable', JSON.stringify(data.payload.timetable_rows))
        setAttendanceData(data.payload.attendance_rows)
        setTimetableData(data.payload.timetable_rows)
      }
    }
    return () => unsubscribe()
  }, [appMode])

  // 🟢 EXECUTION CONTROLLER ROUTINE
  const handleHardRefresh = async () => {
    const user = localStorage.getItem('cybage_user')
    const pass = localStorage.getItem('cybage_pass')

    // Force configuration collection modal if parameters aren't stored locally
    if (!user || !pass) {
      setShowAuthModal(true)
      return
    }

    setScraperState({ status: 'running', logs: ['Dispatched browser refresh pipeline call...'] })
    await window.electronAPI.triggerRefresh(appMode, { username: user, password: pass })
  }

  const saveCredentials = () => {
    if (!usernameInput || !passwordInput) return
    localStorage.setItem('cybage_user', usernameInput)
    localStorage.setItem('cybage_pass', passwordInput)
    setSavedUser(usernameInput)
    setShowAuthModal(false)

    // Auto-trigger refresh right after saving
    setScraperState({ status: 'running', logs: ['Dispatched browser refresh pipeline call...'] })
    window.electronAPI.triggerRefresh(appMode, { username: usernameInput, password: passwordInput })
  }

  // 🟢 CONFIGURATION DELETION INTERACTION
  const clearCredentials = () => {
    localStorage.removeItem('cybage_user')
    localStorage.removeItem('cybage_pass')
    setSavedUser('')
    setUsernameInput('')
    setPasswordInput('')
    alert('Credentials cleared safely from memory.')
  }

  // --- RENDERING CONFIG 1: HOME SPLASH ---
  if (!appMode) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 space-y-6 text-center shadow-xl">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Cybage Attendance Hub
          </h1>
          <p className="text-slate-400 text-sm">
            Select storage calculation view profile metrics container:
          </p>
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setAppMode('wfo')}
              className="bg-slate-700 hover:bg-blue-600 border border-slate-600 p-4 rounded-xl text-left transition-all cursor-pointer"
            >
              <p className="font-semibold text-center">🏢 Regular Office Tracking (WFO)</p>
            </button>
            <button
              onClick={() => setAppMode('wfh')}
              className="bg-slate-700 hover:bg-emerald-600 border border-slate-600 p-4 rounded-xl text-left transition-all cursor-pointer"
            >
              <p className="font-semibold text-center">🏠 Hybrid Tracking (WFO + WFH)</p>
            </button>
          </div>

          {/* 🟢 CREDENTIAL MANAGEMENT SECTION IN HOME SPLASH */}
          <div className="pt-4 border-t border-slate-700 text-left space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Credential Engine Settings
            </p>
            {savedUser ? (
              <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-700">
                <span className="text-xs text-slate-300 truncate max-w-[200px]">
                  👤 Saved: <b>{savedUser}</b>
                </span>
                <button
                  onClick={clearCredentials}
                  className="text-xs bg-red-950/40 hover:bg-red-900 border border-red-800 text-red-300 px-2 py-1 rounded transition cursor-pointer"
                >
                  Wipe Data
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full bg-slate-900 text-xs font-medium text-slate-300 border border-slate-700 hover:bg-slate-750 p-3 rounded-xl transition text-center cursor-pointer"
              >
                ➕ Configure MIS Portal Logins
              </button>
            )}
          </div>
        </div>

        {/* 🟢 INPUT MODAL OVERLAY */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm z-50">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">MIS Authorization Profile</h3>
                <p className="text-xs text-slate-400">
                  Credentials will be cached inside localized system sandbox boundaries.
                </p>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-medium tracking-wide text-white"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-medium tracking-wide text-white"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-sm py-2.5 rounded-xl transition font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCredentials}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-sm py-2.5 rounded-xl transition font-medium cursor-pointer"
                >
                  Save & Sync
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // --- RENDERING CONFIG 2: DASHBOARD VIEW ---
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-slate-800 p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setAppMode(null)}
              className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 cursor-pointer"
            >
              ← Change Profile
            </button>
            <h1 className="text-2xl font-bold tracking-tight">
              Cybage Tracker{' '}
              <span className="text-xs uppercase bg-slate-700 px-2 py-0.5 rounded ml-2">
                {appMode} View
              </span>
            </h1>
          </div>
          <div className="flex gap-3">
            {savedUser && (
              <button
                onClick={clearCredentials}
                className="bg-slate-700 border border-slate-600 text-slate-300 text-xs px-3 rounded-lg hover:bg-red-950/40 hover:border-red-900 hover:text-red-300 transition cursor-pointer"
              >
                Wipe Auth Cache
              </button>
            )}
            <button
              onClick={handleHardRefresh}
              disabled={scraperState.status === 'running'}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 px-5 py-2.5 rounded-lg font-medium transition cursor-pointer"
            >
              {scraperState.status === 'running' ? 'Syncing...' : 'Sync Portal Data'}
            </button>
          </div>
        </div>

        {/* Modal activation hook layout from inside dashboard frames */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm z-50">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">MIS Authorization Profile</h3>
                <p className="text-xs text-slate-400">
                  Credentials will be cached inside localized system sandbox boundaries.
                </p>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-medium tracking-wide text-white"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm outline-none focus:border-blue-500 font-medium tracking-wide text-white"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-sm py-2.5 rounded-xl transition font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCredentials}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-sm py-2.5 rounded-xl transition font-medium cursor-pointer"
                >
                  Save & Sync
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <span className="text-slate-400 text-sm font-medium">
              🏢 TODAY'S TOTAL TIME (LOCAL)
            </span>
            <p className="text-4xl font-extrabold text-blue-400 my-2 tracking-wider font-mono">
              {metrics.today}
            </p>
          </div>
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <span className="text-slate-400 text-sm font-medium">
              🟢 INSTANT RUNTIME PROFILE STATUS
            </span>
            <p className="text-3xl font-bold my-2 text-green-400">{metrics.status}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold border-b border-slate-700 pb-2">
              📊 Local Month Log
            </h2>
            <div className="max-h-96 overflow-y-auto border border-slate-700 rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800 sticky top-0 text-slate-300 border-b border-slate-700">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Tracked Working Hours</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {reports.daily.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-750/50 transition">
                      <td className="p-3 font-medium text-slate-200">{row.date}</td>
                      <td className="p-3 text-blue-400 font-mono text-xs">{row.hours}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                          {row.status || 'Regular'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {reports.daily.length === 0 && (
                    <tr>
                      <td colSpan="3" className="p-4 text-center text-slate-500 italic">
                        No historical data recorded for current month log views.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
              <h2 className="text-lg font-semibold border-b border-slate-700 pb-2">
                📅 Weekly Target Calculations
              </h2>
              {reports.weekly.map((wk, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1.5 bg-slate-900 p-3 rounded-lg border border-slate-700"
                >
                  <p className="text-xs text-slate-400 font-semibold">{wk.week}</p>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-200 font-mono text-xs">{wk.total}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 font-medium text-slate-400 text-[11px]">
                      {wk.remaining}
                    </span>
                  </div>
                </div>
              ))}
              {reports.weekly.length === 0 && (
                <p className="text-slate-500 text-sm italic">No calculations generated.</p>
              )}
            </div>

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-2">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Scraper Stream Channel Logs
              </h2>
              <div className="bg-slate-950 p-4 rounded-lg h-44 overflow-y-auto font-mono text-xs text-emerald-400 border border-slate-800 space-y-1">
                {scraperState.logs.length === 0 ? (
                  <p className="text-slate-600 italic">System connection idle.</p>
                ) : (
                  scraperState.logs.map((log, i) => <p key={i}>{log}</p>)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { app, shell, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import puppeteer from 'puppeteer-core'
import icon from '../../resources/icon.png'
import fs from 'fs' // Native file system locator

let mainWindow
let scrapingStatus = { status: 'idle', logs: [] }
let latestScrapedData = { attendance_rows: [], timetable_rows: [] }
const URL = 'http://cybagemis.cybage.com/Framework/Iframe.aspx'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    show: false,
    autoHideMenuBar: true,
    icon: icon,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// =================================================================
// 🚀 NATIVE PUPPETEER SCRAPER LOGIC
// =================================================================
async function runScraperLogic(mode, credentials) {
  const safeMode = mode ? String(mode) : 'wfo'
  const safeCredentials = credentials || {}

  scrapingStatus.status = 'running'
  scrapingStatus.logs = [`🚀 Initializing Dynamic Cross-Platform Environment...`]
  mainWindow.webContents.send('scraper-status-updated', {
    scraper: scrapingStatus,
    payload: latestScrapedData
  })

  let browser
  try {
    browser = await puppeteer.launch({
      headless: true, // Change to false for debugging
      channel: 'chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-extensions',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-popup-blocking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding'
      ]
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    await page.authenticate({
      username: safeCredentials.username || '',
      password: safeCredentials.password || ''
    })

    const pushLog = (msg) => {
      scrapingStatus.logs.push(msg)
      mainWindow.webContents.send('scraper-status-updated', {
        scraper: scrapingStatus,
        payload: latestScrapedData
      })
    }

    pushLog('🌐 Connecting directly to target MIS framework servers...')
    await page.goto(URL, { waitUntil: 'networkidle2' })

    pushLog('1. Evaluating localized portal page layouts...')
    const reportsBtn = await page.waitForSelector('xpath///a[text()="Report Builder"]', {
      timeout: 15000
    })
    await reportsBtn.evaluate((node) => node.click())
    await new Promise((r) => setTimeout(r, 2000))

    pushLog('3. Accessing navigation components inside Frame...')
    const frameElement = await page.waitForSelector("iframe[name='RPTN_Reportpage']", {
      timeout: 15000
    })
    const targetFrame = await frameElement.contentFrame()
    if (!targetFrame) throw new Error('Could not drop inside report iframe context.')

    const expander = await targetFrame.waitForSelector('#TempleteTreeViewn3', {
      visible: true,
      timeout: 10000
    })
    await expander.evaluate((node) => node.click())
    await new Promise((r) => setTimeout(r, 1500))

    const attendanceLogBtn = await targetFrame.waitForSelector('#TempleteTreeViewt4', {
      visible: true,
      timeout: 10000
    })
    await attendanceLogBtn.evaluate((node) => node.click())
    await new Promise((r) => setTimeout(r, 2000))

    const now = new Date()
    const formatDate = (d) => {
      const parts = d
        .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        .split(' ')
      return `${parts[0]}-${parts[1]}-${parts[2]}`
    }
    const todayDate = formatDate(now)
    const startMonday = new Date(now.getFullYear(), now.getMonth(), 1)
    startMonday.setDate(
      startMonday.getDate() - (startMonday.getDay() === 0 ? 6 : startMonday.getDay() - 1)
    )
    const firstDate = formatDate(startMonday)

    pushLog(`5. Setting query date constraints: ${firstDate} to ${todayDate}`)
    const fromInput = await targetFrame.waitForSelector("input[id$='_FromDateCalender_DTB']", {
      visible: true,
      timeout: 15000
    })
    const toInput = await targetFrame.waitForSelector("input[id$='_ToDateCalender_DTB']", {
      visible: true
    })

    await fromInput.evaluate((node, date) => {
      node.value = date
      node.dispatchEvent(new Event('change', { bubbles: true }))
    }, firstDate)
    await new Promise((r) => setTimeout(r, 500))

    await toInput.evaluate((node, date) => {
      node.value = date
      node.dispatchEvent(new Event('change', { bubbles: true }))
    }, todayDate)
    await new Promise((r) => setTimeout(r, 500))
    await toInput.press('Escape')
    await new Promise((r) => setTimeout(r, 1500))

    pushLog('6. Deploying document structure generators...')
    const generateBtn = await targetFrame.waitForSelector("input[title='Generate Report']", {
      visible: true,
      timeout: 10000
    })
    await generateBtn.evaluate((node) => node.click())

    pushLog('7. Building records table grid layout rows...')
    await targetFrame.waitForSelector("td[id$='ReportCell']", { visible: true, timeout: 60000 })
    await new Promise((r) => setTimeout(r, 5000))
    await page.keyboard.press('End')
    await new Promise((r) => setTimeout(r, 2000))

    pushLog('8. Formatting text rows into structured JSON segments...')
    const parsedAttendance = await targetFrame.evaluate(() => {
      const dataTable = Array.from(document.querySelectorAll("td[id$='ReportCell']")).pop()
      if (!dataTable) return []
      const rows = Array.from(dataTable.querySelectorAll('tr'))
      const headers = [
        'Employee ID',
        'Employee Name',
        'Date',
        'Swipe Count',
        'In Time',
        'Out Time',
        'Total Working Hours - Swipes',
        'Actual Working Hours - Swipes (A)',
        'Total Working Hours - WFH',
        'Actual Working Hours - WFH (B)',
        'Actual Working Hours Swipe (A) + WFH (B) (HH:MM)',
        'Status',
        'First Half Status',
        'Second Half Status'
      ]
      return rows
        .map((row) => {
          const cells = Array.from(row.querySelectorAll('th, td'))
          const rowData = cells.map((cell) => (cell.innerText || '').trim())
          if (rowData.length >= 12 && rowData[2].includes('-')) {
            const rowDict = {}
            headers.forEach((h, idx) => {
              if (idx < rowData.length) rowDict[h] = rowData[idx]
            })
            return rowDict
          }
          return null
        })
        .filter(Boolean)
    })
    latestScrapedData.attendance_rows = parsedAttendance

    // ---------------------------------------------------------
    // SWIPE LOG EXTRACTION (YESTERDAY & TODAY)
    // ---------------------------------------------------------
    pushLog('10. Fetching active swipe logs...')
    const backBtn = await targetFrame.waitForSelector('#BackImage')
    await backBtn.evaluate((node) => node.click())
    await new Promise((r) => setTimeout(r, 2000))

    const timeTableMenuBtn = await targetFrame.waitForSelector('#TempleteTreeViewt7')
    await timeTableMenuBtn.evaluate((node) => node.click())
    await new Promise((r) => setTimeout(r, 2000))

    const swipeTargets = [
      { val: '0', name: 'Yesterday' },
      { val: '1', name: 'Today' }
    ]

    let allSwipeData = []

    for (const day of swipeTargets) {
      pushLog(`--> Selecting '${day.name}' from dropdown...`)
      try {
        const dayDropdown = await targetFrame.waitForSelector("select[title='Day']", {
          visible: true,
          timeout: 10000
        })
        await dayDropdown.select(day.val)

        const dayGenBtn = await targetFrame.waitForSelector("input[title='Generate Report']")
        await dayGenBtn.evaluate((node) => node.click())
        await new Promise((r) => setTimeout(r, 5000))

        const isNoDataVisible = await targetFrame.evaluate(() =>
          document.body.innerText.includes('Sorry, data is not available')
        )

        if (isNoDataVisible) {
          pushLog(`   ⚠️ No data found for ${day.name}.`)
        } else {
          const parsedSwipes = await targetFrame.evaluate(() => {
            const todayTable = document.querySelectorAll("#ReportViewer1 [id$='ReportCell']")
            const activeTable = todayTable[todayTable.length - 1]
            if (!activeTable) return []
            const todayRows = Array.from(activeTable.querySelectorAll('tr'))
            const extracted = []
            for (let i = 8; i < todayRows.length; i++) {
              const cells = Array.from(todayRows[i].querySelectorAll('th, td'))
              const rowData = cells.map((cell) => (cell.innerText || '').trim())
              if (rowData.some((v) => v !== '') && rowData.length >= 5) {
                const machineName = (rowData[2] || '').toLowerCase()

                // Capture entries across all device variations
                if (
                  machineName.includes('tripod') ||
                  machineName.includes('barrier') ||
                  machineName.includes('basement')
                ) {
                  extracted.push({
                    'Employee ID': rowData[0],
                    Date: rowData[1],
                    'Machine Name': rowData[2],
                    Direction: rowData[3],
                    Time: rowData[4]
                  })
                }
              }
            }
            return extracted
          })
          allSwipeData.push(...parsedSwipes)
        }

        // Navigate back to filter page if not the last item in the loop
        if (day.val !== '1') {
          const backImage = await targetFrame.waitForSelector('#BackImage')
          await backImage.evaluate((node) => node.click())
          await new Promise((r) => setTimeout(r, 2000))
        }
      } catch (e) {
        pushLog(`   ⚠️ Could not pull ${day.name} logs. Proceeding...`)
      }
    }

    // ---------------------------------------------------------
    // CONDITIONAL ESPLUS WFH SCRAPING (ONE BY ONE)
    // ---------------------------------------------------------
    if (safeMode !== 'wfo') {
      const nowDt = new Date()
      const yestDt = new Date(nowDt.getTime() - 24 * 60 * 60 * 1000)

      // Formatter for comparisons (e.g. '28 Jun 2026')
      const formatForMatch = (d) => {
        const parts = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).split(' ')
        return `${parts[0]} ${parts[1]} ${parts[2]}`
      }
      
      const todayMatch = formatForMatch(nowDt)
      const yestMatch = formatForMatch(yestDt)

      // Check if physical office swipes exist for these days
      const hasSwipesToday = allSwipeData.some(r => r.Date.replace(/-/g, ' ').includes(todayMatch))
      const hasSwipesYest = allSwipeData.some(r => r.Date.replace(/-/g, ' ').includes(yestMatch))

      const missingDates = []
      if (!hasSwipesYest) {
        missingDates.push({ obj: yestDt, name: 'Yesterday', iso: yestDt.toISOString().split('T')[0] })
      }
      if (!hasSwipesToday) {
        missingDates.push({ obj: nowDt, name: 'Today', iso: nowDt.toISOString().split('T')[0] })
      }

      if (missingDates.length > 0) {
        pushLog(`🌐 Missing swipes for ${missingDates.length} day(s). Fetching ESPlus data...`)
        
        const esPage = await browser.newPage()
        await esPage.setViewport({ width: 1920, height: 1080 })

        await esPage.authenticate({
          username: safeCredentials.username || '',
          password: safeCredentials.password || ''
        })

        await esPage.goto('http://esplusapps.cybage.com/ESPlusPlatform', {
          waitUntil: 'domcontentloaded'
        })

        for (const mDate of missingDates) {
          pushLog(`   -> Extracting ActiveTime strictly for ${mDate.name}: ${mDate.iso}`)
          await esPage.goto(
            `http://esplusapps.cybage.com/ESPlusManagerDashboardAPIV2/api/activity/personal?from=${mDate.iso}&to=${mDate.iso}`,
            { waitUntil: 'domcontentloaded' }
          )

          const xmlContent = await esPage.evaluate(() => document.body.innerText)
          const match = xmlContent.match(/<ActiveTime[^>]*>([\d\.]+)<\/ActiveTime>/)
          const activeMinutes = match ? parseFloat(match[1]) : 0.0
          
          pushLog(`   ✅ Extracted Active Hybrid Time: ${activeMinutes.toFixed(2)} mins`)

          if (activeMinutes > 0) {
            // Generate fake swipe records so frontend logic calculates it seamlessly
            const startDt = new Date(mDate.obj)
            startDt.setHours(9, 0, 0, 0)
            const endDt = new Date(startDt.getTime() + activeMinutes * 60000)

            const logDateStr = formatDate(mDate.obj)
            const formatLogTime = (d) =>
              d.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              })

            allSwipeData.push({
              'Employee ID': 'WFH_User',
              Date: logDateStr,
              'Machine Name': 'tripod WFH',
              Direction: 'entry',
              Time: formatLogTime(startDt)
            })
            allSwipeData.push({
              'Employee ID': 'WFH_User',
              Date: logDateStr,
              'Machine Name': 'tripod WFH',
              Direction: 'exit',
              Time: formatLogTime(endDt)
            })
          }
        }
        await esPage.close()
      } else {
        pushLog(`✅ Swipes found for all recent days. Skipping ESPlus WFH fetch.`)
      }
    }

    latestScrapedData.timetable_rows = allSwipeData

    await browser.close()
    scrapingStatus.status = 'success'
    pushLog('🎉 Synchronization complete! Ready to view.')
  } catch (err) {
    scrapingStatus.status = 'failed'
    scrapingStatus.logs.push(`❌ Pipeline Automation Error: ${err.message}`)
    mainWindow.webContents.send('scraper-status-updated', {
      scraper: scrapingStatus,
      payload: latestScrapedData
    })
    if (browser) await browser.close()
  }
}

// =================================================================
// 🔀 IPC HANDLER REGISTER PIPELINES
// =================================================================
app.whenReady().then(() => {
  ipcMain.handle('get-scraper-data', () => ({
    scraper: scrapingStatus,
    payload: latestScrapedData
  }))

  ipcMain.handle('trigger-refresh', async (event, mode, credentials) => {
    if (scrapingStatus.status === 'running') return { success: false }
    latestScrapedData.attendance_rows = []
    latestScrapedData.timetable_rows = []

    runScraperLogic(mode, credentials)
    return { success: true }
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import puppeteer from 'puppeteer-core' // Use 'puppeteer' if you don't supply an executablePath
import icon from '../../resources/icon.png'
import dns from 'dns'

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
    if (!is.dev) optimizer.watchWindowShortcuts(mainWindow)
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

async function isCompanyNetworkAvailable() {
  try {
    await Promise.race([
      dns.lookup('cybagemis.cybage.com'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 4000)
      )
    ])

    return true
  } catch {
    return false
  }
}

// =================================================================
// 🚀 NATIVE PUPPETEER SCRAPER LOGIC
// =================================================================
async function runScraperLogic(mode, credentials) {
  const safeMode = mode ? String(mode) : 'wfo'
  const safeCredentials = credentials || {}

  scrapingStatus.status = 'running'
  scrapingStatus.logs = [`🚀 Initializing Dynamic Cross-Platform Environment (Puppeteer)...`]
  mainWindow.webContents.send('scraper-status-updated', {
    scraper: scrapingStatus,
    payload: latestScrapedData
  })

  // ---------------------------------------------------------
  // 🔍 PRE-FLIGHT NETWORK CHECK
  // ---------------------------------------------------------
  const pushLog = (msg) => {
    scrapingStatus.logs.push(msg)
    mainWindow.webContents.send('scraper-status-updated', { scraper: scrapingStatus, payload: latestScrapedData })
  }

  pushLog('🔍 Analyzing network environment...')
  const isOnNetwork = await isCompanyNetworkAvailable()
  const needsVpn = !isOnNetwork
  
  pushLog(`📡 Network Status: ${isOnNetwork ? 'Company Network (Direct)' : 'External Network (Requires VPN)'}`)
  pushLog(`⚙️ Launching browser in ${isOnNetwork ? 'HEADLESS' : 'VISIBLE'} mode.`)

  let browser
  try {
    browser = await puppeteer.launch({
      headless: isOnNetwork, // 🟢 DYNAMIC HEADLESS TOGGLE
      channel: 'chrome',
      // executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // If using puppeteer-core
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

    let targetFrame = null;

    // --- VPN HANDLING BLOCK ---
    if (needsVpn) {
      pushLog('🚨 Portal returned 404/Timeout. Redirecting to VPN...')
      try {
        await page.goto('https://ctvpn.cybage.com/sslvpn/Login/Login', { waitUntil: 'domcontentloaded', timeout: 15000 })
        await page.waitForSelector('#userName', { visible: true, timeout: 10000 })
      } catch (e) {
        throw new Error('VPN Portal unreachable. Check your network.')
      }

      pushLog('🔐 Entering credentials automatically...')
      await page.type('#userName', safeCredentials.username || '')
      await page.type('#passwordDisplayed', safeCredentials.password || '')
      await page.click('#LoginButton')

      pushLog('📱 2FA REQUIRED: Please complete 2FA in the opened browser window. (Waiting 5 mins...)')
      
      // ==========================================
      // 🔄 FIXED 5-SECOND POLLING LOOP FOR 2FA
      // ==========================================
      let twoFactorPassed = false
      const maxAttempts = 60 // 60 attempts * 5 seconds = 300 seconds (5 mins)
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Convert the URL to lowercase to prevent case-sensitivity bugs
        const currentUrl = page.url().toLowerCase()
        
        // Now it will correctly match 'sslvpn/portal' or 'report%20builder' regardless of casing
        if (currentUrl.includes('sslvpn/portal') || currentUrl.includes('report%20builder')) {
          twoFactorPassed = true
          break
        }
        
        // Send a status update to the frontend every 5 seconds
        pushLog(`⏳ Checking 2FA status... (Attempt ${attempt}/${maxAttempts} - Waiting 5s)`)
        await new Promise(r => setTimeout(r, 5000)) // Wait 5 seconds
      }

      if (!twoFactorPassed) {
        throw new Error('2FA timed out. Please run the sync again and complete 2FA within 5 minutes.')
      }
      // ==========================================

      pushLog('✅ 2FA passed! Routing directly to Report Builder...')
      await page.goto('https://ctvpn.cybage.com/sslvpn/PT/https://cybagemis.cybage.com/Report%20Builder/RPTN/Reportpage.aspx', { waitUntil: 'networkidle2' })
      
      // When routed this way, the report builder is usually the main page, not inside a frame.
      // But we will map targetFrame to page so the rest of the script works identically.
      targetFrame = page; 
    } else {
      // --- NORMAL NETWORK BLOCK ---
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
      targetFrame = await frameElement.contentFrame()
      if (!targetFrame) throw new Error('Could not drop inside report iframe context.')
    }

    // ==========================================
    // SCRAPING LOGIC CONTINUES USING targetFrame
    // ==========================================

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
    
    // Fallback if targetFrame is the main page (VPN routing)
    if (needsVpn) {
      await page.keyboard.press('End')
    } else {
      await page.keyboard.press('End')
    }
    await new Promise((r) => setTimeout(r, 2000))

    pushLog('8. Formatting text rows into structured JSON segments...')
    const parsedAttendance = await targetFrame.evaluate(() => {
      const dataTable = Array.from(document.querySelectorAll("td[id$='ReportCell']")).pop()
      if (!dataTable) return []
      const rows = Array.from(dataTable.querySelectorAll('tr'))
      const headers = [
        'Employee ID', 'Employee Name', 'Date', 'Swipe Count', 'In Time', 'Out Time',
        'Total Working Hours - Swipes', 'Actual Working Hours - Swipes (A)',
        'Total Working Hours - WFH', 'Actual Working Hours - WFH (B)',
        'Actual Working Hours Swipe (A) + WFH (B) (HH:MM)', 'Status',
        'First Half Status', 'Second Half Status'
      ]
      return rows.map((row) => {
          const cells = Array.from(row.querySelectorAll('th, td'))
          const rowData = cells.map((cell) => (cell.innerText || '').trim())
          if (rowData.length >= 12 && rowData[2].includes('-')) {
            const rowDict = {}
            headers.forEach((h, idx) => {
              if (idx < rowData.length) {
                rowDict[h] = h === 'Date' ? rowData[idx].replace(/[\s/]/g, '-') : rowData[idx]
              }
            })
            return rowDict
          }
          return null
        }).filter(Boolean)
    })
    latestScrapedData.attendance_rows = parsedAttendance

    // ---------------------------------------------------------
    // SWIPE LOG EXTRACTION (YESTERDAY & TODAY)
    // ---------------------------------------------------------
    pushLog('10. Fetching active swipe logs...')
    let allSwipeData = [] 

    try {
      // 💡 SMART CONTEXT: Find the iframe (WFO), or fallback to the main page (VPN)
      let workingFrame = page.frames().find(f => f.name() === 'RPTN_Reportpage') || page;
        
      // 1. Go back to main menu
      const backBtn = await workingFrame.waitForSelector('#BackImage', { visible: true, timeout: 15000 })
      await backBtn.evaluate((node) => node.click())
      await new Promise((r) => setTimeout(r, 3000))

      // 2. Click Today/Yesterday Menu
      const timeTableMenuBtn = await workingFrame.waitForSelector('#TempleteTreeViewt7', { visible: true, timeout: 15000 })
      await timeTableMenuBtn.evaluate((node) => node.click())
      await new Promise((r) => setTimeout(r, 3000)) 

      const swipeTargets = [{ val: '0', name: 'Yesterday' }, { val: '1', name: 'Today' }]

      for (const day of swipeTargets) {
        pushLog(`--> Selecting '${day.name}' from dropdown...`)
        try {
          // Always ensure we have the live context after potential ASP postbacks
          workingFrame = page.frames().find(f => f.name() === 'RPTN_Reportpage') || page;

          // 3. SELF-HEALING: If dropdown is missing, reset view
          let dropdownExists = await workingFrame.$("select[title='Day']")
          if (!dropdownExists) {
            pushLog(`   🔄 Recovering broken frame state for ${day.name}...`)
            const retryMenuBtn = await workingFrame.waitForSelector('#TempleteTreeViewt7', { visible: true, timeout: 10000 })
            await retryMenuBtn.evaluate((node) => node.click())
            await new Promise((r) => setTimeout(r, 3000))
          }

          // 4. Force the dropdown value
          await workingFrame.waitForSelector("select[title='Day']", { visible: true, timeout: 15000 })
          await workingFrame.evaluate((val) => {
            const dropdown = document.querySelector("select[title='Day']")
            if (dropdown) {
              dropdown.value = val
              dropdown.dispatchEvent(new Event('change', { bubbles: true }))
            }
          }, day.val)
          
          await new Promise((r) => setTimeout(r, 1500))

          // 5. Generate the report
          const dayGenBtn = await workingFrame.waitForSelector("input[title='Generate Report']", { visible: true, timeout: 10000 })
          await dayGenBtn.evaluate((node) => node.click())
          
          pushLog(`   ⏳ Waiting for ${day.name} portal to respond...`)
          
          // 6. REPLICATED PYTHON LOGIC: Wait for the structural report cell container OR a "No Data" container
          // Give it a 5-second baseline sleep just like Python's wait_for_timeout
          await new Promise((r) => setTimeout(r, 5000)) 

          // Check if "No Data" text element exists in the DOM
          const isNoDataVisible = await workingFrame.evaluate(() => {
            return document.body.innerText.includes("Sorry, data is not available");
          })

          if (isNoDataVisible) {
            pushLog(`   ⚠️ No data found for ${day.name}.`)
          } else {
            pushLog(`   📊 Table detected. Finalizing row processing...`)
            
            // Explicitly wait for the report cell container to be visible (just like Python)
            // Using a flexible ends-with selector for the ASP.NET dynamically generated ID
            await workingFrame.waitForSelector("td[id$='ReportCell']", { visible: true, timeout: 30000 })
            await new Promise((r) => setTimeout(r, 2000)) // Short stability buffer

            const parsedSwipes = await workingFrame.evaluate(() => {
              // Target the very last report cell table container generated
              const todayTables = document.querySelectorAll("td[id$='ReportCell']")
              const activeTable = todayTables[todayTables.length - 1]
              if (!activeTable) return []
              
              const allRows = Array.from(activeTable.querySelectorAll("tr"));
              const extracted = [];
              
              for (const row of allRows) {
                const cells = Array.from(row.querySelectorAll('th, td'));
                const rowData = cells.map((cell) => (cell.innerText || '').trim());
                
                if (rowData.length >= 5 && (rowData[2].toLowerCase().includes('tripod') || rowData[2].toLowerCase().includes('barrier') || rowData[2].toLowerCase().includes('basement'))) {
                  extracted.push({
                    'Employee ID': rowData[0],
                    Date: rowData[1].replace(/[\s/]/g, '-'),
                    'Machine Name': rowData[2],
                    Direction: rowData[3],
                    Time: rowData[4]
                  });
                }
              }
              return extracted;
            })
            
            pushLog(`   ✅ Captured ${parsedSwipes.length} valid swipes for ${day.name}.`)
            allSwipeData.push(...parsedSwipes)
          }

          // ... end of your for loop iterations ...
          if (day.val !== '1') {
            const backImage = await workingFrame.waitForSelector('#BackImage', { visible: true, timeout: 10000 })
            await backImage.evaluate((node) => node.click())
            await new Promise((r) => setTimeout(r, 3000))
          }
        } catch (dayErr) {
          pushLog(`   ❌ Could not pull ${day.name} logs: ${dayErr.message}`)
        }
      } // <-- This is the end of the 'for' loop

      // ==========================================
      // 🛠️ FIX HERE: Clean Assignment & Direct Push
      // ==========================================
      if (allSwipeData.length > 0) {
        latestScrapedData.timetable_rows = allSwipeData;
        
        // Push a log so you can verify the variable assignment worked
        pushLog(`📥 Injected ${allSwipeData.length} total swipe rows into runtime payload.`);
      }

    } catch (e) {
      pushLog(`❌ Critical error during Swipe Log navigation: ${e.message}`)
    }

    // ---------------------------------------------------------
    // CONDITIONAL ESPLUS WFH SCRAPING (ONE BY ONE)
    // ---------------------------------------------------------
    if (safeMode !== 'wfo') {
      const nowDt = new Date()
      const yestDt = new Date(nowDt.getTime() - 24 * 60 * 60 * 1000)

      const formatForMatch = (d) => {
        const parts = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).split(' ')
        return `${parts[0]} ${parts[1]} ${parts[2]}`
      }
      
      const todayMatch = formatForMatch(nowDt)
      const yestMatch = formatForMatch(yestDt)

      const hasSwipesToday = allSwipeData.some(r => r.Date.replace(/-/g, ' ').includes(todayMatch))
      const hasSwipesYest = allSwipeData.some(r => r.Date.replace(/-/g, ' ').includes(yestMatch))

      const missingDates = []
      if (!hasSwipesYest) missingDates.push({ obj: yestDt, name: 'Yesterday', iso: yestDt.toISOString().split('T')[0] })
      if (!hasSwipesToday) missingDates.push({ obj: nowDt, name: 'Today', iso: nowDt.toISOString().split('T')[0] })

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
            const startDt = new Date(mDate.obj)
            startDt.setHours(9, 0, 0, 0)
            const endDt = new Date(startDt.getTime() + activeMinutes * 60000)

            const logDateStr = formatDate(mDate.obj)
            const formatLogTime = (d) =>
              d.toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
              })

            allSwipeData.push({
              'Employee ID': 'WFH_User', Date: logDateStr, 'Machine Name': 'tripod WFH',
              Direction: 'entry', Time: formatLogTime(startDt)
            })
            allSwipeData.push({
              'Employee ID': 'WFH_User', Date: logDateStr, 'Machine Name': 'tripod WFH',
              Direction: 'exit', Time: formatLogTime(endDt)
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
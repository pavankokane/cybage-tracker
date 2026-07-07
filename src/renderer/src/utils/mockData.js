const mockAttendanceData = [
  {
    "Employee ID": "101",
    "Employee Name": "Test User",
    "Date": "29-Jun-2026",
    "Swipe Count": "0",
    "In Time": "",
    "Out Time": "",
    "Total Working Hours - Swipes": "",
    "Actual Working Hours - Swipes (A)": "",
    "Total Working Hours - WFH": "",
    "Actual Working Hours - WFH (B)": "",
    "Actual Working Hours Swipe (A) + WFH (B) (HH:MM)": "0:00",
    "Status": "Planned Leave",
    "First Half Status": "",
    "Second Half Status": ""
  },
  {
    "Employee ID": "101",
    "Employee Name": "Test User",
    "Date": "30-Jun-2026",
    "Swipe Count": "0",
    "In Time": "",
    "Out Time": "",
    "Total Working Hours - Swipes": "",
    "Actual Working Hours - Swipes (A)": "",
    "Total Working Hours - WFH": "",
    "Actual Working Hours - WFH (B)": "",
    "Actual Working Hours Swipe (A) + WFH (B) (HH:MM)": "0:00",
    "Status": "Planned Leave",
    "First Half Status": "",
    "Second Half Status": ""
  },
  {
    "Employee ID": "101",
    "Employee Name": "Test User",
    "Date": "01-Jul-2026",
    "Swipe Count": "0",
    "In Time": "",
    "Out Time": "",
    "Total Working Hours - Swipes": "",
    "Actual Working Hours - Swipes (A)": "",
    "Total Working Hours - WFH": "",
    "Actual Working Hours - WFH (B)": "",
    "Actual Working Hours Swipe (A) + WFH (B) (HH:MM)": "0:00",
    "Status": "Planned Leave",
    "First Half Status": "",
    "Second Half Status": ""
  },
  {
    "Employee ID": "101",
    "Employee Name": "Test User",
    "Date": "02-Jul-2026",
    "Swipe Count": "0",
    "In Time": "",
    "Out Time": "",
    "Total Working Hours - Swipes": "",
    "Actual Working Hours - Swipes (A)": "",
    "Total Working Hours - WFH": "0:06",
    "Actual Working Hours - WFH (B)": "0:06",
    "Actual Working Hours Swipe (A) + WFH (B) (HH:MM)": "0:06",
    "Status": "Onsite(India)",
    "First Half Status": "",
    "Second Half Status": ""
  },
  {
    "Employee ID": "101",
    "Employee Name": "Test User",
    "Date": "03-Jul-2026",
    "Swipe Count": "0",
    "In Time": "",
    "Out Time": "",
    "Total Working Hours - Swipes": "",
    "Actual Working Hours - Swipes (A)": "",
    "Total Working Hours - WFH": "1:16",
    "Actual Working Hours - WFH (B)": "1:16",
    "Actual Working Hours Swipe (A) + WFH (B) (HH:MM)": "1:16",
    "Status": "Onsite(India)",
    "First Half Status": "",
    "Second Half Status": ""
  },
  {
    "Employee ID": "101",
    "Employee Name": "Test User",
    "Date": "04-Jul-2026",
    "Swipe Count": "0",
    "In Time": "",
    "Out Time": "",
    "Total Working Hours - Swipes": "",
    "Actual Working Hours - Swipes (A)": "",
    "Total Working Hours - WFH": "",
    "Actual Working Hours - WFH (B)": "",
    "Actual Working Hours Swipe (A) + WFH (B) (HH:MM)": "0:00",
    "Status": "Weekly Off",
    "First Half Status": "",
    "Second Half Status": ""
  },
  {
    "Employee ID": "101",
    "Employee Name": "Test User",
    "Date": "05-Jul-2026",
    "Swipe Count": "0",
    "In Time": "",
    "Out Time": "",
    "Total Working Hours - Swipes": "",
    "Actual Working Hours - Swipes (A)": "",
    "Total Working Hours - WFH": "",
    "Actual Working Hours - WFH (B)": "",
    "Actual Working Hours Swipe (A) + WFH (B) (HH:MM)": "0:00",
    "Status": "Weekly Off",
    "First Half Status": "",
    "Second Half Status": ""
  },
  {
    "Employee ID": "101",
    "Employee Name": "Test User",
    "Date": "06-Jul-2026",
    "Swipe Count": "19",
    "In Time": "10:41 AM",
    "Out Time": "07:20 PM",
    "Total Working Hours - Swipes": "08:39",
    "Actual Working Hours - Swipes (A)": "08:39",
    "Total Working Hours - WFH": "",
    "Actual Working Hours - WFH (B)": "",
    "Actual Working Hours Swipe (A) + WFH (B) (HH:MM)": "08:39",
    "Status": "Present",
    "First Half Status": "",
    "Second Half Status": ""
  }
];

const mockTimetableData = [
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 Parking Tripode near the ATM",
    "Direction": "Entry",
    "Time": "10:41:13 AM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1st Floor Right Door",
    "Direction": "Entry",
    "Time": "10:41:48 AM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1F GOOGLE NEAR PRINTER",
    "Direction": "Entry",
    "Time": "10:41:55 AM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1F GOOGLE GLASS DOOR",
    "Direction": "Exit",
    "Time": "11:12:54 AM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1F GOOGLE GLASS DOOR",
    "Direction": "Entry",
    "Time": "11:16:24 AM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1F GOOGLE GLASS DOOR",
    "Direction": "Exit",
    "Time": "11:23:12 AM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1F GOOGLE GLASS DOOR",
    "Direction": "Entry",
    "Time": "11:26:27 AM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1F GOOGLE GLASS DOOR",
    "Direction": "Exit",
    "Time": "01:33:37 PM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1st Floor Right Door",
    "Direction": "Exit",
    "Time": "01:36:31 PM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1F GOOGLE GLASS DOOR",
    "Direction": "Exit",
    "Time": "02:15:58 PM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1F GOOGLE GLASS DOOR",
    "Direction": "Exit",
    "Time": "05:55:34 PM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1F GOOGLE GLASS DOOR",
    "Direction": "Entry",
    "Time": "05:59:04 PM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1F GOOGLE NEAR PRINTER",
    "Direction": "Exit",
    "Time": "07:19:40 PM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 1st Floor Right Door",
    "Direction": "Exit",
    "Time": "07:19:52 PM"
  },
  {
    "Employee ID": "101",
    "Date": "06-Jul-2026",
    "Machine Name": "CT2 Parking Tripode near the ATM",
    "Direction": "Exit",
    "Time": "07:20:19 PM"
  },
  {
    "Employee ID": "101",
    "Date": "07-Jul-2026",
    "Machine Name": "CT2 Parking Tripode near the ATM",
    "Direction": "Entry",
    "Time": "09:37:21 AM"
  },
  {
    "Employee ID": "101",
    "Date": "07-Jul-2026",
    "Machine Name": "CT2 1st Floor Right Door",
    "Direction": "Entry",
    "Time": "09:37:54 AM"
  },
  {
    "Employee ID": "101",
    "Date": "07-Jul-2026",
    "Machine Name": "CT2 1F GOOGLE NEAR PRINTER",
    "Direction": "Entry",
    "Time": "09:38:01 AM"
  },
  {
    "Employee ID": "101",
    "Date": "07-Jul-2026",
    "Machine Name": "CT2 1F GOOGLE GLASS DOOR",
    "Direction": "Exit",
    "Time": "09:39:55 AM"
  }
];

// Store in localStorage
localStorage.setItem('cybage_attendance', JSON.stringify(mockAttendanceData));
localStorage.setItem('cybage_timetable', JSON.stringify(mockTimetableData));

console.log("✅ Mock data successfully saved to localStorage!");
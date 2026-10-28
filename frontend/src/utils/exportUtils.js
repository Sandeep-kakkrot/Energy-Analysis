import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import html2canvas from 'html2canvas'
import { fmtKwh, fmtPct } from './formatters'

/**
 * Generate and download CSV report
 */
export function exportToCSV(reportData, filename = `Campus_Energy_Report_${new Date().toISOString().slice(0,10)}.csv`) {
  const { summary, buildings, peaks, wastage } = reportData

  let csvContent = 'CAMPUS ENERGY CONSUMPTION ANALYSIS REPORT\n'
  csvContent += `Generated At,${new Date().toLocaleString()}\n`
  csvContent += `Data Store,Hadoop HDFS / MySQL 8\n`
  csvContent += `Processing Engine,Apache Spark\n\n`

  // 1. Executive Summary
  csvContent += '=== EXECUTIVE SUMMARY ===\n'
  csvContent += 'Metric,Value,Unit,Notes\n'
  if (summary) {
    csvContent += `Total Energy Consumption,${summary.total_kwh || 0},kWh,YTD Total\n`
    csvContent += `Average Daily Consumption,${summary.avg_daily_kwh || 0},kWh/day,Mean across all days\n`
    csvContent += `Peak Hour Reading,${summary.peak_hour !== undefined ? summary.peak_hour + ':00' : 'N/A'},Hour,Busiest hour of day\n`
    csvContent += `Off-Hours Wastage,${summary.wastage_pct || 0},%,22:00-05:59 + Weekends\n`
    csvContent += `Total Monitored Records,${summary.total_records || 0},records,Hourly building measurements\n`
  }
  csvContent += '\n'

  // 2. Building Comparison
  csvContent += '=== BUILDING COMPARISON ===\n'
  csvContent += 'Building Code,Building Name,Type,Total kWh,Avg kWh/hr,Campus Share %,Intensity (kWh/sqft)\n'
  if (buildings && buildings.length) {
    buildings.forEach(b => {
      csvContent += `"${b.block_code || ''}","${b.name}","${b.type}",${b.total_kwh},${b.avg_kwh},${b.pct_share},${b.intensity_kwh_per_sqft}\n`
    })
  }
  csvContent += '\n'

  // 3. Peak Usage Analysis
  csvContent += '=== PEAK USAGE ANALYSIS (TOP PEAK HOURS) ===\n'
  csvContent += 'Peak Rank,Hour,Avg kWh,Total kWh\n'
  if (peaks && peaks.top_hours) {
    peaks.top_hours.forEach((h, i) => {
      csvContent += `${i + 1},${h.hour_of_day}:00,${h.avg_kwh},${h.total_kwh}\n`
    })
  }
  csvContent += '\n'

  // 4. Energy Wastage & Recommendations
  csvContent += '=== ENERGY WASTAGE & RECOMMENDATIONS ===\n'
  csvContent += 'Building Name,Off-Hours kWh,Weekend kWh,Total Wastage kWh,Wastage %,Severity,Action Recommendation\n'
  if (wastage && wastage.length) {
    wastage.forEach(w => {
      const rec = w.recommendation ? `"${w.recommendation.replace(/"/g, '""')}"` : '"N/A"'
      csvContent += `"${w.building_name}",${w.off_hours_kwh},${w.weekend_kwh},${w.total_wastage_kwh},${w.wastage_pct},${w.severity.toUpperCase()},${rec}\n`
    })
  }

  // Trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Generate and download Multi-Sheet Excel Workbook (.xlsx)
 */
export function exportToExcel(reportData, filename = `Campus_Energy_Report_${new Date().toISOString().slice(0,10)}.xlsx`) {
  const { summary, buildings, peaks, wastage } = reportData
  const wb = XLSX.utils.book_new()

  // Sheet 1: Executive Summary
  const summaryRows = [
    ['CAMPUS ENERGY CONSUMPTION ANALYSIS REPORT'],
    ['Generated At', new Date().toLocaleString()],
    ['Data Pipeline', 'Hadoop HDFS -> Apache Spark -> MySQL 8'],
    [],
    ['EXECUTIVE SUMMARY & KPIS'],
    ['Metric', 'Value', 'Unit', 'Description'],
    ['Total Consumption (YTD)', summary?.total_kwh || 0, 'kWh', 'Aggregate electricity consumption across campus'],
    ['Average Daily Consumption', summary?.avg_daily_kwh || 0, 'kWh/day', 'Mean daily consumption'],
    ['Peak Hour Reading', summary?.peak_hour !== undefined ? `${summary.peak_hour}:00` : 'N/A', 'Hour', 'Hour with highest overall demand'],
    ['Off-Hours Wastage Rate', summary?.wastage_pct ? `${summary.wastage_pct}%` : '0%', '%', 'Consumption outside 06:00-21:59 on weekdays'],
    ['Total Records Processed', summary?.total_records || 0, 'Rows', 'Spark batch job processed hourly readings']
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary')

  // Sheet 2: Building Comparison
  if (buildings && buildings.length) {
    const buildingData = buildings.map(b => ({
      'Code': b.block_code || 'N/A',
      'Building Name': b.name,
      'Type': b.type.toUpperCase(),
      'Total kWh': b.total_kwh,
      'Avg Hourly kWh': b.avg_kwh,
      'Campus Share (%)': b.pct_share,
      'Energy Intensity (kWh/sqft)': b.intensity_kwh_per_sqft
    }))
    const wsBuildings = XLSX.utils.json_to_sheet(buildingData)
    XLSX.utils.book_append_sheet(wb, wsBuildings, 'Building Comparison')
  }

  // Sheet 3: Peak Usage
  if (peaks && peaks.top_hours) {
    const peakData = peaks.top_hours.map((h, i) => ({
      'Rank': i + 1,
      'Hour of Day': `${h.hour_of_day}:00`,
      'Average kWh': h.avg_kwh,
      'Total Accumulated kWh': h.total_kwh
    }))
    const wsPeaks = XLSX.utils.json_to_sheet(peakData)
    XLSX.utils.book_append_sheet(wb, wsPeaks, 'Peak Usage')
  }

  // Sheet 4: Energy Wastage & Recommendations
  if (wastage && wastage.length) {
    const wastageData = wastage.map(w => ({
      'Building Name': w.building_name,
      'Off-Hours kWh (22:00-05:59)': w.off_hours_kwh,
      'Weekend kWh': w.weekend_kwh,
      'Total Wastage kWh': w.total_wastage_kwh,
      'Wastage Rate (%)': w.wastage_pct,
      'Severity Level': w.severity.toUpperCase(),
      'AI Recommendation': w.recommendation
    }))
    const wsWastage = XLSX.utils.json_to_sheet(wastageData)
    XLSX.utils.book_append_sheet(wb, wsWastage, 'Wastage & Recommendations')
  }

  XLSX.writeFile(wb, filename)
}

/**
 * Generate and download PDF Report with jsPDF and jsPDF-AutoTable
 */
export async function exportToPDF(reportData, chartElementId = null, filename = `Campus_Energy_Report_${new Date().toISOString().slice(0,10)}.pdf`) {
  const { summary, buildings, peaks, wastage } = reportData
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const primaryColor = [30, 41, 59]   // slate-800
  const brandColor   = [59, 130, 246]  // blue-500
  const accentColor  = [16, 185, 129]  // emerald-500
  const warningColor = [245, 158, 11]  // amber-500
  const dangerColor  = [239, 68, 68]   // red-500

  // Document Title Header
  doc.setFillColor(...primaryColor)
  doc.rect(0, 0, 210, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('CAMPUS ENERGY CONSUMPTION ANALYSIS', 14, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(203, 213, 225)
  doc.text('Hadoop HDFS Data Store · Apache Spark Engine · MySQL Analytics Store', 14, 20)

  doc.setFontSize(8)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 196, 20, { align: 'right' })

  let currentY = 36

  // 1. EXECUTIVE SUMMARY SECTION
  doc.setTextColor(...primaryColor)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('1. EXECUTIVE SUMMARY & KEY INDICATORS', 14, currentY)
  currentY += 4

  const summaryData = [
    [
      'Total kWh (YTD)', summary ? fmtKwh(summary.total_kwh) : 'N/A',
      'Avg kWh / Day', summary ? fmtKwh(summary.avg_daily_kwh) : 'N/A'
    ],
    [
      'Peak Usage Hour', summary && summary.peak_hour !== undefined ? `${summary.peak_hour}:00` : 'N/A',
      'Off-Hours Wastage %', summary ? fmtPct(summary.wastage_pct) : 'N/A'
    ]
  ]

  autoTable(doc, {
    startY: currentY,
    head: [['Metric', 'Value', 'Metric', 'Value']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillStyle: 'F', fillColor: brandColor, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  })

  currentY = doc.lastAutoTable.finalY + 8

  // OPTIONAL: Capture rendered chart HTML element if provided
  if (chartElementId) {
    const chartEl = document.getElementById(chartElementId)
    if (chartEl) {
      try {
        const canvas = await html2canvas(chartEl, { scale: 2, backgroundColor: '#0f172a' })
        const imgData = canvas.toDataURL('image/png')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(...primaryColor)
        doc.text('2. ANALYTICS CHARTS & VISUALIZATIONS', 14, currentY)
        currentY += 4

        const imgProps = doc.getImageProperties(imgData)
        const pdfWidth = 182
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
        doc.addImage(imgData, 'PNG', 14, currentY, pdfWidth, Math.min(pdfHeight, 80))
        currentY += Math.min(pdfHeight, 80) + 8
      } catch (e) {
        console.warn('Could not capture chart element for PDF', e)
      }
    }
  }

  // Check if space is low before Section 3
  if (currentY > 220) {
    doc.addPage()
    currentY = 20
  }

  // 3. BUILDING COMPARISON SECTION
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...primaryColor)
  doc.text('3. BUILDING COMPARISON ANALYSIS', 14, currentY)
  currentY += 4

  if (buildings && buildings.length) {
    const buildingTableRows = buildings.map(b => [
      b.block_code || '-',
      b.name,
      b.type.toUpperCase(),
      fmtKwh(b.total_kwh),
      b.avg_kwh.toFixed(2),
      `${b.pct_share}%`,
      b.intensity_kwh_per_sqft.toFixed(4)
    ])

    autoTable(doc, {
      startY: currentY,
      head: [['Code', 'Building Name', 'Type', 'Total kWh', 'Avg kWh/h', 'Share %', 'kWh / sqft']],
      body: buildingTableRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
      margin: { left: 14, right: 14 }
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  // Check space before Section 4
  if (currentY > 220) {
    doc.addPage()
    currentY = 20
  }

  // 4. PEAK USAGE ANALYSIS SECTION
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...primaryColor)
  doc.text('4. PEAK USAGE & BUSIEST HOURS', 14, currentY)
  currentY += 4

  if (peaks && peaks.top_hours) {
    const peakTableRows = peaks.top_hours.map((h, idx) => [
      `#${idx + 1}`,
      `${h.hour_of_day}:00 - ${h.hour_of_day + 1}:00`,
      fmtKwh(h.avg_kwh),
      fmtKwh(h.total_kwh),
      idx === 0 ? 'Highest Demand Period' : 'Peak Period'
    ])

    autoTable(doc, {
      startY: currentY,
      head: [['Rank', 'Hour Window', 'Average Demand', 'Accumulated Demand', 'Status']],
      body: peakTableRows,
      theme: 'grid',
      headStyles: { fillColor: warningColor, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
      margin: { left: 14, right: 14 }
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  // Check space before Section 5
  if (currentY > 210) {
    doc.addPage()
    currentY = 20
  }

  // 5. RECOMMENDATIONS & WASTAGE REPORT SECTION
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...primaryColor)
  doc.text('5. ENERGY WASTAGE & AI RECOMMENDATIONS', 14, currentY)
  currentY += 4

  if (wastage && wastage.length) {
    const wastageRows = wastage.map(w => [
      w.building_name,
      fmtKwh(w.off_hours_kwh),
      fmtKwh(w.weekend_kwh),
      fmtPct(w.wastage_pct),
      w.severity.toUpperCase(),
      w.recommendation
    ])

    autoTable(doc, {
      startY: currentY,
      head: [['Building', 'Off-Hours', 'Weekend', 'Wastage %', 'Severity', 'Action Recommendation']],
      body: wastageRows,
      theme: 'grid',
      headStyles: { fillColor: dangerColor, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
      columnStyles: {
        5: { cellWidth: 60 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const val = data.cell.raw
          if (val === 'HIGH') data.cell.styles.textColor = dangerColor
          else if (val === 'MEDIUM') data.cell.styles.textColor = warningColor
          else if (val === 'LOW') data.cell.styles.textColor = accentColor
        }
      },
      margin: { left: 14, right: 14 }
    })
    currentY = doc.lastAutoTable.finalY + 10
  }

  // Add Page Numbers and Footer to all pages
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(`Campus Energy Analytics — Hadoop & Spark Platform`, 14, 287)
    doc.text(`Page ${i} of ${pageCount}`, 196, 287, { align: 'right' })
  }

  doc.save(filename)
}

// ─── Page-level dataset export helpers ────────────────────────────────────────

const TS = () => new Date().toISOString().slice(0, 10)

/** Helper: trigger browser file download */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Building Comparison ──────────────────────────────────────────────────────

export function exportBuildingsToExcel(buildings, filename = `Buildings_${TS()}.xlsx`) {
  const wb = XLSX.utils.book_new()
  const rows = (buildings || []).map(b => ({
    'Block Code': b.block_code || '',
    'Building Name': b.name,
    'Type': b.type,
    'Capacity': b.capacity ?? '',
    'Area (sqft)': b.area_sqft ?? '',
    'Total kWh': b.total_kwh,
    'Avg kWh / hr': b.avg_kwh,
    'Campus Share (%)': b.pct_share,
    'Energy Intensity (kWh/sqft)': b.intensity_kwh_per_sqft,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Building Comparison')
  XLSX.writeFile(wb, filename)
}

export function exportBuildingsToCSV(buildings, filename = `Buildings_${TS()}.csv`) {
  const header = 'Block Code,Building Name,Type,Capacity,Area (sqft),Total kWh,Avg kWh/hr,Campus Share (%),kWh/sqft\n'
  const body = (buildings || []).map(b =>
    `"${b.block_code || ''}","${b.name}","${b.type}",${b.capacity ?? ''},${b.area_sqft ?? ''},${b.total_kwh},${b.avg_kwh},${b.pct_share},${b.intensity_kwh_per_sqft}`
  ).join('\n')
  triggerDownload(new Blob([header + body], { type: 'text/csv;charset=utf-8;' }), filename)
}

// ── Daily Trends ─────────────────────────────────────────────────────────────

export function exportDailyTrendsToPDF(reportData, filename = `DailyTrends_Report_${TS()}.pdf`) {
  const { rows = [], stats = {}, activeBuildings = [], rangeDays = 30 } = reportData || {}
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const primaryColor = [15, 23, 42]   // slate-900
  const brandColor   = [59, 130, 246]  // blue-500
  const darkSubColor = [100, 116, 139] // slate-500

  // Header banner
  doc.setFillColor(...primaryColor)
  doc.rect(0, 0, 210, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('CAMPUS ENERGY DAILY CONSUMPTION REPORT', 14, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(203, 213, 225)
  doc.text(`Time Horizon: Last ${rangeDays} Days | Active Buildings: ${activeBuildings.length ? activeBuildings.join(', ') : 'All Campus'}`, 14, 20)

  doc.setFontSize(8)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 196, 20, { align: 'right' })

  let currentY = 36

  // 1. Executive Summary Table
  doc.setTextColor(...primaryColor)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('1. EXECUTIVE SUMMARY & DAILY METRICS', 14, currentY)
  currentY += 4

  const summaryData = [
    [
      'Total Period Load', stats.total ? fmtKwh(stats.total) : 'N/A',
      'Average Daily Load', stats.avgDay ? fmtKwh(stats.avgDay) : 'N/A'
    ],
    [
      'Peak Day Reading', stats.maxDay ? fmtKwh(stats.maxDay) : 'N/A',
      'Lowest Day Reading', stats.minDay ? fmtKwh(stats.minDay) : 'N/A'
    ],
    [
      'Peak Surge Count (>150 kWh)', `${stats.surgeDaysCount || 0} days`,
      'Estimated Tariff Cost', stats.estCost ? `$${Number(stats.estCost).toFixed(2)}` : 'N/A'
    ]
  ]

  autoTable(doc, {
    startY: currentY,
    head: [['Metric', 'Value', 'Metric', 'Value']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: brandColor, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  })

  currentY = doc.lastAutoTable.finalY + 8

  // 2. Building Share Breakdown
  if (stats.buildingBreakdown && stats.buildingBreakdown.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...primaryColor)
    doc.text('2. BUILDING CONSUMPTION BREAKDOWN IN PERIOD', 14, currentY)
    currentY += 4

    const bRows = stats.buildingBreakdown.map(b => [
      b.name,
      fmtKwh(b.total),
      fmtKwh(b.dailyAvg),
      fmtPct(b.sharePct)
    ])

    autoTable(doc, {
      startY: currentY,
      head: [['Building Name', 'Total kWh', 'Daily Avg (kWh)', 'Campus Share %']],
      body: bRows,
      theme: 'grid',
      headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    })

    currentY = doc.lastAutoTable.finalY + 8
  }

  // 3. Daily Reading Log (up to 30 most recent rows)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...primaryColor)
  doc.text('3. DAILY OBSERVATION LOG (RECENT DATES)', 14, currentY)
  currentY += 4

  const logRows = (rows.slice(-25) || []).map(r => {
    const totalVal = r.total || 0
    const status = totalVal >= 150 ? 'PEAK / SURGE' : totalVal >= 120 ? 'ELEVATED' : 'NORMAL'
    return [
      r.rec_date || r.date || 'N/A',
      fmtKwh(totalVal),
      status
    ]
  })

  autoTable(doc, {
    startY: currentY,
    head: [['Observation Date', 'Total Consumption (kWh)', 'Status Level']],
    body: logRows,
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  })

  // Footer Note
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(...darkSubColor)
    doc.text(
      `Campus Energy Intelligence System · Page ${i} of ${pageCount}`,
      105,
      290,
      { align: 'center' }
    )
  }

  doc.save(filename)
}

export function exportDailyTrendsToExcel(rows, filename = `DailyTrends_${TS()}.xlsx`) {
  const wb = XLSX.utils.book_new()
  const data = (rows || []).map(r => {
    const entry = { Date: r.rec_date || r.date, 'Total kWh': r.total ?? '' }
    // include any building columns present
    Object.keys(r).forEach(k => {
      if (k !== 'rec_date' && k !== 'date' && k !== 'total') entry[k] = r[k]
    })
    return entry
  })
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Trends')
  XLSX.writeFile(wb, filename)
}

export function exportDailyTrendsToCSV(rows, filename = `DailyTrends_${TS()}.csv`) {
  if (!rows || rows.length === 0) return
  const keys = Object.keys(rows[0])
  const header = keys.join(',') + '\n'
  const body = rows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(',')).join('\n')
  triggerDownload(new Blob([header + body], { type: 'text/csv;charset=utf-8;' }), filename)
}

// ── Monthly Trends ────────────────────────────────────────────────────────────

export function exportMonthlyTrendsToExcel(rows, filename = `MonthlyTrends_${TS()}.xlsx`) {
  const wb = XLSX.utils.book_new()
  const data = (rows || []).map(r => {
    const entry = { Month: r.month || r.month_label, 'Total kWh': r.total ?? '' }
    Object.keys(r).forEach(k => {
      if (k !== 'month' && k !== 'month_label' && k !== 'total') entry[k] = r[k]
    })
    return entry
  })
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Monthly Trends')
  XLSX.writeFile(wb, filename)
}

export function exportMonthlyTrendsToCSV(rows, filename = `MonthlyTrends_${TS()}.csv`) {
  if (!rows || rows.length === 0) return
  const keys = Object.keys(rows[0])
  const header = keys.join(',') + '\n'
  const body = rows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(',')).join('\n')
  triggerDownload(new Blob([header + body], { type: 'text/csv;charset=utf-8;' }), filename)
}

// ── Peak Usage ────────────────────────────────────────────────────────────────

export function exportPeakUsageToExcel(peakData, filename = `PeakUsage_${TS()}.xlsx`) {
  const wb = XLSX.utils.book_new()

  const hourRows = (peakData?.top_hours || []).map((h, i) => ({
    Rank: i + 1,
    'Hour': `${h.hour_of_day ?? h.hour}:00`,
    'Avg kWh': h.avg_kwh,
    'Total kWh': h.total_kwh,
  }))
  if (hourRows.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hourRows), 'Top Peak Hours')
  }

  const dayRows = (peakData?.top_days || []).map((d, i) => ({
    Rank: i + 1,
    'Day': d.day_name || d.day,
    'Avg kWh': d.avg_kwh,
    'Total kWh': d.total_kwh,
  }))
  if (dayRows.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dayRows), 'Top Days')
  }

  const heatRows = (peakData?.heatmap || []).map(h => ({
    Hour: h.hour,
    Day: h.day,
    'Avg kWh': h.avg_kwh,
  }))
  if (heatRows.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(heatRows), 'Heatmap')
  }

  XLSX.writeFile(wb, filename)
}

export function exportPeakUsageToCSV(peakData, filename = `PeakUsage_${TS()}.csv`) {
  let csv = '=== TOP PEAK HOURS ===\nRank,Hour,Avg kWh,Total kWh\n'
  ;(peakData?.top_hours || []).forEach((h, i) => {
    csv += `${i + 1},${h.hour_of_day ?? h.hour}:00,${h.avg_kwh},${h.total_kwh}\n`
  })
  csv += '\n=== TOP DAYS ===\nRank,Day,Avg kWh,Total kWh\n'
  ;(peakData?.top_days || []).forEach((d, i) => {
    csv += `${i + 1},"${d.day_name || d.day}",${d.avg_kwh},${d.total_kwh}\n`
  })
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
}

// ── Wastage Indicators ────────────────────────────────────────────────────────

export function exportWastageToExcel(buildings, filename = `WastageReport_${TS()}.xlsx`) {
  const wb = XLSX.utils.book_new()
  const rows = (buildings || []).map(b => {
    const isNa = Boolean(b.is_na || b.severity === 'n/a')
    return {
      'Building Name': b.building_name,
      'Total kWh': b.total_kwh,
      'Off-Hours kWh': isNa ? '0 (24/7 Exempt)' : b.off_hours_kwh,
      'Weekend kWh': isNa ? '0 (24/7 Exempt)' : b.weekend_kwh,
      'Total Wastage kWh': isNa ? 0 : (b.total_wastage_kwh ?? b.wastage_kwh ?? 0),
      'Wastage (%)': isNa ? (b.status_text || 'N/A – Hostel Operates 24/7') : b.wastage_pct,
      'Severity': isNa ? 'N/A – 24/7 NORMAL' : b.severity?.toUpperCase(),
      'AI Recommendation': b.recommendation,
    }
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Wastage Report')
  XLSX.writeFile(wb, filename)
}

export function exportWastageToCSV(buildings, filename = `WastageReport_${TS()}.csv`) {
  const header = 'Building Name,Total kWh,Off-Hours kWh,Weekend kWh,Total Wastage kWh,Wastage (%),Severity,Recommendation\n'
  const body = (buildings || []).map(b => {
    const isNa = Boolean(b.is_na || b.severity === 'n/a')
    const rec = b.recommendation ? `"${b.recommendation.replace(/"/g, '""')}"` : ''
    const wastage = isNa ? 0 : (b.total_wastage_kwh ?? b.wastage_kwh ?? 0)
    const offHours = isNa ? 0 : b.off_hours_kwh
    const weekend = isNa ? 0 : b.weekend_kwh
    const pct = isNa ? `"${b.status_text || 'N/A – Hostel Operates 24/7'}"` : b.wastage_pct
    const sev = isNa ? 'N/A – 24/7 NORMAL' : b.severity?.toUpperCase()
    return `"${b.building_name}",${b.total_kwh},${offHours},${weekend},${wastage},${pct},${sev},${rec}`
  }).join('\n')
  triggerDownload(new Blob([header + body], { type: 'text/csv;charset=utf-8;' }), filename)
}

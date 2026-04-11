import ExcelJS from 'exceljs';
import { isWorkingDay, getScheduleForDate } from './schedule.service.js';
import type { IDepartmentTimesheetData } from './timesheet-export.service.js';

const STATUS_LABELS: Record<string, string> = {
  work: '', sick: 'Б', vacation: 'ОТ', absent: 'Н',
  business_trip: 'К', dayoff: 'В', remote: 'УУ', unpaid: 'НО', manual: '',
};

const WORKED_STATUSES = new Set(['work', 'manual', 'remote', 'business_trip']);

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, left: { style: 'thin' },
  bottom: { style: 'thin' }, right: { style: 'thin' },
};
// Цвета как в образце "Тердерный отдел.xls"
const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0C0C0' } };
const docRowFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE8DF' } };
const correctedFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB3E5FC' } };
// Подсветка недоработок в СКУД-строке (оранжево-жёлтая для контраста)
const underworkFill: ExcelJS.Fill = { type: 'pattern', pattern: 'lightDown', fgColor: { argb: 'FFB3AC86' } };
const statusFills: Record<string, ExcelJS.Fill> = {
  sick:          { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } },
  vacation:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBBDEFB' } },
  business_trip: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE1BEE7' } },
  dayoff:        { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } },
  unpaid:        { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } },
  absent:        { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF8A80' } },
  remote:        { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8E6C9' } },
};

const formatHHMM = (decimalHours: number): string => {
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

// Column indices
const COL_NUM = 1;
const COL_FIO = 2;
const COL_TAB = 3;
const COL_SOURCE = 4;
const COL_DAY_START = 5;

export function buildTimesheetSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  data: IDepartmentTimesheetData,
): void {
  const { employees, schedulesMap, dailySchedulesMap, dataMap, skudMap, year, mon, daysInMonth, departmentName } = data;

  const colDays = COL_DAY_START + daysInMonth;       // first "Дней" col
  const colHours = colDays + 2;                        // first "Часов" col
  const totalCols = colHours + 1;                      // last col

  const ws = wb.addWorksheet(sheetName);

  // Column widths
  ws.getColumn(COL_NUM).width = 6;
  ws.getColumn(COL_FIO).width = 30;
  ws.getColumn(COL_TAB).width = 12;
  ws.getColumn(COL_SOURCE).width = 12;
  for (let d = 0; d < daysInMonth; d++) ws.getColumn(COL_DAY_START + d).width = 7;
  ws.getColumn(colDays).width = 5;
  ws.getColumn(colDays + 1).width = 5;
  ws.getColumn(colHours).width = 7;
  ws.getColumn(colHours + 1).width = 7;

  const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // --- Row 1: Подразделение ---
  ws.mergeCells(1, 1, 1, totalCols);
  const r1 = ws.getCell(1, 1);
  r1.value = `Подразделение: ${departmentName}`;
  r1.font = { bold: true, size: 12 };
  r1.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(1).height = 20;

  // --- Row 2: Title ---
  ws.mergeCells(2, 1, 2, totalCols);
  const r2 = ws.getCell(2, 1);
  const startDateStr = `${pad2(1)}.${pad2(mon)}.${String(year).slice(2)}`;
  const endDateStr = `${pad2(daysInMonth)}.${pad2(mon)}.${String(year).slice(2)}`;
  r2.value = `Табель учета отработанного времени (предварительная форма). За период с ${startDateStr} по ${endDateStr}`;
  r2.font = { bold: true, size: 10 };
  r2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(2).height = 30;

  // --- Row 3: empty ---
  ws.getRow(3).height = 5;

  // --- Row 4-5: Headers ---
  // Row 4: merged labels
  ws.mergeCells(4, COL_NUM, 5, COL_NUM);
  const hNum = ws.getCell(4, COL_NUM);
  hNum.value = '№ П/П';
  hNum.font = { bold: true, size: 8 };
  hNum.alignment = centerAlign;
  hNum.fill = headerFill;

  ws.mergeCells(4, COL_FIO, 5, COL_FIO);
  const hFio = ws.getCell(4, COL_FIO);
  hFio.value = 'ФИО';
  hFio.font = { bold: true, size: 8 };
  hFio.alignment = centerAlign;
  hFio.fill = headerFill;

  ws.mergeCells(4, COL_TAB, 5, COL_TAB);
  const hTab = ws.getCell(4, COL_TAB);
  hTab.value = 'Табельный\nномер';
  hTab.font = { bold: true, size: 8 };
  hTab.alignment = centerAlign;
  hTab.fill = headerFill;

  ws.mergeCells(4, COL_SOURCE, 5, COL_SOURCE);
  const hSrc = ws.getCell(4, COL_SOURCE);
  hSrc.value = 'Источник';
  hSrc.font = { bold: true, size: 8 };
  hSrc.alignment = centerAlign;
  hSrc.fill = headerFill;

  // Days header merged across row 4
  ws.mergeCells(4, COL_DAY_START, 4, COL_DAY_START + daysInMonth - 1);
  const hDays = ws.getCell(4, COL_DAY_START);
  hDays.value = 'Отметки о явках и неявках на работу по числам месяца';
  hDays.font = { bold: true, size: 8 };
  hDays.alignment = centerAlign;
  hDays.fill = headerFill;

  // "Отработано" merged across Дней + Часов (4 cols) in row 4
  ws.mergeCells(4, colDays, 4, totalCols);
  const hWorked = ws.getCell(4, colDays);
  hWorked.value = 'Отработано';
  hWorked.font = { bold: true, size: 8 };
  hWorked.alignment = centerAlign;
  hWorked.fill = headerFill;

  // Row 5: day numbers + Дней/Часов
  for (let d = 0; d < daysInMonth; d++) {
    const cell = ws.getCell(5, COL_DAY_START + d);
    cell.value = d + 1;
    cell.font = { bold: true, size: 8 };
    cell.alignment = centerAlign;
    cell.fill = headerFill;
  }

  ws.mergeCells(5, colDays, 5, colDays + 1);
  const hDaysLabel = ws.getCell(5, colDays);
  hDaysLabel.value = 'Дней';
  hDaysLabel.font = { bold: true, size: 8 };
  hDaysLabel.alignment = centerAlign;
  hDaysLabel.fill = headerFill;

  ws.mergeCells(5, colHours, 5, totalCols);
  const hHoursLabel = ws.getCell(5, colHours);
  hHoursLabel.value = 'Часов';
  hHoursLabel.font = { bold: true, size: 8 };
  hHoursLabel.alignment = centerAlign;
  hHoursLabel.fill = headerFill;

  // --- Row 6: column group numbers ---
  const row6 = ws.getRow(6);
  row6.getCell(COL_NUM).value = 1;
  row6.getCell(COL_FIO).value = 2;
  row6.getCell(COL_TAB).value = 3;
  row6.getCell(COL_SOURCE).value = 4;
  ws.mergeCells(6, COL_DAY_START, 6, COL_DAY_START + daysInMonth - 1);
  row6.getCell(COL_DAY_START).value = 5;
  ws.mergeCells(6, colDays, 6, totalCols);
  row6.getCell(colDays).value = 6;
  for (let c = 1; c <= totalCols; c++) {
    const cell = row6.getCell(c);
    cell.font = { size: 7, color: { argb: 'FF999999' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // --- Employee data: 2 rows per employee ---
  const DATA_START_ROW = 7;

  let grandDocDays = 0;
  let grandDocHours = 0;
  let grandSkudDays = 0;
  let grandSkudHours = 0;

  employees.forEach((emp, idx) => {
    const sched = schedulesMap.get(emp.id);
    const docRow = DATA_START_ROW + idx * 2;
    const skudRow = docRow + 1;

    // Merge A, B, C across 2 rows
    ws.mergeCells(docRow, COL_NUM, skudRow, COL_NUM);
    ws.mergeCells(docRow, COL_FIO, skudRow, COL_FIO);
    ws.mergeCells(docRow, COL_TAB, skudRow, COL_TAB);

    // № П/П
    const numCell = ws.getCell(docRow, COL_NUM);
    numCell.value = idx + 1;
    numCell.alignment = centerAlign;

    // ФИО
    const fioCell = ws.getCell(docRow, COL_FIO);
    fioCell.value = emp.full_name;
    fioCell.alignment = { vertical: 'middle', wrapText: true };

    // Таб. номер
    const tabCell = ws.getCell(docRow, COL_TAB);
    tabCell.value = emp.sigur_employee_id ?? '';
    tabCell.alignment = centerAlign;

    // Источник
    const docSrcCell = ws.getCell(docRow, COL_SOURCE);
    docSrcCell.value = 'Документ';
    docSrcCell.alignment = centerAlign;
    docSrcCell.font = { size: 8 };

    const skudSrcCell = ws.getCell(skudRow, COL_SOURCE);
    skudSrcCell.value = 'СКУД';
    skudSrcCell.alignment = centerAlign;
    skudSrcCell.font = { size: 8 };

    const empData = dataMap.get(emp.id);
    const empSkud = skudMap.get(emp.id);

    let docDaysCount = 0;
    let docHoursSum = 0;
    let skudDaysCount = 0;
    let skudHoursSum = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad2(mon)}-${pad2(d)}`;
      const dateObj = new Date(year, mon - 1, d);
      const daySched = dailySchedulesMap.get(emp.id)?.get(dateStr) || sched;
      const col = COL_DAY_START + d - 1;

      const docCell = ws.getCell(docRow, col);
      const skCell = ws.getCell(skudRow, col);
      docCell.alignment = { horizontal: 'center', vertical: 'middle' };
      skCell.alignment = { horizontal: 'center', vertical: 'middle' };
      docCell.font = { size: 8 };
      skCell.font = { size: 8 };

      const isDayOff = daySched ? !isWorkingDay(daySched, dateObj) : (dateObj.getDay() === 0 || dateObj.getDay() === 6);

      if (isDayOff) {
        docCell.value = '';
        skCell.value = '';
        continue;
      }

      // --- "Документ" row (бежевый фон по умолчанию) ---
      docCell.fill = docRowFill;
      const entry = empData?.get(dateStr);
      if (entry) {
        const label = STATUS_LABELS[entry.status];
        if (label) {
          docCell.value = label;
          if (statusFills[entry.status]) docCell.fill = statusFills[entry.status];
          if (WORKED_STATUSES.has(entry.status)) {
            docDaysCount++;
            docHoursSum += entry.hours;
          }
        } else {
          const schedHours = daySched ? getScheduleForDate(daySched, dateObj).work_hours : 8;
          docCell.value = schedHours;
          docDaysCount++;
          docHoursSum += schedHours;
          if (entry.corrected) docCell.fill = correctedFill;
        }
      } else {
        docCell.value = '';
      }

      // --- "СКУД" row (штриховка для недоработок) ---
      const skudEntry = empSkud?.get(dateStr);
      if (skudEntry && skudEntry.hours > 0) {
        const timeStr = ` ${formatHHMM(skudEntry.hours)}`;
        skCell.value = skudEntry.corrected ? `${timeStr}Кор` : timeStr;
        // Подсветка недоработок: часы ниже нормы расписания
        const normHours = daySched ? getScheduleForDate(daySched, dateObj).work_hours : 8;
        if (skudEntry.hours < normHours) {
          skCell.fill = underworkFill;
        }
        if (skudEntry.corrected) skCell.fill = correctedFill;
        skudDaysCount++;
        skudHoursSum += skudEntry.hours;
      } else {
        skCell.value = '';
      }
    }

    // --- Summary columns ---
    // Дней (merged 2 cols per row, NOT merged across doc/skud rows)
    ws.mergeCells(docRow, colDays, docRow, colDays + 1);
    ws.mergeCells(skudRow, colDays, skudRow, colDays + 1);
    const docDaysCell = ws.getCell(docRow, colDays);
    docDaysCell.value = docDaysCount;
    docDaysCell.alignment = centerAlign;
    docDaysCell.fill = docRowFill;
    const skudDaysCell = ws.getCell(skudRow, colDays);
    skudDaysCell.value = skudDaysCount;
    skudDaysCell.alignment = centerAlign;

    // Часов (merged 2 cols per row)
    ws.mergeCells(docRow, colHours, docRow, totalCols);
    ws.mergeCells(skudRow, colHours, skudRow, totalCols);
    const docHoursCell = ws.getCell(docRow, colHours);
    docHoursCell.value = Math.round(docHoursSum);
    docHoursCell.alignment = centerAlign;
    docHoursCell.fill = docRowFill;
    const skudHoursCell = ws.getCell(skudRow, colHours);
    skudHoursCell.value = skudHoursSum > 0 ? formatHHMM(skudHoursSum) : '0:00';
    skudHoursCell.alignment = centerAlign;

    grandDocDays += docDaysCount;
    grandDocHours += docHoursSum;
    grandSkudDays += skudDaysCount;
    grandSkudHours += skudHoursSum;
  });

  // --- ИТОГО rows ---
  const itogoDocRow = DATA_START_ROW + employees.length * 2;
  const itogoSkudRow = itogoDocRow + 1;

  ws.mergeCells(itogoDocRow, COL_NUM, itogoSkudRow, COL_SOURCE);
  const itogoCell = ws.getCell(itogoDocRow, COL_NUM);
  itogoCell.value = 'ИТОГО';
  itogoCell.font = { bold: true, size: 10 };
  itogoCell.alignment = centerAlign;

  // Дней итого
  ws.mergeCells(itogoDocRow, colDays, itogoDocRow, colDays + 1);
  ws.getCell(itogoDocRow, colDays).value = grandDocDays;
  ws.getCell(itogoDocRow, colDays).alignment = centerAlign;
  ws.getCell(itogoDocRow, colDays).font = { bold: true };

  ws.mergeCells(itogoSkudRow, colDays, itogoSkudRow, colDays + 1);
  ws.getCell(itogoSkudRow, colDays).value = grandSkudDays;
  ws.getCell(itogoSkudRow, colDays).alignment = centerAlign;
  ws.getCell(itogoSkudRow, colDays).font = { bold: true };

  // Часов итого
  ws.mergeCells(itogoDocRow, colHours, itogoDocRow, totalCols);
  ws.getCell(itogoDocRow, colHours).value = Math.round(grandDocHours);
  ws.getCell(itogoDocRow, colHours).alignment = centerAlign;
  ws.getCell(itogoDocRow, colHours).font = { bold: true };

  ws.mergeCells(itogoSkudRow, colHours, itogoSkudRow, totalCols);
  ws.getCell(itogoSkudRow, colHours).value = formatHHMM(grandSkudHours);
  ws.getCell(itogoSkudRow, colHours).alignment = centerAlign;
  ws.getCell(itogoSkudRow, colHours).font = { bold: true };

  // --- Borders ---
  const lastDataRow = itogoSkudRow;
  for (let r = 4; r <= lastDataRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= totalCols; c++) {
      row.getCell(c).border = thinBorder;
    }
  }
}

/** Sanitize sheet name for Excel (max 31 chars, no special chars) */
export function sanitizeSheetName(name: string): string {
  return name.replace(/[\/\\?*\[\]:]/g, '_').slice(0, 31);
}

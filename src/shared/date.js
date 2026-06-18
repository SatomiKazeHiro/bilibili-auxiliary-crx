import dayjs from 'dayjs';

export const CATEGORIES = [
  { key: 'today', label: '今天' },
  { key: 'thisWeek', label: '本周' },
  { key: 'thisMonth', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'thisQuarter', label: '本季度' },
  { key: 'thisYear', label: '本年' },
  { key: 'longAgo', label: '很久以前' },
  { key: 'invalid', label: '已失效' }
];

export function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = dayjs(dateStr.replace(' ', 'T'));
  return d.isValid() ? d : null;
}

export function formatShortDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return dateStr || '';
  const now = dayjs();
  return d.isSame(now, 'year') ? d.format('MM-DD') : d.format('YYYY-MM-DD');
}

export function formatDate(dateStr) {
  const d = parseDate(dateStr);
  return d ? d.format('YYYY-MM-DD') : '未知';
}

export function getCategoryKey(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return 'invalid';

  const now = dayjs();

  if (d.isSame(now, 'day')) return 'today';

  const weekStart = now.startOf('week').add(1, 'day');
  const weekEnd = weekStart.add(6, 'day').endOf('day');
  if (d.isAfter(weekStart.subtract(1, 'ms')) && d.isBefore(weekEnd.add(1, 'ms'))) {
    return 'thisWeek';
  }

  if (d.isSame(now, 'month')) return 'thisMonth';
  if (d.isSame(now.subtract(1, 'month'), 'month')) return 'lastMonth';

  const quarter = Math.floor(now.month() / 3);
  const qStart = now.startOf('year').add(quarter * 3, 'month');
  const qEnd = qStart.add(3, 'month').subtract(1, 'ms');
  if (d.isAfter(qStart.subtract(1, 'ms')) && d.isBefore(qEnd.add(1, 'ms'))) {
    return 'thisQuarter';
  }

  if (d.isSame(now, 'year')) return 'thisYear';

  return 'longAgo';
}

export function formatNoteTime(timestamp) {
  if (!timestamp) return '';
  const d = dayjs(timestamp);
  return d.isValid() ? d.format('MM-DD HH:mm') : '';
}

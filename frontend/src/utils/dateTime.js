const INDIA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

export function formatIndiaDateTime(timestamp) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  return INDIA_DATE_TIME_FORMATTER.format(date)
}

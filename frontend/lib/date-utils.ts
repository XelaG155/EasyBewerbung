/**
 * Date formatting utilities based on user preferences.
 */

export type DateFormatType = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD.MM.YYYY' | 'DD-MM-YYYY';

/**
 * Format a date string according to the specified format.
 * @param dateString - ISO date string or Date object
 * @param format - The format to use (e.g., "DD/MM/YYYY")
 * @param includeTime - Whether to include time in the output
 * @returns Formatted date string
 */
export function formatDate(
  dateString: string | Date | null | undefined,
  format: DateFormatType = 'DD/MM/YYYY',
  includeTime: boolean = true
): string {
  if (!dateString) return 'No date';

  try {
    // Parse the date
    let date: Date;
    if (typeof dateString === 'string') {
      // Handle dates that might not have timezone info
      const normalized = dateString.endsWith('Z') || dateString.includes('+')
        ? dateString
        : dateString + 'Z';
      date = new Date(normalized);
    } else {
      date = dateString;
    }

    // Check for invalid date
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    let formattedDate: string;

    switch (format) {
      case 'DD/MM/YYYY':
        formattedDate = `${day}/${month}/${year}`;
        break;
      case 'MM/DD/YYYY':
        formattedDate = `${month}/${day}/${year}`;
        break;
      case 'YYYY-MM-DD':
        formattedDate = `${year}-${month}-${day}`;
        break;
      case 'DD.MM.YYYY':
        formattedDate = `${day}.${month}.${year}`;
        break;
      case 'DD-MM-YYYY':
        formattedDate = `${day}-${month}-${year}`;
        break;
      default:
        formattedDate = `${day}/${month}/${year}`;
    }

    if (includeTime) {
      formattedDate += ` ${hours}:${minutes}:${seconds}`;
    }

    return formattedDate;
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format a date for display, using the user's date format preference.
 * This is a convenience wrapper that reads from localStorage or accepts explicit format.
 */
export function formatUserDate(
  dateString: string | Date | null | undefined,
  userDateFormat?: string,
  includeTime: boolean = true
): string {
  const format = (userDateFormat || 'DD/MM/YYYY') as DateFormatType;
  return formatDate(dateString, format, includeTime);
}

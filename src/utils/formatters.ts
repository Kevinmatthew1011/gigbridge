import { Paise } from '../types/finance';

/**
 * Formats integer paise into standard Indian Rupee (INR) representation.
 * Example: 70000 -> "₹700", -40000 -> "-₹400", 125050 -> "₹1,250.50"
 */
export function formatINR(
  paise: Paise,
  options?: {
    showPaiseIfZero?: boolean;
    showSign?: boolean;
  }
): string {
  if (typeof paise !== 'number' || !Number.isFinite(paise)) {
    return '₹0';
  }

  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(paise));
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;

  // Indian number formatting for rupees
  const formattedRupees = rupees.toLocaleString('en-IN');

  let amountStr = '';
  if (remainingPaise > 0 || options?.showPaiseIfZero) {
    amountStr = `${formattedRupees}.${remainingPaise.toString().padStart(2, '0')}`;
  } else {
    amountStr = formattedRupees;
  }

  if (isNegative) {
    return `-₹${amountStr}`;
  }
  if (options?.showSign && paise > 0) {
    return `+₹${amountStr}`;
  }
  return `₹${amountStr}`;
}

/**
 * Converts decimal INR string or number to integer paise.
 * Validates strictly:
 * - Allows at most two decimal places (e.g. "500", "500.5", "500.50")
 * - Disallows negative values unless allowNegative = true
 * - Disallows empty or non-numeric strings
 * - Disallows unsafe integer ranges
 */
export interface ParseResult {
  isValid: boolean;
  paise: Paise;
  error?: string;
}

export function parseINRToPaise(
  input: string | number,
  options?: { allowNegative?: boolean; fieldName?: string }
): ParseResult {
  const fieldName = options?.fieldName || 'Amount';

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      return { isValid: false, paise: 0, error: `${fieldName} is not a valid finite number` };
    }
    input = input.toString();
  }

  const raw = (input ?? '').trim();
  if (raw === '') {
    return { isValid: false, paise: 0, error: `${fieldName} is required` };
  }

  // Check valid decimal format
  const pattern = options?.allowNegative
    ? /^-?\d+(\.\d{1,2})?$/
    : /^\d+(\.\d{1,2})?$/;

  if (!pattern.test(raw)) {
    if (raw.startsWith('-') && !options?.allowNegative) {
      return { isValid: false, paise: 0, error: `${fieldName} cannot be negative` };
    }
    if (/\.\d{3,}/.test(raw)) {
      return { isValid: false, paise: 0, error: `${fieldName} cannot have more than 2 decimal places` };
    }
    return { isValid: false, paise: 0, error: `${fieldName} must be a valid number` };
  }

  const isNegative = raw.startsWith('-');
  const unsignedStr = isNegative ? raw.slice(1) : raw;
  const [rupeesPart, decimalPart = ''] = unsignedStr.split('.');
  const paddedDecimal = (decimalPart + '00').slice(0, 2);

  const rupeesNum = parseInt(rupeesPart, 10);
  const paiseNum = parseInt(paddedDecimal, 10);

  const totalPaise = rupeesNum * 100 + paiseNum;

  if (!Number.isSafeInteger(totalPaise)) {
    return { isValid: false, paise: 0, error: `${fieldName} exceeds maximum supported value` };
  }

  return {
    isValid: true,
    paise: isNegative ? -totalPaise : totalPaise,
  };
}

/**
 * Converts integer paise to decimal string for text input values.
 * E.g., 70000 -> "700", 125050 -> "1250.50"
 */
export function paiseToInputString(paise: Paise): string {
  if (typeof paise !== 'number' || isNaN(paise)) return '0';
  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(paise));
  const rupees = Math.floor(absPaise / 100);
  const remaining = absPaise % 100;
  const sign = isNegative ? '-' : '';
  if (remaining === 0) {
    return `${sign}${rupees}`;
  }
  return `${sign}${rupees}.${remaining.toString().padStart(2, '0')}`;
}

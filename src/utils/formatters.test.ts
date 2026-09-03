import { describe, it, expect } from 'vitest';
import { formatINR, parseINRToPaise, paiseToInputString } from './formatters';

describe('formatters', () => {
  describe('formatINR', () => {
    it('formats integer paise to readable INR representation', () => {
      expect(formatINR(70000)).toBe('₹700');
      expect(formatINR(50000)).toBe('₹500');
      expect(formatINR(100000)).toBe('₹1,000');
      expect(formatINR(0)).toBe('₹0');
      expect(formatINR(125050)).toBe('₹1,250.50');
      expect(formatINR(50)).toBe('₹0.50');
    });

    it('formats negative paise correctly', () => {
      expect(formatINR(-40000)).toBe('-₹400');
      expect(formatINR(-50000)).toBe('-₹500');
      expect(formatINR(-125050)).toBe('-₹1,250.50');
    });

    it('handles sign option', () => {
      expect(formatINR(70000, { showSign: true })).toBe('+₹700');
      expect(formatINR(-40000, { showSign: true })).toBe('-₹400');
    });
  });

  describe('parseINRToPaise', () => {
    it('accurately parses whole and decimal amounts to integer paise', () => {
      expect(parseINRToPaise('700')).toEqual({ isValid: true, paise: 70000 });
      expect(parseINRToPaise('500.5')).toEqual({ isValid: true, paise: 50050 });
      expect(parseINRToPaise('100.25')).toEqual({ isValid: true, paise: 10025 });
      expect(parseINRToPaise('0')).toEqual({ isValid: true, paise: 0 });
      expect(parseINRToPaise('0.00')).toEqual({ isValid: true, paise: 0 });
      expect(parseINRToPaise(1000)).toEqual({ isValid: true, paise: 100000 });
    });

    it('rejects negative amounts by default', () => {
      const res = parseINRToPaise('-500');
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/cannot be negative/i);
    });

    it('rejects more than two decimal places', () => {
      const res = parseINRToPaise('500.123');
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/more than 2 decimal places/i);
    });

    it('rejects non-numeric inputs and empty inputs', () => {
      expect(parseINRToPaise('').isValid).toBe(false);
      expect(parseINRToPaise('   ').isValid).toBe(false);
      expect(parseINRToPaise('abc').isValid).toBe(false);
      expect(parseINRToPaise('12a34').isValid).toBe(false);
      expect(parseINRToPaise('$500').isValid).toBe(false);
    });
  });

  describe('paiseToInputString', () => {
    it('converts paise to clean string representation for forms', () => {
      expect(paiseToInputString(70000)).toBe('700');
      expect(paiseToInputString(50050)).toBe('500.50');
      expect(paiseToInputString(0)).toBe('0');
      expect(paiseToInputString(-40000)).toBe('-400');
    });
  });
});

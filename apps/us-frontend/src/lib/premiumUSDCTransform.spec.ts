import { describe, expect, it } from 'vitest';
import { normalizePremiumUSDCFields, type JsonValue } from './premiumUSDCTransform';

describe('normalizePremiumUSDCFields', () => {
  it('should convert premiumUSDC fields recursively', () => {
    // 显式标注为 JsonValue：否则 TS 会给数组元素推断出 `premiumUSDC?: undefined`
    // 这类可选-undefined 联合，与 JsonValue 不兼容，导致 `tsc && vite build` 失败。
    const payload: JsonValue = {
      premiumUSDC: 0.5,
      nested: {
        premiumUSDC: '1.25',
        deeper: [{ premiumUSDC: 0.01 }, { unrelated: true }],
      },
      list: [
        { premiumUSDC: 2 },
        {
          child: {
            premiumUSDC: '0.123456',
          },
        },
      ],
    };

    const result = normalizePremiumUSDCFields(structuredClone(payload));

    expect(result).toEqual({
      premiumUSDC_6d: '500000',
      nested: {
        premiumUSDC_6d: '1250000',
        deeper: [
          { premiumUSDC_6d: '10000' },
          { unrelated: true },
        ],
      },
      list: [
        { premiumUSDC_6d: '2000000' },
        {
          child: {
            premiumUSDC_6d: '123456',
          },
        },
      ],
    });
  });

  it('should remove premiumUSDC when premiumUSDC_6d already exists', () => {
    const payload = {
      premiumUSDC: 1,
      premiumUSDC_6d: 2500000,
      nested: {
        premiumUSDC: '3.5',
        premiumUSDC_6d: '4000000',
      },
    };

    const result = normalizePremiumUSDCFields(structuredClone(payload));

    expect(result).toEqual({
      premiumUSDC_6d: '2500000',
      nested: {
        premiumUSDC_6d: '4000000',
      },
    });
  });

  it('should leave non-object values untouched', () => {
    expect(normalizePremiumUSDCFields('test')).toBe('test');
    expect(normalizePremiumUSDCFields(123 as any)).toBe(123);
    expect(normalizePremiumUSDCFields(null as any)).toBeNull();
  });

  it('should skip conversion when premiumUSDC cannot be parsed', () => {
    const payload = {
      premiumUSDC: 'abc',
      nested: {
        premiumUSDC: '',
      },
    };

    const result = normalizePremiumUSDCFields(structuredClone(payload));

    expect(result).toEqual({
      nested: {},
    });
  });
});

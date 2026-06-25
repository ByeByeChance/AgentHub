import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (classname utility)', () => {
  it('should merge class names', () => {
    const result = cn('px-4', 'py-2');
    expect(result).toContain('px-4');
    expect(result).toContain('py-2');
  });

  it('should resolve conflicting tailwind classes (last wins)', () => {
    const result = cn('px-2', 'px-4');
    // tailwind-merge resolves px-2 and px-4, keeping only px-4
    expect(result).toContain('px-4');
    expect(result).not.toContain('px-2');
  });

  it('should handle conditional classes', () => {
    const result = cn('base', false && 'hidden', 'extra');
    expect(result).toContain('base');
    expect(result).toContain('extra');
    expect(result).not.toContain('hidden');
  });

  it('should return empty string for no inputs', () => {
    expect(cn()).toBe('');
  });

  it('should handle undefined/null values gracefully', () => {
    const result = cn('base', undefined, null, 'extra');
    expect(result).toContain('base');
    expect(result).toContain('extra');
  });
});

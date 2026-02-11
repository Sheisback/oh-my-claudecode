import { describe, it, expect, vi } from 'vitest';
import {
  computeBackoffDelay,
  executeCodexWithFallback,
  RATE_LIMIT_RETRY_COUNT,
  RATE_LIMIT_INITIAL_DELAY,
  RATE_LIMIT_MAX_DELAY,
  CODEX_DEFAULT_MODEL,
} from '../mcp/codex-core.js';

describe('Codex Rate Limit Backoff (#570)', () => {
  describe('computeBackoffDelay', () => {
    it('should return a value within expected range for attempt 0', () => {
      const delay = computeBackoffDelay(0, 5000, 60000);
      // attempt 0: 5000 * 2^0 = 5000, jitter 50-100% -> [2500, 5000]
      expect(delay).toBeGreaterThanOrEqual(2500);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it('should grow exponentially across attempts', () => {
      // Verify the minimum possible value at each attempt increases
      // attempt 0: base=5000,  range=[2500, 5000]
      // attempt 1: base=10000, range=[5000, 10000]
      // attempt 2: base=20000, range=[10000, 20000]
      // We sample many times and check that attempt N+1 min > attempt N min
      const samples = (attempt: number) =>
        Array.from({ length: 50 }, () => computeBackoffDelay(attempt, 5000, 60000));
      const min0 = Math.min(...samples(0));
      const min1 = Math.min(...samples(1));
      const min2 = Math.min(...samples(2));
      expect(min1).toBeGreaterThan(min0);
      expect(min2).toBeGreaterThan(min1);
    });

    it('should cap at maxDelay', () => {
      // 5000 * 2^20 is huge, but capped at 60000, jitter -> [30000, 60000]
      const delay = computeBackoffDelay(20, 5000, 60000);
      expect(delay).toBeLessThanOrEqual(60000);
      expect(delay).toBeGreaterThanOrEqual(30000);
    });

    it('should use default parameters from config', () => {
      const delay = computeBackoffDelay(0);
      expect(delay).toBeGreaterThanOrEqual(RATE_LIMIT_INITIAL_DELAY * 0.5);
      expect(delay).toBeLessThanOrEqual(RATE_LIMIT_INITIAL_DELAY);
    });

    it('should always return a positive integer', () => {
      for (let i = 0; i < 100; i++) {
        const delay = computeBackoffDelay(i % 10, 1000, 30000);
        expect(delay).toBeGreaterThan(0);
        expect(Number.isInteger(delay)).toBe(true);
      }
    });

    it('should handle attempt 0 with small initial delay', () => {
      const delay = computeBackoffDelay(0, 1000, 60000);
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(1000);
    });
  });

  describe('Rate limit configuration constants', () => {
    it('should have sensible defaults', () => {
      expect(RATE_LIMIT_RETRY_COUNT).toBe(3);
      expect(RATE_LIMIT_INITIAL_DELAY).toBe(5000);
      expect(RATE_LIMIT_MAX_DELAY).toBe(60000);
    });

    it('should enforce minimum bounds', () => {
      expect(RATE_LIMIT_RETRY_COUNT).toBeGreaterThanOrEqual(1);
      expect(RATE_LIMIT_INITIAL_DELAY).toBeGreaterThanOrEqual(1000);
      expect(RATE_LIMIT_MAX_DELAY).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('executeCodexWithFallback with backoff', () => {
    it('should retry explicit model on rate limit with backoff', async () => {
      const sleepDelays: number[] = [];
      const mockSleep = vi.fn(async (ms: number) => { sleepDelays.push(ms); });
      let callCount = 0;
      const mockExecutor = vi.fn(async (_prompt: string, model: string) => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Codex rate limit error: 429 Too Many Requests');
        }
        return `Response from ${model}`;
      });

      const result = await executeCodexWithFallback(
        'test prompt',
        'gpt-5.3-codex', // explicit model
        undefined,
        undefined,
        { executor: mockExecutor, sleepFn: mockSleep },
      );

      expect(result.response).toBe('Response from gpt-5.3-codex');
      expect(result.usedFallback).toBe(false);
      expect(result.actualModel).toBe('gpt-5.3-codex');
      expect(mockExecutor).toHaveBeenCalledTimes(3); // 2 failures + 1 success
      expect(mockSleep).toHaveBeenCalledTimes(2); // backoff after each failure
      // Verify exponential growth (second delay >= first delay due to jitter)
      expect(sleepDelays[0]).toBeGreaterThanOrEqual(RATE_LIMIT_INITIAL_DELAY * 0.5);
      expect(sleepDelays[1]).toBeGreaterThanOrEqual(RATE_LIMIT_INITIAL_DELAY);
    });

    it('should throw after exhausting retries for explicit model', async () => {
      const mockSleep = vi.fn(async () => {});
      const mockExecutor = vi.fn(async () => {
        throw new Error('429 Too Many Requests');
      });

      await expect(executeCodexWithFallback(
        'test prompt',
        'gpt-5.3-codex',
        undefined,
        undefined,
        { executor: mockExecutor, sleepFn: mockSleep },
      )).rejects.toThrow(/429/);

      // 1 initial attempt + RATE_LIMIT_RETRY_COUNT retries
      expect(mockExecutor).toHaveBeenCalledTimes(RATE_LIMIT_RETRY_COUNT + 1);
      expect(mockSleep).toHaveBeenCalledTimes(RATE_LIMIT_RETRY_COUNT);
    });

    it('should not retry explicit model on non-rate-limit errors', async () => {
      const mockSleep = vi.fn(async () => {});
      const mockExecutor = vi.fn(async () => {
        throw new Error('Connection refused');
      });

      await expect(executeCodexWithFallback(
        'test prompt',
        'gpt-5.3-codex',
        undefined,
        undefined,
        { executor: mockExecutor, sleepFn: mockSleep },
      )).rejects.toThrow('Connection refused');

      expect(mockExecutor).toHaveBeenCalledTimes(1);
      expect(mockSleep).not.toHaveBeenCalled();
    });

    it('should add backoff between fallback chain models on rate limit', async () => {
      const sleepDelays: number[] = [];
      const mockSleep = vi.fn(async (ms: number) => { sleepDelays.push(ms); });
      let callCount = 0;
      const mockExecutor = vi.fn(async (_prompt: string, model: string) => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Codex rate limit error: 429 Too Many Requests');
        }
        return `Response from ${model}`;
      });

      const result = await executeCodexWithFallback(
        'test prompt',
        undefined, // no explicit model -> uses fallback chain
        undefined,
        [CODEX_DEFAULT_MODEL, 'model-b', 'model-c'],
        { executor: mockExecutor, sleepFn: mockSleep },
      );

      // First two models rate-limited, third succeeds
      expect(result.response).toBe('Response from model-c');
      expect(result.usedFallback).toBe(true);
      expect(result.actualModel).toBe('model-c');
      expect(mockExecutor).toHaveBeenCalledTimes(3);
      expect(mockSleep).toHaveBeenCalledTimes(2); // backoff before model-b and model-c
    });

    it('should not add backoff for model errors in fallback chain', async () => {
      const mockSleep = vi.fn(async () => {});
      let callCount = 0;
      const mockExecutor = vi.fn(async (_prompt: string, model: string) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Codex model error: model_not_found');
        }
        return `Response from ${model}`;
      });

      const result = await executeCodexWithFallback(
        'test prompt',
        undefined,
        undefined,
        [CODEX_DEFAULT_MODEL, 'model-b'],
        { executor: mockExecutor, sleepFn: mockSleep },
      );

      expect(result.response).toBe('Response from model-b');
      expect(result.usedFallback).toBe(true);
      expect(mockSleep).not.toHaveBeenCalled(); // No backoff for model errors
    });

    it('should succeed without fallback when first model works', async () => {
      const mockSleep = vi.fn(async () => {});
      const mockExecutor = vi.fn(async (_prompt: string, model: string) => {
        return `Response from ${model}`;
      });

      const result = await executeCodexWithFallback(
        'test prompt',
        undefined,
        undefined,
        [CODEX_DEFAULT_MODEL, 'model-b'],
        { executor: mockExecutor, sleepFn: mockSleep },
      );

      expect(result.response).toBe(`Response from ${CODEX_DEFAULT_MODEL}`);
      expect(result.usedFallback).toBe(false);
      expect(mockSleep).not.toHaveBeenCalled();
      expect(mockExecutor).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed rate limit and model errors in chain', async () => {
      const sleepDelays: number[] = [];
      const mockSleep = vi.fn(async (ms: number) => { sleepDelays.push(ms); });
      let callCount = 0;
      const mockExecutor = vi.fn(async (_prompt: string, model: string) => {
        callCount++;
        if (callCount === 1) throw new Error('Codex rate limit error: 429');
        if (callCount === 2) throw new Error('Codex model error: model_not_found');
        return `Response from ${model}`;
      });

      const result = await executeCodexWithFallback(
        'test prompt',
        undefined,
        undefined,
        [CODEX_DEFAULT_MODEL, 'model-b', 'model-c'],
        { executor: mockExecutor, sleepFn: mockSleep },
      );

      expect(result.response).toBe('Response from model-c');
      expect(mockExecutor).toHaveBeenCalledTimes(3);
      // Only 1 sleep: after rate limit (model error has no backoff)
      expect(mockSleep).toHaveBeenCalledTimes(1);
    });

    it('should detect various rate limit error patterns', async () => {
      const patterns = [
        '429 Too Many Requests',
        'rate limit exceeded',
        'Rate_Limit reached',
        'too many requests',
        'quota_exceeded',
        'resource_exhausted',
      ];

      for (const pattern of patterns) {
        const mockSleep = vi.fn(async () => {});
        let callCount = 0;
        const mockExecutor = vi.fn(async (_prompt: string, model: string) => {
          callCount++;
          if (callCount === 1) throw new Error(pattern);
          return `Response from ${model}`;
        });

        const result = await executeCodexWithFallback(
          'test prompt',
          'explicit-model',
          undefined,
          undefined,
          { executor: mockExecutor, sleepFn: mockSleep },
        );

        expect(result.response).toContain('Response from');
        expect(mockSleep).toHaveBeenCalledTimes(1);
        callCount = 0; // reset for next pattern
      }
    });
  });
});

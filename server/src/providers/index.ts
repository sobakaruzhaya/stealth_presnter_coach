import type { LLMProvider } from '../types';
import { MockProvider } from './mockProvider';
import { RealProvider } from './realProvider';

export function createProvider(): LLMProvider {
  const providerName = process.env.LLM_PROVIDER ?? 'mock';

  if (providerName === 'real') {
    const key = process.env.LLM_API_KEY;
    if (!key) {
      throw new Error('LLM_PROVIDER=real requires LLM_API_KEY in environment');
    }
    return new RealProvider(key);
  }

  return new MockProvider();
}

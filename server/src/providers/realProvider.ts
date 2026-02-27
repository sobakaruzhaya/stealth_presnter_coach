import type { AnalyzeRequest, AnalyzeResponse, LLMProvider } from '../types';

export class RealProvider implements LLMProvider {
  constructor(private readonly apiKey: string) {}

  async analyze(input: AnalyzeRequest): Promise<AnalyzeResponse> {
    // Placeholder: integrate your provider SDK/API here using this.apiKey.
    // Keep this interface stable so client code does not change.
    void input;
    throw new Error('RealProvider is not implemented yet. Set LLM_PROVIDER=mock or implement integration.');
  }
}

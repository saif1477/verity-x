import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { AnalysisResult } from '../lib/types';

export function useAnalysis(projectCode: string, asOfDay: number) {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<AnalysisResult>('/api/analysis', {
        method: 'POST',
        body: JSON.stringify({ project_code: projectCode, as_of_day: asOfDay }),
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [projectCode, asOfDay]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, rerun: run, setData };
}

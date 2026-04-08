import type { TFunction } from 'i18next';
import {
  ANTIGRAVITY_CONFIG,
  CLAUDE_CONFIG,
  CODEX_CONFIG,
  GEMINI_CLI_CONFIG,
  KIMI_CONFIG,
} from '@/components/quota';
import type { QuotaConfig } from '@/components/quota';
import type { AuthFileItem } from '@/types';
import { getStatusFromError, isRuntimeOnlyAuthFile, resolveAuthProvider } from '@/utils/quota';
import { QUOTA_PROVIDER_TYPES, type QuotaProviderType } from './constants';

type QuotaUpdater<T> = T | ((prev: T) => T);

export type QuotaSetter<T> = (updater: QuotaUpdater<T>) => void;

export type QuotaRefreshResult<TData> = {
  name: string;
  status: 'success' | 'error';
  data?: TData;
  error?: string;
  errorStatus?: number;
};

export const getQuotaConfig = (type: QuotaProviderType) => {
  if (type === 'antigravity') return ANTIGRAVITY_CONFIG;
  if (type === 'claude') return CLAUDE_CONFIG;
  if (type === 'codex') return CODEX_CONFIG;
  if (type === 'kimi') return KIMI_CONFIG;
  return GEMINI_CLI_CONFIG;
};

export const resolveAuthFileQuotaType = (file: AuthFileItem): QuotaProviderType | null => {
  const provider = resolveAuthProvider(file);
  if (!QUOTA_PROVIDER_TYPES.has(provider as QuotaProviderType)) return null;
  return provider as QuotaProviderType;
};

export const canViewAuthFileQuota = (file: AuthFileItem): boolean =>
  resolveAuthFileQuotaType(file) !== null && !isRuntimeOnlyAuthFile(file);

export const canRefreshAuthFileQuota = (file: AuthFileItem): boolean =>
  canViewAuthFileQuota(file) && !file.disabled;

export async function refreshQuotaTargets<TState, TData>(options: {
  config: QuotaConfig<TState, TData>;
  setQuota: QuotaSetter<Record<string, TState>>;
  targets: AuthFileItem[];
  t: TFunction;
}): Promise<QuotaRefreshResult<TData>[]> {
  const { config, setQuota, targets, t } = options;
  if (targets.length === 0) return [];

  setQuota((prev) => {
    const nextState = { ...prev };
    targets.forEach((file) => {
      nextState[file.name] = config.buildLoadingState();
    });
    return nextState;
  });

  const results = await Promise.all(
    targets.map(async (file): Promise<QuotaRefreshResult<TData>> => {
      try {
        const data = await config.fetchQuota(file, t);
        return { name: file.name, status: 'success', data };
      } catch (err: unknown) {
        return {
          name: file.name,
          status: 'error',
          error: err instanceof Error ? err.message : t('common.unknown_error'),
          errorStatus: getStatusFromError(err),
        };
      }
    })
  );

  setQuota((prev) => {
    const nextState = { ...prev };
    results.forEach((result) => {
      if (result.status === 'success') {
        nextState[result.name] = config.buildSuccessState(result.data as TData);
      } else {
        nextState[result.name] = config.buildErrorState(
          result.error || t('common.unknown_error'),
          result.errorStatus
        );
      }
    });
    return nextState;
  });

  return results;
}

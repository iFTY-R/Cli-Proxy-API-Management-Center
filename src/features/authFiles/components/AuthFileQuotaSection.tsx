import { useCallback, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuotaConfig } from '@/components/quota';
import { useNotificationStore, useQuotaStore } from '@/stores';
import type { AuthFileItem } from '@/types';
import {
  isRuntimeOnlyAuthFile,
  resolveQuotaErrorMessage,
  type QuotaProviderType
} from '@/features/authFiles/constants';
import {
  getQuotaConfig,
  refreshQuotaTargets,
  type QuotaSetter
} from '@/features/authFiles/quota';
import { QuotaProgressBar } from '@/features/authFiles/components/QuotaProgressBar';
import styles from '@/pages/AuthFilesPage.module.scss';

type QuotaState = { status?: string; error?: string; errorStatus?: number } | undefined;

export type AuthFileQuotaSectionProps = {
  file: AuthFileItem;
  quotaType: QuotaProviderType;
  disableControls: boolean;
};

export function AuthFileQuotaSection(props: AuthFileQuotaSectionProps) {
  const { file, quotaType, disableControls } = props;
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);

  const quota = useQuotaStore((state) => {
    if (quotaType === 'antigravity') return state.antigravityQuota[file.name] as QuotaState;
    if (quotaType === 'claude') return state.claudeQuota[file.name] as QuotaState;
    if (quotaType === 'codex') return state.codexQuota[file.name] as QuotaState;
    if (quotaType === 'kimi') return state.kimiQuota[file.name] as QuotaState;
    return state.geminiCliQuota[file.name] as QuotaState;
  });

  const updateQuotaState = useQuotaStore((state) => {
    if (quotaType === 'antigravity') {
      return state.setAntigravityQuota as unknown as QuotaSetter<Record<string, unknown>>;
    }
    if (quotaType === 'claude') {
      return state.setClaudeQuota as unknown as QuotaSetter<Record<string, unknown>>;
    }
    if (quotaType === 'codex') {
      return state.setCodexQuota as unknown as QuotaSetter<Record<string, unknown>>;
    }
    if (quotaType === 'kimi') {
      return state.setKimiQuota as unknown as QuotaSetter<Record<string, unknown>>;
    }
    return state.setGeminiCliQuota as unknown as QuotaSetter<Record<string, unknown>>;
  });

  const refreshQuotaForFile = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (disableControls) return;
    if (isRuntimeOnlyAuthFile(file)) return;
    if (file.disabled) return;
    if (quota?.status === 'loading') return;

    const config = getQuotaConfig(quotaType) as QuotaConfig<unknown, unknown>;

    const [result] = await refreshQuotaTargets({
      config,
      setQuota: updateQuotaState,
      targets: [file],
      t
    });

    if (result?.status === 'success') {
      if (!silent) {
        showNotification(t('auth_files.quota_refresh_success', { name: file.name }), 'success');
      }
      return;
    }

    const message = result?.error || t('common.unknown_error');
    if (!silent) {
      showNotification(t('auth_files.quota_refresh_failed', { name: file.name, message }), 'error');
    }
  }, [disableControls, file, quota?.status, quotaType, showNotification, t, updateQuotaState]);

  const config = getQuotaConfig(quotaType) as QuotaConfig<unknown, unknown>;

  const quotaStatus = quota?.status ?? 'idle';
  const canRefreshQuota = !disableControls && !file.disabled;
  const quotaErrorMessage = resolveQuotaErrorMessage(
    t,
    quota?.errorStatus,
    quota?.error || t('common.unknown_error')
  );

  useEffect(() => {
    if (quotaStatus !== 'idle') return;
    if (!canRefreshQuota) return;
    void refreshQuotaForFile({ silent: true });
  }, [canRefreshQuota, quotaStatus, refreshQuotaForFile]);

  return (
    <div className={styles.quotaSection}>
      {quotaStatus === 'loading' ? (
        <div className={styles.quotaMessage}>{t(`${config.i18nPrefix}.loading`)}</div>
      ) : quotaStatus === 'idle' ? (
        <button
          type="button"
          className={`${styles.quotaMessage} ${styles.quotaMessageAction}`}
          onClick={() => void refreshQuotaForFile()}
          disabled={!canRefreshQuota}
        >
          {t(`${config.i18nPrefix}.idle`)}
        </button>
      ) : quotaStatus === 'error' ? (
        <div className={styles.quotaError}>
          {t(`${config.i18nPrefix}.load_failed`, {
            message: quotaErrorMessage
          })}
        </div>
      ) : quota ? (
        (config.renderQuotaItems(quota, t, { styles, QuotaProgressBar }) as ReactNode)
      ) : (
        <div className={styles.quotaMessage}>{t(`${config.i18nPrefix}.idle`)}</div>
      )}
    </div>
  );
}

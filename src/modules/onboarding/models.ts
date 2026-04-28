import type {AppLocale} from '../localization/i18n';
import type {SecurityMode} from '../service/models';

export const WORKSPACE_ONBOARDING_VERSION = 'workspace-tour-v1';

export type WorkspaceOnboardingStatus = 'unseen' | 'skipped' | 'completed';

export interface StoredWorkspaceOnboardingRecord {
  lastManualOpenAt?: string;
  status?: Exclude<WorkspaceOnboardingStatus, 'unseen'>;
  updatedAt?: string;
  version: string;
}

export interface AppUiMetadata {
  localePreference?: StoredLocalePreferenceRecord;
  securityModePreference?: StoredSecurityModePreferenceRecord;
  workspaceOnboarding?: StoredWorkspaceOnboardingRecord;
}

export interface StoredLocalePreferenceRecord {
  locale: AppLocale;
  updatedAt?: string;
}

export interface StoredSecurityModePreferenceRecord {
  securityMode: SecurityMode;
  updatedAt?: string;
}

export interface WorkspaceOnboardingSnapshot {
  lastManualOpenAt?: string;
  status: WorkspaceOnboardingStatus;
  updatedAt?: string;
  version: string;
}

export function deriveWorkspaceOnboardingSnapshot(
  version: string,
  record?: StoredWorkspaceOnboardingRecord,
): WorkspaceOnboardingSnapshot {
  if (!record || record.version !== version) {
    return {
      status: 'unseen',
      version,
    };
  }

  return {
    lastManualOpenAt: record.lastManualOpenAt,
    status: record.status ?? 'unseen',
    updatedAt: record.updatedAt,
    version,
  };
}

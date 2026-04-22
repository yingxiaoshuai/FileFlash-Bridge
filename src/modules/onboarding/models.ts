export const WORKSPACE_ONBOARDING_VERSION = 'workspace-tour-v1';

export type WorkspaceOnboardingStatus = 'unseen' | 'skipped' | 'completed';

export interface StoredWorkspaceOnboardingRecord {
  lastManualOpenAt?: string;
  status?: Exclude<WorkspaceOnboardingStatus, 'unseen'>;
  updatedAt?: string;
  version: string;
}

export interface AppUiMetadata {
  workspaceOnboarding?: StoredWorkspaceOnboardingRecord;
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

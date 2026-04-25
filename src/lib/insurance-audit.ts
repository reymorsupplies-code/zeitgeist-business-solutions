/**
 * ZBS Insurance Audit Logger
 * Structured audit trail for insurance regulatory compliance (Insurance Act 2018 - Trinidad & Tobago)
 */

interface AuditEntry {
  timestamp: string;
  tenantId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

class InsuranceAuditLogger {
  private static buffer: AuditEntry[] = [];
  private static flushInterval: NodeJS.Timeout | null = null;
  private static readonly BUFFER_SIZE = 50;

  static log(entry: Omit<AuditEntry, 'timestamp'>): void {
    const fullEntry: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    InsuranceAuditLogger.buffer.push(fullEntry);

    if (InsuranceAuditLogger.buffer.length >= InsuranceAuditLogger.BUFFER_SIZE) {
      InsuranceAuditLogger.flush();
    }
  }

  static flush(): void {
    if (InsuranceAuditLogger.buffer.length === 0) return;

    // In production, this would write to a database table
    // For now, structured console logging
    for (const entry of InsuranceAuditLogger.buffer) {
      console.log(JSON.stringify({
        level: 'INSURANCE_AUDIT',
        ...entry,
      }));
    }

    InsuranceAuditLogger.buffer = [];
  }

  static startAutoFlush(intervalMs: number = 30000): void {
    if (InsuranceAuditLogger.flushInterval) clearInterval(InsuranceAuditLogger.flushInterval);
    InsuranceAuditLogger.flushInterval = setInterval(() => {
      InsuranceAuditLogger.flush();
    }, intervalMs);
  }

  static stopAutoFlush(): void {
    if (InsuranceAuditLogger.flushInterval) {
      clearInterval(InsuranceAuditLogger.flushInterval);
      InsuranceAuditLogger.flushInterval = null;
    }
    InsuranceAuditLogger.flush();
  }
}

// Auto-start in production
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
  InsuranceAuditLogger.startAutoFlush();
}

export const auditLogger = InsuranceAuditLogger;
export type { AuditEntry };

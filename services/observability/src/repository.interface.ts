// ---- Token Record ----
export interface TokenRecordData {
  id: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  conversationId: string | null;
  agentId: string | null;
  createdAt: string;
}

export interface TokenRepository {
  insert(record: TokenRecordData): Promise<void>;
  findByPeriod(since: string): Promise<TokenRecordData[]>;
}

// ---- Audit Entry ----
export interface AuditEntryData {
  id: string;
  entryType: string;
  payload: Record<string, unknown>;
  previousHash: string | null;
  currentHash: string;
  timestamp: string;
}

export interface AuditRepository {
  insert(entry: AuditEntryData): Promise<void>;
  listAll(): Promise<AuditEntryData[]>;
}

// ---- Combined ----
export interface ObservabilityDatabase {
  tokenRecords: TokenRepository;
  auditLog: AuditRepository;
}

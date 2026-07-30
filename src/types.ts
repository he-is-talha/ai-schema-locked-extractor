export type FailureLayer = "decode" | "schema" | "business_rule";

export type DocumentType = "receipt" | "job_posting" | "meeting_notes";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type RuleFailure = {
  field: string;
  message: string;
};

export type ExtractFailure = {
  layer: FailureLayer;
  field?: string;
  message: string;
};

export type AttemptRecord = {
  attempt: number;
  layer?: FailureLayer;
  message?: string;
  ms: number;
};

export type ExtractSuccess<T> = {
  ok: true;
  data: T;
  attempts: number;
  attemptRecords: AttemptRecord[];
  ms: number;
};

export type ExtractError = {
  ok: false;
  failure: ExtractFailure;
  attempts: number;
  attemptRecords: AttemptRecord[];
  ms: number;
};

export type ExtractResult<T> = ExtractSuccess<T> | ExtractError;

export type MetricRun = {
  id: string;
  type: DocumentType;
  success: boolean;
  schemaPassed: boolean;
  attempts: number;
  failureLayer?: FailureLayer;
  ms: number;
};

export type MetricsSummary = {
  total: number;
  schemaPassRate: number;
  businessRuleFailureRate: number;
  avgAttemptsPerSuccess: number;
  runs: MetricRun[];
  model: string;
  generatedAt: string;
};

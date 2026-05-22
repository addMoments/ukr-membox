export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type JobName = 's3_export';

export interface Job {
  uid: string;
  name: JobName;
  output: Record<string, unknown>;
  status: JobStatus;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

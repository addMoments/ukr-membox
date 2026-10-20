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

// Backend export zip'ini 3 gun sonra (output.zip_expires_at), ayni kapsamda yeni export alininca ya da
// etkinlik kapaninca siler ve job'a output.zip_deleted_at yazar; o zaman indirme yerine yeniden export gosterilir.
export const exportZipAvailable = (job: Job | null | undefined): boolean => {
  if (!job || job.status !== 'succeeded' || !job.output?.zip_path || job.output?.zip_deleted_at) return false;
  const expiresAt = job.output?.zip_expires_at;
  return typeof expiresAt !== 'string' || new Date(expiresAt).getTime() > Date.now();
};

export type FileItem = {
  id: string
  object: string
  project_id: string
  created_at: string
  updated_at: string
  bytes: any
  filename: string
  description: any
  last_error: any
  purpose: string
  scope: string
  user_id: any
  directory: any
  content_type: string
  metadata: Record<string, any>
  version_hash: any
  version_number: number
  s3_key: string
  download_url: string
}

// ===== Tipos compartilhados (espelham as migrations em supabase/migrations) =====

export type Platform = "instagram" | "youtube" | "tiktok" | "facebook";

export type PostType =
  | "reel"
  | "story"
  | "feed"
  | "short"
  | "video"
  | "carousel";

export type ScheduledPostStatus =
  | "pending"
  | "processing"
  | "published"
  | "failed"
  | "cancelled";

export type BatchStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type EditStatus = "draft" | "exporting" | "exported" | "failed";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  niche: string | null;
  created_at: string;
}

export interface TrendImport {
  id: string;
  project_id: string;
  platform: Platform;
  title: string | null;
  url: string | null;
  thumbnail_url: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  created_at: string;
}

export type VideoAssetType =
  | "video"
  | "audio"
  | "image"
  | "background"
  | "watermark";

export interface VideoAsset {
  id: string;
  project_id: string;
  type: VideoAssetType;
  url: string;
  filename: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

// ===== Editor =====

export interface TimelineClip {
  id: string;
  assetId?: string;
  start: number; // segundos, no vídeo original
  end: number;
  order: number;
}

export interface BackgroundConfig {
  type: "color" | "image" | "blur";
  color?: string;
  imageUrl?: string;
  /** 9:16, 1:1, 16:9 */
  aspectRatio?: string;
}

export interface WatermarkConfig {
  imageUrl?: string;
  text?: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  opacity: number; // 0-1
  scale: number; // 0-1 (proporção da largura)
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number; // 0-1 relativo
  y: number; // 0-1 relativo
  fontSize: number;
  color: string;
  background?: string;
  fontFamily?: string;
  bold?: boolean;
  startTime?: number;
  endTime?: number;
}

export interface FilterConfig {
  brightness: number; // 1 = normal
  contrast: number;
  saturation: number;
  preset?: string | null;
}

export interface Edit {
  id: string;
  project_id: string;
  video_asset_id: string;
  name: string | null;
  timeline_json: TimelineClip[];
  background: BackgroundConfig | null;
  watermark: WatermarkConfig | null;
  texts: TextOverlay[] | null;
  filters: FilterConfig | null;
  audio_overlay: string | null;
  export_path: string | null;
  status: EditStatus;
  created_at: string;
}

export interface EditTemplateConfig {
  background: BackgroundConfig | null;
  watermark: WatermarkConfig | null;
  texts: TextOverlay[];
  filters: FilterConfig | null;
}

export interface EditTemplate {
  id: string;
  user_id: string;
  name: string;
  thumbnail: string | null;
  config: EditTemplateConfig;
  created_at: string;
}

// ===== Batch =====

export interface BatchJob {
  id: string;
  user_id: string;
  project_id: string;
  template_id: string;
  name: string;
  status: BatchStatus;
  total_items: number;
  completed_items: number;
  failed_items: number;
  output_zip_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchItem {
  id: string;
  batch_job_id: string;
  video_asset_id: string;
  edit_id: string | null;
  status: BatchStatus;
  progress: number;
  export_path: string | null;
  error_message: string | null;
  created_at: string;
}

// ===== Publicação =====

export interface OAuthConnection {
  id: string;
  user_id: string;
  platform: Platform;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  account_id: string;
  account_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledPost {
  id: string;
  user_id: string;
  project_id: string | null;
  edit_id: string | null;
  platform: Platform;
  post_type: PostType;
  title: string | null;
  caption: string | null;
  media_path: string | null;
  scheduled_at: string;
  publish_method: "api" | "manual";
  status: ScheduledPostStatus;
  publish_response: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface Publication {
  id: string;
  scheduled_post_id: string;
  platform: Platform;
  response_id: string | null;
  url: string | null;
  status: string;
  error_message: string | null;
  executed_at: string;
}

// ===== Referência (scraping) =====

export interface ReferenceProfile {
  id: string;
  user_id: string;
  project_id: string | null;
  platform: Platform;
  username: string;
  profile_url: string | null;
  niche: string | null;
  insights_json: ReferenceInsights | null;
  status: "pending" | "scraping" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferenceInsights {
  summary?: string;
  viral_patterns?: string[];
  hooks?: string[];
  best_formats?: string[];
  posting_frequency?: string;
  tone?: string;
  recommendations?: string[];
}

export interface ScrapedPost {
  id: string;
  reference_id: string;
  platform_post_id: string | null;
  title: string | null;
  caption: string | null;
  url: string | null;
  thumbnail_url: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  post_type: string | null;
  created_at: string;
}

export interface ScrapedComment {
  id: string;
  scraped_post_id: string;
  text: string;
  likes: number;
  sentiment: "positive" | "negative" | "neutral" | null;
  created_at: string;
}

export interface ReferenceNote {
  id: string;
  reference_id: string;
  note: string;
  created_at: string;
}

// ===== Módulo Jurídico =====

export interface LegalCase {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  legal_area: string | null;
  target_audience: string | null;
  status: "active" | "paused" | "archived";
  created_at: string;
  updated_at: string;
}

export interface LegalViralPattern {
  id: string;
  legal_case_id: string;
  source_url: string | null;
  source_platform: Platform | null;
  pattern_type: string | null;
  hook: string | null;
  structure: string | null;
  cta: string | null;
  metrics: Record<string, unknown> | null;
  analysis: string | null;
  score: number;
  created_at: string;
}

export interface LegalGeneratedContent {
  id: string;
  legal_case_id: string;
  pattern_id: string | null;
  title: string | null;
  hook: string | null;
  body: string | null;
  cta: string | null;
  full_script: string | null;
  caption: string | null;
  hashtags: string[] | null;
  status: "draft" | "approved" | "scheduled" | "published";
  scheduled_post_id: string | null;
  created_at: string;
}

// ===== Roteiro IA =====

export interface Roteiro {
  hook: string;
  corpo: string;
  cta: string;
  hashtags?: string[];
  duracao_estimada?: string;
}

// Tipos compartilhados do módulo Jurídico (payloads das rotas de IA).
// Apenas tipos puros — seguro para importar tanto em route handlers quanto em client components.

export interface AnalyzedPatternMetrics {
  views_estimadas: string;
  er_estimado: string;
}

export interface AnalyzedPattern {
  pattern_type: string;
  hook: string;
  structure: string;
  cta: string;
  score: number;
  analysis: string;
  metrics: AnalyzedPatternMetrics;
}

export interface AnalyzeResponse {
  patterns: AnalyzedPattern[];
  source: "ai" | "mock";
}

export interface GeneratedContentPayload {
  title: string;
  hook: string;
  body: string;
  cta: string;
  full_script: string;
  caption: string;
  hashtags: string[];
}

export interface GenerateResponse {
  contents: GeneratedContentPayload[];
  source: "ai" | "mock";
}

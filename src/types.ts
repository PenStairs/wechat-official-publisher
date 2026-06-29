export interface ArticleMetadata {
  title: string;
  author?: string;
  digest?: string;
  cover?: string;
  theme?: string;
  contentSourceUrl?: string;
  showCoverPic?: boolean;
  needOpenComment?: boolean;
  onlyFansCanComment?: boolean;
}

export interface ArticleDocument {
  metadata: ArticleMetadata;
  body: string;
  sourcePath?: string;
  sourceDir?: string;
}

export interface RenderedImage {
  alt: string;
  source: string;
}

export interface RenderedArticle {
  html: string;
  images: RenderedImage[];
}

export interface Theme {
  name: string;
  description: string;
  styleSheet: string;
  colors: ThemeColors;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  presentation: ThemePresentation;
}

export interface ThemeColors {
  text: string;
  heading: string;
  muted: string;
  border: string;
  surface: string;
  canvas: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  codeText: string;
  codeBackground: string;
  codeHeader: string;
  inlineCodeText: string;
  inlineCodeBackground: string;
  shadow: string;
  info: string;
  tip: string;
  warning: string;
  success: string;
  danger: string;
}

export interface ThemeSpacing {
  block: string;
  paragraph: string;
  compact: string;
}

export interface ThemeTypography {
  fontFamily: string;
  titleSize: string;
  headingSize: string;
  bodySize: string;
  smallSize: string;
  lineHeight: string;
}

export type ThemePresentationStyle = "standard" | "minimal" | "focus" | "elegant" | "bold";

export interface ThemePresentation {
  style: ThemePresentationStyle;
  radius: string;
  shadow: string;
}

export interface LayoutBlock {
  name: string;
  argument: string;
  body: string[];
  line?: number;
}

export interface LayoutValidationIssue {
  module: string;
  field?: string;
  line: number;
  message: string;
}

export interface LayoutValidationReport {
  errors: LayoutValidationIssue[];
  warnings: LayoutValidationIssue[];
}

export type BlockBodyFormat = "fields" | "rows" | "json_object" | "json_array" | "text";

export interface BlockFieldMetadata {
  name: string;
  description?: string;
  example?: string;
  enum?: string[];
}

export interface BlockRowsMetadata {
  delimiter?: string;
  minColumns?: number;
  columns: BlockFieldMetadata[];
}

export interface SupportedBlockMetadata {
  name: string;
  bodyFormat: BlockBodyFormat;
  version?: string;
  since?: string;
  category?: string;
  serves: string[];
  contentTypes: string[];
  industry: string[];
  tags: string[];
  position?: string;
  whenToUse?: string;
  whenNotToUse?: string;
  pairsWellWith: string[];
  avoidCombiningWith: string[];
  antiPattern?: string;
  fields: {
    required: BlockFieldMetadata[];
    optional: BlockFieldMetadata[];
  };
  rows?: BlockRowsMetadata;
  example?: string;
  metadata: {
    author?: string;
    provenance?: string;
    inspiredBy?: string;
  };
  renderingSupport: "local";
}

export interface WeChatPublisherConfig {
  appId: string;
  appSecret: string;
  apiBaseUrl: string;
  tokenCacheFile: string;
  logFile: string;
}

export interface AccessTokenPayload {
  accessToken: string;
  expiresAt: number;
  appId: string;
}

export interface WeChatErrorPayload {
  errcode?: number;
  errmsg?: string;
}

export interface UploadArticleImageResult {
  url: string;
}

export interface UploadPermanentImageResult {
  mediaId: string;
  url?: string;
}

export interface CreateDraftResult {
  mediaId: string;
}

export interface SubmitPublishResult {
  publishId: string;
}

export interface PublishDraftInput {
  articlePath: string;
  themeName?: string;
  coverPath?: string;
  coverMediaId?: string;
  outputPath?: string;
}

export interface DraftPayloadArticle {
  title: string;
  author?: string;
  digest?: string;
  content: string;
  thumb_media_id: string;
  show_cover_pic: 0 | 1;
  content_source_url?: string;
  need_open_comment?: 0 | 1;
  only_fans_can_comment?: 0 | 1;
}

export interface DraftPayload {
  articles: DraftPayloadArticle[];
}

export interface DraftArtifact {
  metadata: ArticleMetadata;
  html: string;
  coverMediaId: string;
}

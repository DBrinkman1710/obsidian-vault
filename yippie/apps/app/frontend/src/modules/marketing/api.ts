import { api } from '../../api/client'

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed'
export type Channel = 'email' | 'whatsapp'
export type Variant = 'a' | 'b'
export type FilterBy = 'all' | 'label' | 'company' | 'pipeline_stage'

export interface SegmentFilter {
  filter_by: FilterBy
  filter_id?: string | null
  min_engagement_score?: number | null
}

export interface Campaign {
  id: string
  name: string
  subject: string
  status: CampaignStatus
  scheduled_at: string | null
  dispatch_channel: Channel
  ab_winner: Variant | null
  segment_filter: SegmentFilter | null
  post_send_stage_id: string | null
  reply_received_stage_id: string | null
  button_stage_config: Record<string, string> | null
  linked_stage_id: string | null
  dispatched_at: string | null
  created_at: string
  updated_at: string
}

export interface CampaignTemplate {
  id: string
  campaign_id: string
  raw_html: string | null
  raw_css: string | null
  variant: Variant | null
}

export interface SequenceStep {
  id: string
  campaign_id: string
  delay_days: number
  subject: string
  html_body: string
  sent_at: string | null
  created_at: string
}

export interface AnalyticsRecipient {
  id: string
  recipient_email: string
  status: 'sent' | 'opened' | 'clicked' | 'replied'
  variant: Variant | null
  reply_classification: string | null
  updated_at: string
}

export interface VariantStats {
  variant: Variant
  sent: number
  opened: number
  clicked: number
  replied: number
}

export interface AnalyticsSummary {
  sent: number
  opened: number
  clicked: number
  replied: number
  unsubscribed: number
  bounce_count: number
  open_rate: number
  click_rate: number
  reply_rate: number
  ab_winner: Variant | null
  variants: VariantStats[]
  recipients: AnalyticsRecipient[]
}

export interface ButtonAnalytic {
  button_id: string
  label: string
  click_count: number
  action_type: string
  result_label: string | null
}

export interface MarketingStats {
  campaigns_sent: number
  open_rate: number
  response_rate: number
  total_opt_outs: number
}

export interface SegmentPreview {
  count: number
  names: string[]
}

export interface Unsubscribe {
  contact_id: string
  unsubscribed_at: string
  contact_name: string | null
  contact_email: string | null
  campaign_name: string | null
}

export const marketingApi = {
  listCampaigns: () => api.get<Campaign[]>('/marketing/campaigns').then((r: any) => r.data),
  getCampaign: (id: string) => api.get<Campaign>(`/marketing/campaigns/${id}`).then((r: any) => r.data),
  createCampaign: (body: { name: string; subject: string; dispatch_channel: Channel }) =>
    api.post<Campaign>('/marketing/campaigns', body).then((r: any) => r.data),
  updateCampaign: (id: string, body: Partial<Campaign> & { segment_filter?: SegmentFilter }) =>
    api.patch<Campaign>(`/marketing/campaigns/${id}`, body).then((r: any) => r.data),
  deleteCampaign: (id: string) => api.delete(`/marketing/campaigns/${id}`).then((r: any) => r.data),

  getTemplates: (id: string) =>
    api.get<CampaignTemplate[]>(`/marketing/campaigns/${id}/templates`).then((r: any) => r.data),
  setTemplates: (
    id: string,
    templates: { variant: Variant | null; raw_html: string; raw_css: string; design_json?: string; campaign_buttons?: unknown[] }[],
  ) =>
    api.post<CampaignTemplate[]>(`/marketing/campaigns/${id}/templates`, { templates }).then((r: any) => r.data),

  launch: (id: string, body?: { enable_ab?: boolean; segment_filter?: SegmentFilter }) =>
    api.post(`/marketing/campaigns/${id}/launch`, body ?? {}).then((r: any) => r.data),
  schedule: (id: string, scheduled_at: string, segment_filter?: SegmentFilter) =>
    api.post<Campaign>(`/marketing/campaigns/${id}/schedule`, { scheduled_at, segment_filter }).then((r: any) => r.data),

  getAnalytics: (id: string) =>
    api.get<AnalyticsSummary>(`/marketing/campaigns/${id}/analytics`).then((r: any) => r.data),

  listSequences: (id: string) =>
    api.get<SequenceStep[]>(`/marketing/campaigns/${id}/sequences`).then((r: any) => r.data),
  addSequence: (id: string, body: { delay_days: number; subject: string; html_body: string }) =>
    api.post<SequenceStep>(`/marketing/campaigns/${id}/sequences`, body).then((r: any) => r.data),
  deleteSequence: (id: string, seqId: string) =>
    api.delete(`/marketing/campaigns/${id}/sequences/${seqId}`).then((r: any) => r.data),

  previewSegment: (filter_by: FilterBy, filter_id?: string | null) =>
    api
      .get<SegmentPreview>('/marketing/segments/preview', {
        params: { filter_by, ...(filter_id ? { filter_id } : {}) },
      })
      .then((r: any) => r.data),

  listUnsubscribes: () => api.get<Unsubscribe[]>('/marketing/unsubscribes').then((r: any) => r.data),
  removeUnsubscribe: (contactId: string) =>
    api.delete(`/marketing/unsubscribes/${contactId}`).then((r: any) => r.data),

  duplicateCampaign: (id: string) =>
    api.post<Campaign>(`/marketing/campaigns/${id}/duplicate`).then((r: any) => r.data),
  testSend: (id: string) =>
    api.post<{ to: string; campaign_id: string }>(`/marketing/campaigns/${id}/test-send`).then((r: any) => r.data),
  getButtonAnalytics: (id: string) =>
    api.get<ButtonAnalytic[]>(`/marketing/campaigns/${id}/button-analytics`).then((r: any) => r.data),
  getStats: (days = 30) =>
    api.get<MarketingStats>('/marketing/stats', { params: { days } }).then((r: any) => r.data),
}

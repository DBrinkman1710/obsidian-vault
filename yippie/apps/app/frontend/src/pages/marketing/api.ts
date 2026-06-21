import { api } from '../../api/client'

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed'
export type Channel = 'email' | 'whatsapp'
export type Variant = 'a' | 'b'
export type FilterBy = 'all' | 'label' | 'company' | 'pipeline_stage'

export interface SegmentFilter {
  filter_by: FilterBy
  filter_id?: string | null
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
  open_rate: number
  click_rate: number
  reply_rate: number
  ab_winner: Variant | null
  variants: VariantStats[]
  recipients: AnalyticsRecipient[]
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
}

export const marketingApi = {
  listCampaigns: () => api.get<Campaign[]>('/marketing/campaigns').then(r => r.data),
  getCampaign: (id: string) => api.get<Campaign>(`/marketing/campaigns/${id}`).then(r => r.data),
  createCampaign: (body: { name: string; subject: string; dispatch_channel: Channel }) =>
    api.post<Campaign>('/marketing/campaigns', body).then(r => r.data),
  updateCampaign: (id: string, body: Partial<Campaign> & { segment_filter?: SegmentFilter }) =>
    api.patch<Campaign>(`/marketing/campaigns/${id}`, body).then(r => r.data),
  deleteCampaign: (id: string) => api.delete(`/marketing/campaigns/${id}`).then(r => r.data),

  getTemplates: (id: string) =>
    api.get<CampaignTemplate[]>(`/marketing/campaigns/${id}/templates`).then(r => r.data),
  setTemplates: (
    id: string,
    templates: { variant: Variant | null; raw_html: string; raw_css: string }[],
  ) =>
    api.post<CampaignTemplate[]>(`/marketing/campaigns/${id}/templates`, { templates }).then(r => r.data),

  launch: (id: string, body?: { enable_ab?: boolean; segment_filter?: SegmentFilter }) =>
    api.post(`/marketing/campaigns/${id}/launch`, body ?? {}).then(r => r.data),
  schedule: (id: string, scheduled_at: string, segment_filter?: SegmentFilter) =>
    api.post<Campaign>(`/marketing/campaigns/${id}/schedule`, { scheduled_at, segment_filter }).then(r => r.data),

  getAnalytics: (id: string) =>
    api.get<AnalyticsSummary>(`/marketing/campaigns/${id}/analytics`).then(r => r.data),

  listSequences: (id: string) =>
    api.get<SequenceStep[]>(`/marketing/campaigns/${id}/sequences`).then(r => r.data),
  addSequence: (id: string, body: { delay_days: number; subject: string; html_body: string }) =>
    api.post<SequenceStep>(`/marketing/campaigns/${id}/sequences`, body).then(r => r.data),
  deleteSequence: (id: string, seqId: string) =>
    api.delete(`/marketing/campaigns/${id}/sequences/${seqId}`).then(r => r.data),

  previewSegment: (filter_by: FilterBy, filter_id?: string | null) =>
    api
      .get<SegmentPreview>('/marketing/segments/preview', {
        params: { filter_by, ...(filter_id ? { filter_id } : {}) },
      })
      .then(r => r.data),

  listUnsubscribes: () => api.get<Unsubscribe[]>('/marketing/unsubscribes').then(r => r.data),
  removeUnsubscribe: (contactId: string) =>
    api.delete(`/marketing/unsubscribes/${contactId}`).then(r => r.data),
}

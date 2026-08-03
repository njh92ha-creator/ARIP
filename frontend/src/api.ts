import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 30000,
})

export interface Company {
  id: string
  company_code: string
  company_name: string
  industry: string
  functional_currency: string
  timezone?: string
  fiscal_year_start_month: number
  close_frequency?: string
  month_close_day?: number
}

export interface Risk {
  id: string
  title: string
  statement: string
  level: string
  score: number
  route: string
  status: string
  materiality_level: string
  closing_analysis_set_id?: string
  cross_finding_ids?: string[]
  package: {
    summary: string
    references: Array<Record<string, string>>
    expected_questions: string[]
    evidence_checklist: string[]
    response_guidance: string[]
    generated_by: string
    missing_facts: string[]
    evidence_status: string
    cross_finding_ids?: string[]
  }
}

export interface AccountingEvent {
  id: string
  event_type: string
  title: string
  amount: string
  currency: string
  event_hash: string
  classification_confidence: number
  status: string
  closing_analysis_set_id?: string
}

export interface ClosingAnalysisSet {
  id: string
  company_id: string
  fiscal_year: number
  fiscal_period: number
  general_ledger_ready: boolean
  settlement_ready: boolean
  status: 'DRAFT' | 'READY' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  reconciliation_status: string
  analysis_version: number
}

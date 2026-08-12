import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 120000,
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
  company_id: string
  risk_code?: string
  title: string
  statement: string
  level: string
  score: number
  route: string
  status: string
  materiality_level: string
  row_version: number
  analyzed_at?: string | null
  review_decision?: 'CHECK' | 'PENDING' | 'PASS'
  review_recommendation?: { decision: 'CHECK' | 'PENDING' | 'PASS'; confidence: number; matched_cases: number; decision_counts?: { CHECK: number; PENDING: number; PASS: number } } | null
  severity?: 'HIGH' | 'MEDIUM' | 'LOW'
  severity_recommendation?: { severity: 'HIGH' | 'MEDIUM' | 'LOW'; confidence: number; matched_cases: number; severity_counts?: { HIGH: number; MEDIUM: number; LOW: number } } | null
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
    related_accounts?: string[]
    voucher_count?: number
    event_inference?: string
    audit_issues?: string[]
    issue_types?: string[]
    standards_evidence?: Array<{
      source: 'K-IFRS' | 'KASB_QA' | 'IFRIC'
      title: string
      paragraph: string
      excerpt: string
      url: string
    }>
    ledger_evidence?: Array<{
      documentNumber: string
      postingDate: string
      accountName: string
      debitCredit: string
      amount: string
      description: string
    }>
  }
}

export interface AuthPrincipal {
  userId: string
  role: string
  companyId: string | null
  companyIds: string[]
}

export interface RiskReviewCase {
  id: string
  company_id: string
  risk_code: string
  title: string
  statement: string
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string
  score: number
  route: string
  package: Risk['package']
  review_decision: 'CHECK' | 'PENDING' | 'PASS'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  exposure_amount: number
  exposure_basis: string
  materiality_level: string
  status: string
  transferred_at: string
  answers: RiskReviewAnswer[]
  question_statuses: RiskReviewQuestionStatus[]
  attachments: RiskReviewAttachment[]
}

export interface RiskReviewSummary {
  company_id: string
  risk_code: string
  title: string
  statement: string
  review_decision: 'CHECK' | 'PENDING' | 'PASS'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  exposure_amount: number
  status: string
  transferred_at: string
}

export interface RiskReviewAnswer {
  id: string
  question: string
  answer: string
  updated_at: string
}

export interface RiskReviewQuestionStatus {
  id: string
  question: string
  status: 'NOT_REQUIRED' | 'DUPLICATE'
  created_at: string
}

export interface RiskReviewAttachment {
  id: string
  filename: string
  content_type: string
  size_bytes: number
  created_at: string
}

export interface RiskReviewTransfer {
  review_decision: 'CHECK' | 'PENDING'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
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

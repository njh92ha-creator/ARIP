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
  fiscal_year_start_month: number
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
  package: {
    summary: string
    references: Array<Record<string, string>>
    expected_questions: string[]
    evidence_checklist: string[]
    response_guidance: string[]
    generated_by: string
    missing_facts: string[]
    evidence_status: string
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
}

import type { AuthPrincipal, Company } from './api'

export function selectAuthenticatedCompany(
  companies: Company[] | undefined,
  principal: Pick<AuthPrincipal, 'companyId' | 'companyIds'> | undefined,
): Company | undefined {
  if (!principal?.companyId || !principal.companyIds.includes(principal.companyId)) {
    return undefined
  }
  return companies?.find((candidate) => (
    candidate.id === principal.companyId
    && principal.companyIds.includes(candidate.id)
  ))
}

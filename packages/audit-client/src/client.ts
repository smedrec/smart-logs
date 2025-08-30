import { HIPAAComplianceReport, ReportCriteria } from '@repo/audit'

import { BaseResource } from './base.js'

import type { ClientOptions, VersionResponse } from './types.js'

export class AuditClient extends BaseResource {
	constructor(options: ClientOptions) {
		super(options)
	}

	/**
	 * Check if the Audit API is working
	 * @returns Promise ...
	 */
	public ok(): Promise<{ ok: boolean }> {
		return this.request(`/auth/ok`)
	}

	/**
	 * Retrieves api version
	 * @returns Promise contains api version
	 */
	public version(): Promise<VersionResponse> {
		return this.request(`/version`)
	}

	/**
	 * Generate HIPAA report
	 * @param criteria ReportCriteria
	 * @returns Promise contains HIPAAComplianceReport
	 */
	public async hipaa(criteria: ReportCriteria): Promise<HIPAAComplianceReport> {
		return await this.request<HIPAAComplianceReport>(`/compliance/reports/hipaa`, {
			method: 'POST',
			body: { criteria: criteria },
		})
	}
}

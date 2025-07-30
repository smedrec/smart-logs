import { faker } from '@faker-js/faker'

import { Alert } from '@repo/audit'

function createRandomAlert(): Partial<Alert> {
	return {
		severity: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
		type: faker.helpers.arrayElement(['SECURITY', 'COMPLIANCE', 'PERFORMANCE', 'SYSTEM']),
		title: faker.lorem.sentence(),
		description: faker.lorem.paragraph(),
		source: faker.internet.url(),
		metadata: {
			userId: faker.string.uuid(),
			organizationId: faker.string.uuid(),
			tenantId: faker.string.uuid(),
		},
		resolved: false,
	}
}

const alert = createRandomAlert()

import { eq } from 'drizzle-orm'

import { db } from './db/index.js'
import { activeOrganization, member } from './db/schema/index.js'

interface ActiveOrganization {
	userId: string
	organizationId: string
	role: string
}

async function getActiveOrganization(userId: string): Promise<ActiveOrganization | undefined> {
	try {
		const result = await db.query.activeOrganization.findFirst({
			where: eq(activeOrganization.userId, userId),
		})
		if (result) {
			return result
		} else {
			const result = await db.query.member.findFirst({
				where: eq(member.userId, userId),
			})
			if (result) {
				await db
					.insert(activeOrganization)
					.values({ userId: userId, organizationId: result.organizationId, role: result.role })
					.onConflictDoUpdate({
						target: activeOrganization.userId,
						set: { organizationId: result.organizationId, role: result.role },
					})

				return {
					userId: userId,
					organizationId: result.organizationId,
					role: result.role,
				}
			}

			//throw new HTTPException(404, { message: 'The user is not member.' });
			/**throw new APIError('BAD_REQUEST', {
        message: 'User must agree to the TOS before signing up.',
      });*/
		}
		return undefined
	} catch (error) {
		// TODO: handle error
		return undefined
	}
}

export { getActiveOrganization }

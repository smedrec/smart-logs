import 'dotenv/config'

import { eq } from 'drizzle-orm'

import { emailProvider } from '@repo/auth'
import { NodeMailer, ResendMailer, SendGridMailer } from '@repo/mailer'

import { inngest } from '../../client.js'

import type { NodeMailerSmtpOptions } from '@repo/mailer'

type Mailer = {
	from: string | null
	mailer: NodeMailer | ResendMailer | SendGridMailer | null
}

const mailerConfig: NodeMailerSmtpOptions = {
	host: process.env.SMTP_HOST,
	port: parseInt(process.env.SMTP_PORT!, 10), // Or 465 for SSL
	secure: parseInt(process.env.SMTP_PORT!, 10) === 465, // true for 465, false for other ports like 587 (STARTTLS)
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASSWORD,
	},
	// Other nodemailer options can be added here
}

const mailer = new NodeMailer(mailerConfig)

async function getEmailProvider(
	organizationId: string,
	action: string,
	db: any,
	kms: any
): Promise<Mailer> {
	const transport: Mailer = { from: null, mailer: null }

	if (action === 'sendVerificationEmail')
		return { from: 'SMEDREC <no-reply@smedrec.com>', mailer: mailer }

	const provider = await db.query.emailProvider.findFirst({
		where: eq(emailProvider.organizationId, organizationId),
	})

	if (!provider) {
		throw Error('Mailer connection details from database error.')
	}

	// TODO - improve the possible error
	if (provider.password) {
		const password = await kms.decrypt(provider.password!)
		provider.password = password.plaintext
	}

	if (provider.apiKey) {
		const apiKey = await kms.decrypt(provider.apiKey!)
		provider.apiKey = apiKey.plaintext
	}

	transport.from = `${provider.fromName} <${provider.fromEmail}>`

	switch (provider?.provider) {
		case 'smtp':
			transport.mailer = new NodeMailer({
				host: provider.host!,
				port: provider.port as number,
				secure: provider.secure as boolean,
				auth: {
					user: provider.user!,
					pass: provider.password!,
				},
			})
			break
		case 'resend':
			transport.mailer = new ResendMailer({
				apiKey: provider.apiKey!,
			})
			break
		case 'sendgrid':
			transport.mailer = new SendGridMailer({
				apiKey: provider.apiKey!,
			})
			break

		default:
			break
	}

	return transport
}

export const sendEmail = inngest.createFunction(
	{
		id: 'send-email',
		name: 'Send Email',
		description: 'Send an email',
	},
	{
		event: 'email/send',
	},
	async ({ event, step, env, session, services }) => {
		const { db, kms, audit } = services
		const { principalId, organizationId, action, emailDetails } = event.data
		let email: Mailer

		try {
			email = await getEmailProvider(organizationId, action, db.auth, kms)
		} catch (error) {
			await audit?.log({
				principalId,
				organizationId,
				action: `${action}.get-email-provider`,
				status: 'failure',
				outcomeDescription: `Mailer send error: Mailer connection error for Email service`,
			})
			//logger.error(`❌ Error processing job ${job.id} for action '${action}':`, error)
			// Depending on the error, you might want to:
			// - Let BullMQ handle retries (default behavior for unhandled promise rejections)
			// - Implement custom retry logic
			// - Move the job to a dead-letter queue if it's consistently failing
			// For now, re-throwing the error to let BullMQ handle it based on its configuration.
			throw error
		}
		// Get the transport from the database
		/**const transport: Mailer = await step.run('get-email-transport', async (): Promise<Mailer> => {
			// Create default transport with explicit typing
			const defaultTransport: Mailer = {
				from: 'SMEDREC <no-reply@smedrec.com>',
				mailer: mailer,
			}
			if (action === 'sendVerificationEmail') return defaultTransport

			const provider = await db.auth.query.emailProvider.findFirst({
				where: eq(emailProvider.organizationId, organizationId),
			})

			if (!provider) {
				throw Error('Mailer connection details from database error.')
			}

			// TODO - improve the possible error
			if (provider.password) {
				const password = await kms.decrypt(provider.password!)
				provider.password = password.plaintext
			}

			if (provider.apiKey) {
				const apiKey = await kms.decrypt(provider.apiKey!)
				provider.apiKey = apiKey.plaintext
			}

			defaultTransport.from = `${provider.fromName} <${provider.fromEmail}>`

			switch (provider.provider) {
				case 'smtp':
					defaultTransport.mailer = new NodeMailer({
						host: provider.host!,
						port: provider.port as number,
						secure: provider.secure as boolean,
						auth: {
							user: provider.user!,
							pass: provider.password!,
						},
					})
					break
				case 'resend':
					defaultTransport.mailer = new ResendMailer({
						apiKey: provider.apiKey!,
					})
					break
				case 'sendgrid':
					defaultTransport.mailer = new SendGridMailer({
						apiKey: provider.apiKey!,
					})
					break
				default:
					defaultTransport.mailer = mailer
					break
			}
			if (!defaultTransport.mailer) {
				throw Error('Mailer connection details from database error.')
			}
			return defaultTransport
		}) **/

		await step.run('send-email-with-transport', async () => {
			try {
				await email.mailer?.send({
					...emailDetails,
					from: email.from!,
				})
				await audit.log({
					principalId,
					organizationId: action !== 'sendVerificationEmail' ? organizationId : null,
					action: `${action}.send`,
					status: 'success',
					outcomeDescription: 'Email sent successfully using Mailer!',
				})
			} catch (error) {
				await audit.log({
					principalId,
					organizationId: action !== 'sendVerificationEmail' ? organizationId : null,
					action: `${action}.send`,
					status: 'failure',
					outcomeDescription: `Mailer send error: ${error}`,
				})
				throw error
			}
		})
		return {
			action: `${action}.send`,
			status: 'success',
			outcomeDescription: 'Email sent successfully using Mailer!',
		}
	}
)

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

/*
 * Get the email provider details from the database.
 */
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

/**
 * Send an email using the Mailer service.
 */
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
				inngestEvent: {
					...event,
				},
			})
			throw error
		}

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
					inngestEvent: {
						...event,
					},
				})
			} catch (error) {
				await audit.log({
					principalId,
					organizationId: action !== 'sendVerificationEmail' ? organizationId : null,
					action: `${action}.send`,
					status: 'failure',
					outcomeDescription: `Mailer send error: ${error}`,
					inngestEvent: {
						...event,
					},
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

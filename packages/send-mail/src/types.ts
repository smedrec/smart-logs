/**
 * @interface MailerSendOptions
 * @description Defines the common options for sending an email, regardless of the provider.
 * @property {string} from - The sender's email address.
 * @property {string | string[]} to - The recipient's email address or an array of recipient email addresses.
 * @property {string} subject - The subject line of the email.
 * @property {string} html - The HTML content of the email.
 * @property {string} [text] - Optional plain text content of the email.
 */
export interface MailerSendOptions {
	from: string
	to: string | string[]
	subject: string
	html: string
	text?: string
}

/**
 * Defines the structure for an event that triggers sending an email.
 * This event is typically placed onto a queue for asynchronous processing.
 */
export interface SendMailEvent {
	/**
	 * The unique identifier of the principal (e.g., user) initiating the action
	 * or on whose behalf the email is being sent.
	 */
	principalId: string
	/**
	 * The unique identifier of the organization associated with this email event.
	 * This can be used for tenant-specific logic or logging.
	 */
	organizationId: string
	/**
	 * The unique identifier of the service associated with this email event.
	 * This can be used for tenant-specific logic or logging.
	 */
	service: string
	/**
	 * A string describing the action that triggered this email.
	 * For example, "user_registration", "password_reset", "order_confirmation".
	 */
	action: string
	/**
	 * The detailed options for the email to be sent, conforming to the `MailerSendOptions`
	 * interface from the `@repo/mailer` package. This includes recipient(s), subject, body, etc.
	 */
	emailDetails: MailerSendOptions
}

import Mailjet, { Client as MailjetClient } from "node-mailjet";
import { err, ok, type Result } from "ott-common/result.js";
import { Counter } from "prom-client";
import { getLogger } from "./logger.js";
import { conf } from "./ott-config.js";

const log = getLogger("mailer");

export abstract class Mailer {
	abstract send(email: Email): Promise<Result<void, MailerError>>;
}

export interface Email {
	to: string;
	subject: string;
	body: string;
}

export class MailjetMailer extends Mailer {
	client: MailjetClient;

	constructor(apiKey: string, apiSecret: string) {
		super();
		// @ts-expect-error This is how you use the Mailjet client, I don't know why it's complaining
		this.client = Mailjet.apiConnect(apiKey, apiSecret);
	}

	async send(email: Email): Promise<Result<void, MailerError>> {
		const resp = await this.client.post("send", { version: "v3.1" }).request({
			Messages: [
				{
					From: {
						Email: conf.get("mail.sender_email"),
						Name: conf.get("mail.sender_name"),
					},
					To: [
						{
							Email: email.to,
						},
					],
					Subject: email.subject,
					HTMLPart: email.body,
				},
			],
			SandboxMode: conf.get("mail.mailjet_sandbox"),
		});

		const body = typeof resp.body === "string" ? JSON.parse(resp.body) : resp.body;

		log.info(`Mailjet response: ${JSON.stringify(body)}`);

		if (body.Messages[0].Status !== "success") {
			counterEmailsFailed.inc();
			log.error(`Failed to send email: ${JSON.stringify(body)}`);
			return err(new MailerError("Failed to send email"));
		}

		counterEmailsSent.inc();

		return ok(undefined);
	}
}

export class MockMailer extends Mailer {
	sentEmails: Email[] = [];

	async send(email: Email): Promise<Result<void, MailerError>> {
		this.sentEmails.push(email);
		return ok(undefined);
	}

	clearSent(): void {
		this.sentEmails = [];
	}
}

// Intentionally does not extend OttException so it gets logged
export class MailerError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MailerError";
	}
}

const counterEmailsSent = new Counter({
	name: "ott_mailer_emails_sent",
	help: "Number of emails sent",
});

const counterEmailsFailed = new Counter({
	name: "ott_mailer_emails_failed",
	help: "Number of emails failed to send",
});

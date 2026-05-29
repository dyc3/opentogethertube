<template>
	<div class="mx-auto max-w-3xl px-6 py-16">
		<span class="label-mono text-signal">The fine print</span>
		<h1 class="section-title font-display mt-2 text-4xl tracking-wide">
			{{ $t("privacy.title") }}
		</h1>
		<!-- I18n: don't localize this file.  -->
		<div class="prose-drivein mt-8 flex flex-col gap-5 text-muted-foreground leading-relaxed">
			<p>This site uses cookies. They are required strictly for functionality only.</p>

			<p>
				Your IP is logged in OpenTogetherTube\'s logs when you create a room to help combat
				abuse. It is also recorded for a short period of time for rate limiting. Chats are not
				recorded or logged at all. What you search for in the "add video" search box is logged,
				but never associated with your OTT account or session.
			</p>

			<p>
				General site usage, like creating a room, adding videos, etc., are logged to monitor and
				debug performance. Logs are not kept for more than a week. Logged events are not
				associated with your account or session.
			</p>

			<p>
				Metrics are collected from the server to monitor OpenTogetherTube's status. User session
				data and accounts is never collected as a part of these metrics.
			</p>

			<p>
				If you have registered an account, your email is only used for account recovery, or to
				contact you in case it is necessary to resolve a bug, or follow up on site feedback. An
				email is not required if you log in with Discord. Your email, owned rooms, or other
				account information is your private information, and as such will never be distributed
				or sold to third parties.
			</p>

			<p>
				OpenTogetherTube is GDPR compliant because of how little information is collected. If
				you want your account data, please contact me at
				<a href="mailto:carson.mcmanus1+ott-support@gmail.com">
					carson.mcmanus1+ott-support@gmail.com
				</a>
			</p>

			<p>
				This site uses the Youtube Data API, and it's usage must comply with the
				<a href="https://developers.google.com/youtube/terms/api-services-terms-of-service">
					YouTube API Terms of Service</a
				>. No personally identifiable information is sent to Youtube. Watching Youtube videos
				requires you to agree to the
				<a href="https://www.youtube.com/t/terms">Youtube Terms of Service</a>, and
				<a href="https://policies.google.com/privacy">Google's privacy policy</a>. Your YouTube
				account is not accessed by OpenTogetherTube, unless you request a video that you
				uploaded. The only data that is used by OpenTogetherTube is publicly available
				information, which includes: video id, video title, video description, video thumbnail,
				and video duration. This information is cached for up to 30 days.
			</p>
		</div>

		<h2 class="section-title font-display mt-12 text-3xl tracking-wide">Contact Info</h2>

		<p class="mt-6 text-muted-foreground">
			Email:
			<a href="mailto:carson.mcmanus1+ott-support@gmail.com">
				carson.mcmanus1+ott-support@gmail.com
			</a>
		</p>
	</div>
</template>

<script setup></script>

<style scoped>
.section-title {
	position: relative;
	padding-left: 1rem;
}
.section-title::before {
	content: "";
	position: absolute;
	left: 0;
	top: 0.1em;
	bottom: 0.1em;
	width: 4px;
	background: var(--primary);
	box-shadow: 0 0 12px var(--primary);
}
.prose-drivein a {
	color: var(--signal);
}
.prose-drivein a:hover {
	color: var(--primary);
}
</style>

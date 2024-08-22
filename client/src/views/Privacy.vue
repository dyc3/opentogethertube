<template>
	<v-container>
		<h1>{{ $t("privacy.title") }}</h1>
		<!-- I18n: don't localize this file.  -->
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

		<h1>Contact Info</h1>

		<p>
			Email:
			<a href="mailto:carson.mcmanus1+ott-support@gmail.com">
				carson.mcmanus1+ott-support@gmail.com
			</a>
		</p>
	</v-container>
</template>

<script>
export default {
	name: "privacypolicy",
};
</script>

<style lang="scss" scoped>
p {
	margin: 1em 0;
}
</style>

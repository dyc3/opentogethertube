<template>
	<v-container>
		<h1>{{ $t("privacy.title") }}</h1>
		<p>
			{{ $t("privacy.text1") }}
		</p>

		<p>
			{{ $t("privacy.text2") }}
		</p>

		<p>
			{{ $t("privacy.text3") }}
		</p>

		<p>
			{{ $t("privacy.text4") }}
		</p>

		<p>
			{{ $t("privacy.text5.text") }}
			<a href="https://twitter.com/rollthedyc3">{{ $t("privacy.text5.link-text") }}</a>
		</p>

		<p>
			{{ $t("privacy.text6.text1") }}
			<a href="https://developers.google.com/youtube/terms/api-services-terms-of-service">{{
				$t("privacy.text6.link-text1")
			}}</a
			>. {{ $t("privacy.text6.text2") }}
			<a href="https://www.youtube.com/t/terms">{{ $t("privacy.text6.link-text2") }}</a
			>, {{ $t("privacy.text6.text3") }}
			<a href="https://policies.google.com/privacy">{{ $t("privacy.text6.link-text3") }}</a
			>.
		</p>
	</v-container>
</template>

<script>
export default {
	name: "privacypolicy",
};
</script>

<style lang="scss" scoped></style>

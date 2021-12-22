<template>
	<v-container>
		<h1>Frequently Asked Questions</h1>
		<v-row v-for="(item, index) in questions" :key="index">
			<v-col>
				<v-sheet>
					<v-container>
						<h2>{{ item.question }}</h2>
						<!-- eslint-disable-next-line vue/no-v-html -->
						<p v-html="item.answer"></p>
					</v-container>
				</v-sheet>
			</v-col>
		</v-row>
	</v-container>
</template>

<script>
export default {
	name: 'faq',
	data() {
		return {
			questions: [
				{
					question: "What kind of videos can be played?",
					answer: "Youtube, Vimeo, and Dailymotion videos, as well as direct links to supported video files, like .mp4 (and sometimes .webm).",
				},
				{
					question: "Can you add support X?",
					answer: "If X has an iframe API, then yes, that is possible.",
				},
				{
					question: "Will you add support for X?",
					answer: "Maybe, it depends on demand. Add a github issue or upvote an existing one to express your interest.",
				},
				{
					question: "I want a permanent room with a custom URL.",
					answer: "Create one by clicking the button in the top right corner.",
				},
				{
					question: "Why do videos sometimes have no title or thumbnail, but they can still be played?",
					answer: "This probably means that the server was unable to get that information because it ran out of Youtube API quota.",
				},
				{
					question: 'Why does it say "Out of quota" when searching for youtube videos?',
					answer: "Youtube searches are expensive to perform. Because of this, searches are rate limted. If this happens, just do the search on youtube and copy the link.",
				},
				{
					question: "How do permanent rooms work?",
					answer: "Right now, permanent rooms just serve to provide custom room URLs, and anybody can access all permanent rooms. If you are logged in, you can claim ownership of permanent rooms that have not been claimed. Eventually, rooms will be able to be set visibility as private, and only allow invited users into the room. This will require all invited users to have accounts, but it will prevent random or unwanted people from entering private rooms. Check the progress of private rooms here: <a href=\"https://github.com/dyc3/opentogethertube/issues/261\">dyc3/opentogethertube#261</a>",
				},
			],
		};
	},
};
</script>

<style lang="scss" scoped>

</style>

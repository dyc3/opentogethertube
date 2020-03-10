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
					answer: "Youtube, Vimeo, and Dailymotion videos.",
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
					question: "I see a feature listed on the home page but it's not implemented.",
					answer: "I'm working on it.",
				},
				{
					question: "I want a permanent room with a custom URL.",
					answer: "Currently, there isn't a way to make permanent rooms through the website. <a href='https://twitter.com/@rollthedyc3'>DM me on twitter</a> and I'll make you one.",
				},
			],
		};
	},
};
</script>

<style lang="scss" scoped>

</style>

<template>
	<v-container>
		<h1>{{ $t("faq.title") }}</h1>
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
	name: "faq",
	data() {
		return {
			questions: this.$t("faq.questions"),
		};
	},
};
</script>

<style lang="scss" scoped></style>

<template>
	<v-container>
		<h1>{{ t("faq.title") }}</h1>
		<v-row v-for="(item, index) in questions" :key="index">
			<v-col>
				<v-sheet>
					<v-container>
						<h2>{{ t(item.question) }}</h2>
						<!-- eslint-disable-next-line vue/no-v-html -->
						<p v-html="t(item.answer)"></p>
					</v-container>
				</v-sheet>
			</v-col>
		</v-row>
	</v-container>
</template>

<script lang="ts">
import { defineComponent, onMounted, Ref, ref } from "vue";
import { useI18n } from "vue-i18n";

interface Question {
	question: string;
	answer: string;
}

export const FaqView = defineComponent({
	name: "faq",
	setup() {
		let { t } = useI18n();

		let questions: Ref<Question[]> = ref([]);

		onMounted(() => {
			let q: Question[] = [];
			for (let i = 0; i <= 6; i++) {
				q.push({
					question: `faq.questions.${i}.question`,
					answer: `faq.questions.${i}.answer`,
				});
			}
			questions.value = q;
		});

		return {
			t,
			questions,
		};
	},
});

export default FaqView;
</script>

<style lang="scss" scoped></style>

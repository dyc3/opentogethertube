import * as d3 from "d3";
import type { SystemState } from "ott-vis/types";
import React, { useCallback, useEffect, useRef } from "react";
import {
	type BoundingBox,
	buildFullTree,
	calcGoodTreeRadius,
	expandBBox,
	filterTreeGroups,
	offsetBBox,
	pruneTrees,
	stackBoxes,
	superBoundingBox,
	type TreeNode,
	treeBoundingBox,
} from "treeutils";
import "./topology-view.css";
import { dedupeItems } from "aggregate";
import { calcZoomTransform, useActivityAnimations, useD3AutoZoom } from "chartutils";
import ZoomReset from "components/ZoomReset";
import type { NodeRadiusOptions } from "types";

interface TopologyViewProps extends TopologyViewStyleProps {
	systemState: SystemState;
	assignColor: (thing: string) => string;
	width: number;
	height: number;
}

export interface TopologyViewStyleProps extends NodeRadiusOptions {
	subtreePadding: number;
	regionBoxPadding: number;
}

interface Subtree {
	tree: d3.HierarchyNode<TreeNode>;
	bbox: BoundingBox;
	x: number;
	y: number;
}

interface UnbuiltRegion {
	name: string;
	balancerTrees: d3.HierarchyNode<TreeNode>[];
	monolithTrees: d3.HierarchyNode<TreeNode>[];
}

interface Region {
	name: string;
	balancerSubtrees: Subtree[];
	monolithSubtrees: Subtree[];
	bbox: BoundingBox;
	x: number;
	y: number;
}

const DEBUG_BOUNDING_BOXES = false;

/**
 * The goal of this component is to show a more accurate topology view from the perspective of actual network connections.
 *
 * There will be 2 types of trees: Balancer Trees and Monolith Trees. The Balancer Trees will show the connections between Balancers and clients, while the Monolith Trees will show the connections between Monoliths and Rooms.
 *
 * These trees will be grouped by region, and the nodes will be colored by group. Balancer Trees will be on the left, and Monolith Trees will be on the right, with connections between Balancers and Monoliths, and regions being shown by boxing the trees that are in the same region.
 */
export const TopologyView: React.FC<TopologyViewProps> = ({
	systemState,
	assignColor,
	width,
	height,
	baseNodeRadius = 20,
	balancerNodeRadius = 20,
	clientNodeRadius = 8,
	subtreePadding = 60,
	regionBoxPadding = 200,
}) => {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const fullTree = d3
		.hierarchy(buildFullTree(systemState))
		.sort((a, b) => d3.ascending(a.data.id, b.data.id));
	const monolithTrees = dedupeItems(
		pruneTrees(fullTree, "monolith", "room"),
		tree => tree.data.id,
		(a, b) => a
	);
	const balancerTrees = filterTreeGroups(fullTree, ["balancer", "client"]);

	const getRadius = useCallback(
		(group: string): number => {
			if (group === "client") {
				return clientNodeRadius;
			} else if (group === "balancer") {
				return balancerNodeRadius;
			} else {
				return baseNodeRadius;
			}
		},
		[baseNodeRadius, balancerNodeRadius, clientNodeRadius]
	);

	const { resetZoom, enableAutoZoom, transform, setTransform } = useD3AutoZoom(
		svgRef,
		d3.zoomIdentity.translate(width / 2, height / 2)
	);

	useEffect(() => {
		if (!svgRef.current) {
			return;
		}

		const svg = d3.select(svgRef.current);

		const monolithRegions: Map<string, UnbuiltRegion> = new Map();
		for (const tree of monolithTrees) {
			const region = tree.data.region;
			if (!monolithRegions.has(region)) {
				monolithRegions.set(region, {
					name: region,
					balancerTrees: [],
					monolithTrees: [],
				});
			}
			monolithRegions.get(region)?.monolithTrees.push(tree);
		}
		for (const tree of balancerTrees) {
			const region = tree.data.region;
			if (!monolithRegions.has(region)) {
				monolithRegions.set(region, {
					name: region,
					balancerTrees: [],
					monolithTrees: [],
				});
			}
			monolithRegions.get(region)?.balancerTrees.push(tree);
		}

		const tr = d3.transition().duration(1000).ease(d3.easeCubicInOut);
		const diagonal = d3
			.linkRadial<any, TreeNode>()
			.angle((d: any) => Math.atan2(d.y, d.x) + Math.PI / 2)
			.radius((d: any) => Math.sqrt(d.x * d.x + d.y * d.y));
		function renderTrees(
			trees: Subtree[],
			base: d3.Selection<d3.BaseType | SVGElement, any, null, any>
		) {
			base.selectAll(".tree")
				.data(trees)
				.join(
					create => {
						const group = create
							.append("g")
							.attr("class", "tree")
							.attr("transform", d => `translate(${d.x}, ${d.y})`);
						group.append("g").attr("class", "links");
						group.append("g").attr("class", "nodes");
						group.append("g").attr("class", "texts");
						return group;
					},
					update => update,
					exit => exit.remove()
				)
				.transition(tr)
				.attr("transform", d => `translate(${d.x}, ${d.y})`)
				.each(function (subtree) {
					const tree = subtree.tree;
					const group = d3.select(this);
					group
						.select(".links")
						.selectAll(".link")
						.data(tree.links(), (d: any) => d.source?.data?.id + d.target?.data?.id)
						.join(
							create => create.append("path").attr("class", "link"),
							update => update,
							exit => exit.transition(tr).attr("stroke-width", 0).remove()
						)
						.attr("class", "link")
						.attr("data-nodeid-source", d => d.source.data.id)
						.attr("data-nodeid-target", d => d.target.data.id)
						.transition(tr)
						.attr("d", diagonal)
						.attr("stroke", "#fff")
						.attr("stroke-width", 1.5);

					group
						.select(".nodes")
						.selectAll(".node")
						.data(tree.descendants(), (d: any) => d.data.id)
						.join(
							create =>
								create
									.append("circle")
									.attr("class", "node")
									.attr("cx", (d: any) => (d.parent ? d.parent.x : d.x))
									.attr("cy", (d: any) => (d.parent ? d.parent.y : d.y)),
							update => update,
							exit =>
								exit
									.transition(tr)
									.attr("r", 0)
									.attr("x", (d: any) => (d.parent ? d.parent.x : d.x))
									.attr("y", (d: any) => (d.parent ? d.parent.y : d.y))
									.remove()
						)
						.attr("data-nodeid", d => d.data.id)
						.transition(tr)
						.attr("cx", (d: any) => d.x)
						.attr("cy", (d: any) => d.y)
						.attr("r", d => getRadius(d.data.group))
						.attr("fill", d => assignColor(d.data.group))
						.attr("stroke", "#fff")
						.attr("stroke-width", 2);

					group
						.select(".texts")
						.selectAll(".text")
						.data(tree.descendants(), (d: any) => d.data.id)
						.join(
							create =>
								create
									.append("text")
									.attr("class", "text")
									.attr("x", (d: any) => (d.parent ? d.parent.x : d.x))
									.attr("y", (d: any) => (d.parent ? d.parent.y : d.y)),
							update => update,
							exit =>
								exit
									.transition(tr)
									.attr("font-size", 0)
									.attr("x", (d: any) => (d.parent ? d.parent.x : d.x))
									.attr("y", (d: any) => (d.parent ? d.parent.y : d.y))
									.remove()
						)
						.filter(d => d.data.group !== "room" && d.data.group !== "client")
						.text(d => d.data.id.substring(0, 6))
						.transition(tr)
						.attr("x", (d: any) => d.x)
						.attr("y", (d: any) => d.y)
						.attr("font-size", 10);
				});
		}

		function buildSubtrees(
			trees: d3.HierarchyNode<TreeNode>[],
			nodeRadius: number,
			nodePadding: number,
			onRight: boolean
		): Subtree[] {
			const subtrees: Subtree[] = [];
			for (const tree of trees) {
				let radius = calcGoodTreeRadius(tree, nodeRadius, nodePadding);
				const shouldPack = radius > 300;
				if (shouldPack) {
					radius = calcGoodTreeRadius(tree, nodeRadius / 2, nodePadding);
				}
				const layout = d3.tree<TreeNode>().size([Math.PI * (onRight ? 1 : -1), radius]);
				// d3 expects children to be undefined if there are no children
				if (tree.children && tree.children.length === 0) {
					tree.children = undefined;
				}
				layout(tree);
				// precompute radial coordinates
				tree.each((node, i) => {
					if (shouldPack) {
						// @ts-expect-error d3 adds x and y to the node
						node.y -= nodeRadius * (i % 2) * 2;
					}
					// @ts-expect-error d3 adds x and y to the node
					const [x, y] = d3.pointRadial(node.x, node.y);
					// @ts-expect-error d3 adds x and y to the node
					node.x = x;
					// @ts-expect-error d3 adds x and y to the node
					node.y = y;
				});
				const bbox = treeBoundingBox(tree);
				subtrees.push({
					tree,
					bbox,
					x: 100 * (onRight ? 1 : -1),
					y: 0,
				});
			}
			const subtreeYs = stackBoxes(
				subtrees.map(t => t.bbox),
				subtreePadding
			);
			for (const [i, subtree] of subtrees.entries()) {
				subtree.y = subtreeYs[i];
			}
			return subtrees;
		}

		function buildRegion(region: UnbuiltRegion): Region {
			const monolithSubtrees: Subtree[] = buildSubtrees(
				region.monolithTrees,
				baseNodeRadius,
				5,
				true
			);
			const balancerSubtrees: Subtree[] = buildSubtrees(
				region.balancerTrees,
				clientNodeRadius,
				0,
				false
			);

			const built: Region = {
				name: region.name,
				balancerSubtrees,
				monolithSubtrees,
				bbox: expandBBox(
					superBoundingBox([
						...balancerSubtrees.map(t => offsetBBox(t.bbox, t.x, t.y)),
						...monolithSubtrees.map(t => offsetBBox(t.bbox, t.x, t.y)),
					]),
					regionBoxPadding
				),
				x: 0,
				y: 0,
			};
			return built;
		}

		function renderRegion(
			region: Region,
			base: d3.Selection<d3.BaseType | SVGElement, any, null, any>
		) {
			const monolithSubtrees = region.monolithSubtrees;
			const balancerSubtrees = region.balancerSubtrees;

			if (DEBUG_BOUNDING_BOXES) {
				base.select(".monolith-trees")
					.selectAll("rect")
					.data([...monolithSubtrees, ...balancerSubtrees])
					.join("rect")
					.attr("x", d => d.x + d.bbox[0])
					.attr("y", d => d.y + d.bbox[1])
					.attr("width", d => d.bbox[2] - d.bbox[0])
					.attr("height", d => d.bbox[3] - d.bbox[1])
					.attr("fill", "rgba(255, 255, 255, 0.1)")
					.attr("stroke", "white")
					.attr("stroke-width", 1);
			}

			renderTrees(balancerSubtrees, base.select(".balancer-trees"));
			renderTrees(monolithSubtrees, base.select(".monolith-trees"));

			interface B2M {
				source: Subtree;
				target: Subtree;
			}

			const b2mLinks: B2M[] = [];
			for (const balancer of balancerSubtrees) {
				for (const monolith of monolithSubtrees) {
					b2mLinks.push({ source: balancer, target: monolith });
				}
			}

			// biome-ignore lint/nursery/noShadow: biome migration
			const diagonal = d3
				.link<B2M, Subtree>(d3.curveStep)
				.x((d: any) => d.x + d.tree.x)
				.y((d: any) => d.y + d.tree.y);
			base.select(".b2m")
				.selectAll(".link")
				.data(b2mLinks, (d: any) => d.source?.tree.data.id + d.target?.tree.data.id)
				.join(
					create => create.append("path").attr("class", "link"),
					update => update,
					exit => exit.transition(tr).attr("stroke-width", 0).remove()
				)
				.attr("data-nodeid-source", d => d.source.tree.data.id)
				.attr("data-nodeid-target", d => d.target.tree.data.id)
				.transition(tr)
				.attr("d", diagonal)
				.attr("stroke-width", 1.5)
				.attr("stroke", "#fff");
		}

		const monolithBuiltRegions: Region[] = [];
		for (const [_name, region] of monolithRegions.entries()) {
			monolithBuiltRegions.push(buildRegion(region));
		}
		const regionYs = stackBoxes(
			monolithBuiltRegions.map(r => r.bbox),
			baseNodeRadius * 2 + 10
		);
		for (const [i, region] of monolithBuiltRegions.entries()) {
			region.y = regionYs[i];
		}

		svg.select(".regions")
			.selectAll(".region")
			.data(monolithBuiltRegions, (d: any) => d.name)
			.join(
				create => {
					const group = create.append("g").attr("class", "region");
					group.append("rect").attr("class", "region-bbox");
					group.append("text").attr("class", "region-name text");
					group.append("g").attr("class", "b2m links");
					group.append("g").attr("class", "balancer-trees");
					group.append("g").attr("class", "monolith-trees");
					return group;
				},
				update => update,
				exit => exit.transition(tr).attr("opacity", 0).remove()
			)
			.attr("data-nodeid", d => d.name)
			.transition(tr)
			.attr("opacity", 1)
			.attr("transform", d => `translate(${d.x}, ${d.y})`)
			.each(function (region) {
				const group = d3.select(this);

				renderRegion(region, group);

				group
					.select(".region-bbox")
					.datum(region)
					.transition(tr)
					.attr("x", d => d.bbox[0])
					.attr("y", d => d.bbox[1])
					.attr("width", d => d.bbox[2] - d.bbox[0])
					.attr("height", d => d.bbox[3] - d.bbox[1]);

				group
					.select(".region-name")
					.datum(region)
					.text(d => d.name)
					.transition(tr)
					.attr("x", d => d.bbox[0] + (d.bbox[2] - d.bbox[0]) / 2)
					.attr("y", d => d.bbox[1] + 20);
			});

		// zoom to fit the whole tree
		const superBBox = expandBBox(
			superBoundingBox(
				Array.from(monolithBuiltRegions.values()).map(r => offsetBBox(r.bbox, r.x, r.y))
			),
			50
		);
		const transformNew = calcZoomTransform(superBBox, width, height);

		if (
			transformNew.k !== transform.k ||
			transformNew.x !== transform.x ||
			transformNew.y !== transform.y
		) {
			setTransform(transformNew);
		}
	});

	useActivityAnimations(svgRef, getRadius);

	return (
		<>
			{!enableAutoZoom ? <ZoomReset onClick={resetZoom} /> : null}
			<svg width={width} height={height} ref={svgRef}>
				<g className="chart">
					<g className="regions" />
					<g className="b2m links" />
				</g>
			</svg>
		</>
	);
};

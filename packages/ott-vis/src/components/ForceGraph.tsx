import React from "react";
import * as d3 from "d3";

interface ForceGraphProps {
  data: any;
  width?: number;
  height?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
}

class Node implements d3.SimulationNodeDatum {
  public x: number = 0;
  public y: number = 0;
  constructor (public id: number) {}
}

class Link implements d3.SimulationLinkDatum<Node> {
  constructor (public source: Node, public target: Node)  {}
}

const ForceGraph: React.FC<ForceGraphProps> = ({
  data,
  width = 640,
  height = 400,
  marginTop = 20,
  marginRight = 20,
  marginBottom = 50,
  marginLeft = 20
}) => {
  // Specify the color scale.
  const color = d3.scaleOrdinal(d3.schemeCategory10);
  
  // The force simulation mutates links and nodes, so create a copy
  // so that re-evaluating this cell produces the same result.
  const links = data.links.map((d: Link) => ({...d}));
  const nodes = data.nodes.map((d: Node) => ({...d}));
  
  // Create a simulation with several forces.
  const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: Node) => d.id))
      .force("charge", d3.forceManyBody())
      .force("x", d3.forceX())
      .force("y", d3.forceY());
  
  // Create the SVG container.
  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -height / 2, width, height])
      .attr("style", "max-width: 100%; height: auto;");
  
  // Add a line for each link, and a circle for each node.
  const link = svg.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
      .attr("stroke-width", (d: number) => Math.sqrt(d.valueOf()));
  
  const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
      .attr("r", (d: Node) => radius(d.radius))
      .attr("fill", (d: Link) => color(d.group));
  
  node.append("title")
      .text(d => d.id);
  
  // Add a drag behavior.
  node.call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));
    
  // Set the position attributes of links and nodes each time the simulation ticks.
  simulation.on("tick", () => {
    link
        .attr("x1", (d: Link) => d.source.x)
        .attr("y1", (d: Link) => d.source.y)
        .attr("x2", (d: Link) => d.target.x)
        .attr("y2", (d: Link) => d.target.y);
  
    node
        .attr("cx", (d: Node) => d.x)
        .attr("cy", (d: Node) => d.y);
  });
  
  // Reheat the simulation when drag starts, and fix the subject position.
  function dragstarted(event: any) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  
  // Update the subject (dragged node) position during drag.
  function dragged(event: any) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  
  // Restore the target alpha so the simulation cools after dragging ends.
  // Unfix the subject position now that it’s no longer being dragged.
  function dragended(event: any) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
  
  function radius(num: number) {
    return num * 2;
  }
  
  // When this cell is re-run, stop the previous simulation. (This doesn’t
  // really matter since the target alpha is zero and the simulation will
  // stop naturally, but it’s a good practice.)
  //invalidation.then(() => simulation.stop());
  
  return svg.node();

  return (
    <svg width={width} height={height}>
      <path fill="none" stroke="currentColor" strokeWidth="1.5" d={d3.line()(data) || ''} />
      <g fill="white" stroke="currentColor" strokeWidth="1.5">
        {data.map(((d: any, i: any) => (<circle key={i} /*cx={d3.forceX(i).x} cy={d3.forceY(d).y}*/ r={2.5} />)))}
      </g>
    </svg>
  );
}

export default ForceGraph;
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

const ForceGraph: React.FC<ForceGraphProps> = ({
  data,
  width = 640,
  height = 400,
  marginTop = 20,
  marginRight = 20,
  marginBottom = 50,
  marginLeft = 20
}) => {
  //const x = d3.scaleLinear().domain([0, data.length - 1]).range([marginLeft, width - marginRight]);
  //const y = d3.scaleLinear().domain(d3.extent(data) as [number, number]).range([height - marginBottom, marginTop]);
  //const line = d3.line<number>()
  //  .x((d, i) => x(i))
  //  .y(d => y(d));

  // The force simulation mutates links and nodes, so create a copy
  // so that re-evaluating this cell produces the same result.
  const links = data.links.map((d: any) => ({...d}));
  const nodes = data.nodes.map((d: any) => ({...d}));
  
  // Create a simulation with several forces.
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d: any) => d.id))
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
      .attr("stroke-width", (d: any) => Math.sqrt(d.value));
  
  const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
      .attr("r", (d: any) => radius(d.radius))
      //.attr("fill", (d: any) => color(d.group));
  
  node.append("title")
      .text((d: any) => d.id);
  
  // Add a drag behavior.
  /*node.call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));*/
    
  // Set the position attributes of links and nodes each time the simulation ticks.
  simulation.on("tick", () => {
    link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
  
    node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);
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
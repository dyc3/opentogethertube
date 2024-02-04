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

    // Create the SVG container.
    const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -height / 2, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      //.attr("r", (d: Node) => radius(2))
      //.attr("fill", d => color(d.group));

    function radius(num: number) {
      return num * 2;
    }

    return (
      <div>
        { svg.html() }
      </div>
  );
}

export default ForceGraph;
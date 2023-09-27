import React, { useRef, useEffect } from 'react';
import { ChartProps } from '../Chart';
import * as d3 from 'd3';

function getMetricCriticality(metric: number, thresholds: number[]) {
  for (let i = 0; i < thresholds.length; i++) {
    if (metric <= thresholds[i]) {
      return i;
    }
  }
  return thresholds.length;
}

function drawChordDiagram(
  data: Dependency[],
  svgRef,
  width = 600,
  height = width,
  innerRadius = Math.min(width, height) * 0.5 - 90,
  outerRadius = innerRadius + 10
): React.MutableRefObject<SVGSVGElement | null> {
  // Compute a dense matrix from the weighted links in data. The matrix represents the connections.
  const names = d3.sort(
    d3.union(
      data.map((d) => d.source),
      data.map((d) => d.target)
    )
  );
  const index: Map<string, number> = new Map(names.map((name, i) => [name, i]));
  const matrix = Array.from(index, () => new Array(names.length).fill(0));
  const value = 1; // Change this value in case it is given by the graph database
  for (const { source, target } of data) {
    const sourceIndex = index.get(source);
    const targetIndex = index.get(target);
    if (sourceIndex !== undefined && targetIndex !== undefined) {
      matrix[sourceIndex][targetIndex] += value;
    }
  }

  const chord = d3
    .chordDirected()
    .padAngle(10 / innerRadius)
    .sortSubgroups(d3.descending)
    .sortChords(d3.descending);

  const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);

  const ribbon = d3
    .ribbonArrow()
    .radius(innerRadius - 1)
    .padAngle(1 / innerRadius);

  const colors = d3.quantize(d3.interpolateRainbow, names.length);

  const svg = d3.select(svgRef.current);
  svg
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [-width / 2, -height / 2, width, height])
    .attr('style', 'width: 100%; height: 100%; font: 6px sans-serif;');

  const chords = chord(matrix);

  const group = svg.append('g').selectAll().data(chords.groups).join('g');

  group
    .append('path')
    .attr('fill', (d) => colors[d.index])
    .attr('d', arc);

  group
    .append('text')
    .each((d) => (d.angle = (d.startAngle + d.endAngle) / 2))
    .attr('dy', '0.35em')
    .attr(
      'transform',
      (d) => `
        rotate(${(d.angle * 180) / Math.PI - 90})
        translate(${outerRadius + 5})
        ${d.angle > Math.PI ? 'rotate(180)' : ''}
      `
    )
    .attr('text-anchor', (d) => (d.angle > Math.PI ? 'end' : null))
    .text((d) => names[d.index]);

  group.append('title').text(
    (d) => `${names[d.index]}
  ${d3.sum(chords, (c) => (c.source.index === d.index ? c.source.value : 0))} outgoing →
  ${d3.sum(chords, (c) => (c.target.index === d.index ? c.source.value : 0))} incoming ←`
  );

  svg
    .append('g')
    .attr('fill-opacity', 0.75)
    .selectAll()
    .data(chords)
    .join('path')
    .style('mix-blend-mode', 'multiply')
    .attr('fill', (d) => colors[d.target.index])
    .attr('d', ribbon)
    .append('title')
    .text((d) => `${names[d.source.index]} → ${names[d.target.index]} ${d.source.value}`);

  return svgRef;
}

interface Dependency {
  source: string;
  target: string;
}

const ChordDiagram = (props: ChartProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  if (props.records == null || props.records.length == 0 || props.records[0].keys == null) {
    return <>No data, re-run the report.</>;
  }
  const records = props.records;

  // Retrieve names of the services and sources/targets of the relationships
  let dependencies: Dependency[] = [];
  for (const record of records) {
    try {
      let dependency: Dependency = {
        source: record['_fields'][0].properties.name,
        target: record['_fields'][2].properties.name,
      };
      dependencies.push(dependency);
    } catch (e) {}
  }

  useEffect(() => {
    drawChordDiagram(dependencies, svgRef);
  }, []);

  return <svg ref={svgRef}></svg>;
};

export default ChordDiagram;

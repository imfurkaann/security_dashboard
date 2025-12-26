import { useEffect, useRef } from 'react';
import cloud from 'd3-cloud';
import * as d3 from 'd3';

interface WordData {
    text: string;
    value: number;
}

interface WordCloudProps {
    data: WordData[];
    width?: number;
    height?: number;
}

const WordCloud = ({ data, width = 600, height = 400 }: WordCloudProps) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!data || data.length === 0 || !svgRef.current) return;

        // Clear previous content
        d3.select(svgRef.current).selectAll('*').remove();

        const maxValue = Math.max(...data.map(d => d.value));
        const minValue = Math.min(...data.map(d => d.value));

        const layout = cloud()
            .size([width, height])
            .words(data.map(d => ({
                text: d.text,
                size: 10 + (d.value - minValue) / (maxValue - minValue) * 60
            })))
            .padding(5)
            .rotate(() => (~~(Math.random() * 2) * 90))
            .font('Impact')
            .fontSize((d: any) => d.size)
            .on('end', draw);

        layout.start();

        function draw(words: any[]) {
            const svg = d3.select(svgRef.current);
            const g = svg
                .append('g')
                .attr('transform', `translate(${width / 2},${height / 2})`);

            const color = d3.scaleOrdinal(d3.schemeCategory10);

            g.selectAll('text')
                .data(words)
                .enter()
                .append('text')
                .style('font-size', (d: any) => `${d.size}px`)
                .style('font-family', 'Impact')
                .style('fill', (_: any, i: number) => color(i.toString()))
                .attr('text-anchor', 'middle')
                .attr('transform', (d: any) => `translate(${d.x},${d.y})rotate(${d.rotate})`)
                .text((d: any) => d.text);
        }
    }, [data, width, height]);

    return <svg ref={svgRef} width={width} height={height} />;
};

export default WordCloud;

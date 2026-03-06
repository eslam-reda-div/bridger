/**
 * Bridger Jest Tests — NetworkX (Graph Algorithms)
 *
 * Tests: graph creation, add edges/nodes, shortest path, BFS/DFS,
 * clustering, PageRank, connected components, betweenness
 */
'use strict';

const {
    bridge,
    shutdown,
    approxEq
} = require('./helpers');

afterAll(() => shutdown());

let nx;
beforeAll(async () => {
    nx = await bridge('python:networkx');
});

describe('NetworkX — Graph Creation', () => {
    test('create Graph', async () => {
        const G = await nx.Graph();
        const t = await G.$type();
        expect(t.type).toBe('Graph');
    });

    test('create DiGraph', async () => {
        const G = await nx.DiGraph();
        const t = await G.$type();
        expect(t.type).toBe('DiGraph');
    });

    test('add nodes and edges', async () => {
        const G = await nx.Graph();
        await G.add_nodes_from([1, 2, 3, 4, 5]);
        await G.add_edges_from([
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5]
        ]);
        const numNodes = await G.number_of_nodes();
        const numEdges = await G.number_of_edges();
        expect(numNodes).toBe(5);
        expect(numEdges).toBe(4);
    });
});

describe('NetworkX — Path Algorithms', () => {
    let G;
    beforeAll(async () => {
        G = await nx.Graph();
        await G.add_edges_from([
            [1, 2],
            [2, 3],
            [3, 4],
            [1, 4],
            [4, 5]
        ]);
    });

    test('shortest_path', async () => {
        const path = await nx.shortest_path(G, 1, 5);
        expect(path).toContain(1);
        expect(path).toContain(5);
        expect(path.length).toBeLessThanOrEqual(4);
    });

    test('shortest_path_length', async () => {
        const length = await nx.shortest_path_length(G, 1, 5);
        expect(length).toBe(2); // 1→4→5
    });

    test('has_path', async () => {
        const has = await nx.has_path(G, 1, 5);
        expect(has).toBe(true);
    });
});

describe('NetworkX — Connectivity', () => {
    test('is_connected', async () => {
        const G = await nx.Graph();
        await G.add_edges_from([
            [1, 2],
            [2, 3]
        ]);
        const conn = await nx.is_connected(G);
        expect(conn).toBe(true);
    });

    test('number_connected_components', async () => {
        const G = await nx.Graph();
        await G.add_edges_from([
            [1, 2],
            [3, 4]
        ]);
        const n = await nx.number_connected_components(G);
        expect(n).toBe(2);
    });
});

describe('NetworkX — Centrality', () => {
    test('degree_centrality', async () => {
        const G = await nx.star_graph(4);
        const dc = await nx.degree_centrality(G);
        // Center node (0) in star graph has highest centrality
        expect(dc['0']).toBe(1.0);
    });

    test('pagerank', async () => {
        const G = await nx.DiGraph();
        await G.add_edges_from([
            [1, 2],
            [2, 3],
            [3, 1],
            [3, 2]
        ]);
        const pr = await nx.pagerank(G);
        expect(typeof pr).toBe('object');
        // All nodes should have positive page rank
        for (const v of Object.values(pr)) {
            expect(v).toBeGreaterThan(0);
        }
    });
});

describe('NetworkX — Generators', () => {
    test('complete_graph', async () => {
        const K5 = await nx.complete_graph(5);
        expect(await K5.number_of_nodes()).toBe(5);
        expect(await K5.number_of_edges()).toBe(10); // C(5,2) = 10
    });

    test('cycle_graph', async () => {
        const C = await nx.cycle_graph(6);
        expect(await C.number_of_nodes()).toBe(6);
        expect(await C.number_of_edges()).toBe(6);
    });

    test('path_graph', async () => {
        const P = await nx.path_graph(5);
        expect(await P.number_of_nodes()).toBe(5);
        expect(await P.number_of_edges()).toBe(4);
    });
});

describe('NetworkX — Algorithms', () => {
    test('clustering coefficient', async () => {
        const G = await nx.complete_graph(4);
        const avg = await nx.average_clustering(G);
        approxEq(avg, 1.0); // complete graph → clustering = 1
    });

    test('diameter', async () => {
        const G = await nx.path_graph(5);
        const d = await nx.diameter(G);
        expect(d).toBe(4);
    });

    test('density', async () => {
        const G = await nx.complete_graph(5);
        const d = await nx.density(G);
        approxEq(d, 1.0);
    });
});
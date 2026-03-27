#!/usr/bin/env node
import { createBridgeMcpServer } from './server.js';

const server = createBridgeMcpServer();

/** Many editors spawn MCP over stdio; agents testing manually often want HTTP Stream. */
const useStdio =
    process.env.MCP_TRANSPORT === 'stdio' ||
    process.env.FASTMCP_TRANSPORT === 'stdio' ||
    process.argv.includes('--stdio');

if (useStdio) {
    await server.start({ transportType: 'stdio' });
} else {
    const port = Number(process.env.MCP_PORT ?? process.env.FASTMCP_PORT ?? '3847');
    const host = process.env.MCP_HOST ?? process.env.FASTMCP_HOST ?? '127.0.0.1';
    const endpointRaw = process.env.MCP_ENDPOINT ?? process.env.FASTMCP_ENDPOINT ?? '/mcp';
    if (!endpointRaw.startsWith('/')) {
        throw new Error(`MCP endpoint must start with /, got: ${endpointRaw}`);
    }
    const endpoint = endpointRaw as `/${string}`;

    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
        throw new Error(`Invalid MCP port: ${process.env.MCP_PORT ?? process.env.FASTMCP_PORT}`);
    }

    await server.start({
        transportType: 'httpStream',
        httpStream: {
            port,
            host,
            endpoint,
        },
    });

    // FastMCP also logs via its logger; this line is explicit for agents and scripts.
    console.log(
        `[overcast-bridge-tx-mcp] MCP HTTP Stream — connect clients to http://${host}:${port}${endpoint}`,
    );
}

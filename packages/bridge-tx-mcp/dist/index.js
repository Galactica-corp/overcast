#!/usr/bin/env node
import { createBridgeMcpServer } from './server.js';
const server = createBridgeMcpServer();
await server.start({ transportType: 'stdio' });

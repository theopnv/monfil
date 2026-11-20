import { Generator, getConfig } from '@tanstack/router-generator';
import { ROUTER_OPTIONS } from './router-options.mts';

// The router plugin writes routeTree.gen.ts only as a side effect of a Vite build, but tsc and the coverage run need it first.
const root = process.cwd();
await new Generator({ config: getConfig(ROUTER_OPTIONS, root), root }).run();

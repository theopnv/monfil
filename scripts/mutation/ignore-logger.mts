import { declareValuePlugin, PluginKind } from '@stryker-mutator/api/plugin';

/** The parts of a Babel node that the check reads. Stryker types the path as an empty interface. */
interface Node {
  type: string;
  expression?: Node;
  callee?: Node;
  object?: Node;
  name?: string;
}

/** True for a statement such as `logger.warn(...)`, whose result the code never reads. */
export function isLoggerCall(node: Node): boolean {
  const call = node.type === 'ExpressionStatement' ? node.expression : undefined;
  const callee = call?.type === 'CallExpression' ? call.callee : undefined;
  const target = callee?.type === 'MemberExpression' ? callee.object : undefined;
  return target?.type === 'Identifier' && target.name === 'logger';
}

export const strykerPlugins = [
  declareValuePlugin(PluginKind.Ignore, 'logger', {
    shouldIgnore(path) {
      return isLoggerCall((path as { node: Node }).node) ? 'A logger call only writes diagnostics.' : undefined;
    },
  }),
];

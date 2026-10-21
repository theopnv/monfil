import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/typescript-estree';

export type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

export interface NamedFunction {
  node: FunctionNode;
  qualifiedName: string;
  /** Start of the function, or of its key when it is a method or property value. */
  start: TSESTree.Position;
  end: TSESTree.Position;
}

interface Scope {
  path: string;
  counts: Map<string, number>;
}

type Namer = (parent: TSESTree.Node, child: TSESTree.Node, ancestors: TSESTree.Node[]) => string | null;

const SEPARATOR = ' > ';
const ANONYMOUS = '<anonymous>';
const SKIPPED_KEYS = new Set(['parent', 'loc', 'range', 'tokens', 'comments']);
const TYPE_WRAPPERS = new Set<string>([
  AST_NODE_TYPES.TSAsExpression,
  AST_NODE_TYPES.TSSatisfiesExpression,
  AST_NODE_TYPES.TSNonNullExpression,
  AST_NODE_TYPES.TSTypeAssertion,
]);
const NAME_WRAPPERS = new Set<string>([
  ...TYPE_WRAPPERS,
  AST_NODE_TYPES.LogicalExpression,
  AST_NODE_TYPES.ConditionalExpression,
]);
const KEYED_PARENTS = new Set<string>([
  AST_NODE_TYPES.MethodDefinition,
  AST_NODE_TYPES.TSAbstractMethodDefinition,
  AST_NODE_TYPES.Property,
  AST_NODE_TYPES.PropertyDefinition,
]);

export function isFunctionNode(node: TSESTree.Node | null | undefined): node is FunctionNode {
  return node?.type === AST_NODE_TYPES.FunctionDeclaration
    || node?.type === AST_NODE_TYPES.FunctionExpression
    || node?.type === AST_NODE_TYPES.ArrowFunctionExpression;
}

function isNode(value: unknown): value is TSESTree.Node {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

function childNodes(node: TSESTree.Node): TSESTree.Node[] {
  const children: TSESTree.Node[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_KEYS.has(key)) {
      continue;
    }
    const values: unknown[] = Array.isArray(value) ? value : [value];
    children.push(...values.filter(isNode));
  }
  return children.sort((a, b) => a.range[0] - b.range[0]);
}

function unwrapTypes(node: TSESTree.Node | null | undefined): TSESTree.Node | null | undefined {
  let current = node;
  while (current && TYPE_WRAPPERS.has(current.type)) {
    current = (current as TSESTree.TSAsExpression).expression;
  }
  return current;
}

function keyName(key: TSESTree.Node, computed: boolean): string {
  if (key.type === AST_NODE_TYPES.Literal) {
    return String(key.value);
  }
  if (computed) {
    return '[computed]';
  }
  if (key.type === AST_NODE_TYPES.Identifier) {
    return key.name;
  }
  if (key.type === AST_NODE_TYPES.PrivateIdentifier) {
    return `#${key.name}`;
  }
  return '[computed]';
}

function accessorName(kind: string, name: string): string {
  return kind === 'get' || kind === 'set' ? `${kind} ${name}` : name;
}

function memberName(node: TSESTree.Node): string {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }
  if (node.type === AST_NODE_TYPES.MemberExpression) {
    return keyName(node.property, node.computed);
  }
  return ANONYMOUS;
}

function calleeName(callee: TSESTree.Node): string {
  const node = unwrapTypes(callee);
  if (!node) {
    return ANONYMOUS;
  }
  if (node.type === AST_NODE_TYPES.CallExpression) {
    return calleeName(node.callee);
  }
  if (node.type === AST_NODE_TYPES.Super) {
    return 'super';
  }
  return memberName(node);
}

function jsxName(name: TSESTree.JSXTagNameExpression | TSESTree.JSXAttribute['name']): string {
  if (name.type === AST_NODE_TYPES.JSXIdentifier) {
    return name.name;
  }
  if (name.type === AST_NODE_TYPES.JSXNamespacedName) {
    return `${name.namespace.name}:${name.name.name}`;
  }
  return name.property.name;
}

const NAMERS: Partial<Record<AST_NODE_TYPES, Namer>> = {
  [AST_NODE_TYPES.VariableDeclarator]: (parent) => {
    const { id } = parent as TSESTree.VariableDeclarator;
    return id.type === AST_NODE_TYPES.Identifier ? id.name : null;
  },
  [AST_NODE_TYPES.MethodDefinition]: (parent) => {
    const method = parent as TSESTree.MethodDefinition;
    return accessorName(method.kind, keyName(method.key, method.computed));
  },
  [AST_NODE_TYPES.TSAbstractMethodDefinition]: (parent) => {
    const method = parent as TSESTree.TSAbstractMethodDefinition;
    return accessorName(method.kind, keyName(method.key, method.computed));
  },
  [AST_NODE_TYPES.Property]: (parent) => {
    const property = parent as TSESTree.Property;
    return accessorName(property.kind, keyName(property.key, property.computed));
  },
  [AST_NODE_TYPES.PropertyDefinition]: (parent) => {
    const property = parent as TSESTree.PropertyDefinition;
    return keyName(property.key, property.computed);
  },
  [AST_NODE_TYPES.AssignmentExpression]: (parent) => memberName((parent as TSESTree.AssignmentExpression).left),
  [AST_NODE_TYPES.AssignmentPattern]: (parent) => memberName((parent as TSESTree.AssignmentPattern).left),
  [AST_NODE_TYPES.CallExpression]: (parent, child) => {
    const { callee } = parent as TSESTree.CallExpression;
    return callee === child ? '<iife>' : calleeName(callee);
  },
  [AST_NODE_TYPES.NewExpression]: (parent) => calleeName((parent as TSESTree.NewExpression).callee),
  [AST_NODE_TYPES.ExportDefaultDeclaration]: () => 'default',
  [AST_NODE_TYPES.ReturnStatement]: () => 'return',
  [AST_NODE_TYPES.ArrowFunctionExpression]: (parent, child) =>
    (parent as TSESTree.ArrowFunctionExpression).body === child ? 'return' : null,
  [AST_NODE_TYPES.JSXExpressionContainer]: (_parent, _child, ancestors) => {
    const owner = ancestors.at(-1);
    if (owner?.type === AST_NODE_TYPES.JSXAttribute) {
      return jsxName(owner.name);
    }
    if (owner?.type === AST_NODE_TYPES.JSXElement) {
      return jsxName(owner.openingElement.name);
    }
    return null;
  },
};

/** Finds the first ancestor above any wrapper expressions, and the node right below it. */
function namingParent(node: TSESTree.Node, ancestors: TSESTree.Node[]) {
  let child = node;
  let index = ancestors.length - 1;
  let parent = ancestors[index];
  while (parent && NAME_WRAPPERS.has(parent.type)) {
    child = parent;
    index -= 1;
    parent = ancestors[index];
  }
  return { parent, child, rest: ancestors.slice(0, Math.max(index, 0)) };
}

function functionName(node: FunctionNode, ancestors: TSESTree.Node[]): string {
  if (node.id) {
    return node.id.name;
  }
  const { parent, child, rest } = namingParent(node, ancestors);
  const namer = parent && NAMERS[parent.type];
  return (namer && namer(parent, child, rest)) ?? ANONYMOUS;
}

/** Names the containers that do not hold a function directly, so `const a = items.map(() => …)` gives `a > map`. */
function containerName(node: TSESTree.Node): string | null {
  switch (node.type) {
    case AST_NODE_TYPES.ClassDeclaration:
    case AST_NODE_TYPES.ClassExpression:
      return node.id?.name ?? null;
    case AST_NODE_TYPES.VariableDeclarator:
      return node.id.type === AST_NODE_TYPES.Identifier && !isFunctionNode(unwrapTypes(node.init)) ? node.id.name : null;
    case AST_NODE_TYPES.Property:
    case AST_NODE_TYPES.PropertyDefinition:
      return isFunctionNode(unwrapTypes(node.value)) ? null : keyName(node.key, node.computed);
    default:
      return null;
  }
}

function enterScope(scope: Scope, segment: string): Scope {
  const count = (scope.counts.get(segment) ?? 0) + 1;
  scope.counts.set(segment, count);
  const unique = count === 1 ? segment : `${segment}#${count}`;
  return { path: scope.path ? `${scope.path}${SEPARATOR}${unique}` : unique, counts: new Map() };
}

function functionStart(node: FunctionNode, ancestors: TSESTree.Node[]): TSESTree.Position {
  const parent = ancestors.at(-1);
  return parent && KEYED_PARENTS.has(parent.type) ? parent.loc.start : node.loc.start;
}

/**
 * Lists every function in a program with a qualified name such as `River > useEffect#2`.
 * The first function at a path has no suffix, so a new sibling does not rename the old ones.
 */
export function nameFunctions(program: TSESTree.Program): NamedFunction[] {
  const functions: NamedFunction[] = [];
  const visit = (node: TSESTree.Node, ancestors: TSESTree.Node[], scope: Scope) => {
    const isFunction = isFunctionNode(node);
    const segment = isFunction ? functionName(node, ancestors) : containerName(node);
    const inner = segment === null ? scope : enterScope(scope, segment);
    if (isFunction) {
      functions.push({ node, qualifiedName: inner.path, start: functionStart(node, ancestors), end: node.loc.end });
    }
    const nextAncestors = [...ancestors, node];
    for (const child of childNodes(node)) {
      visit(child, nextAncestors, inner);
    }
  };
  visit(program, [], { path: '', counts: new Map() });
  return functions;
}

function isBefore(a: TSESTree.Position, b: TSESTree.Position): boolean {
  return a.line < b.line || (a.line === b.line && a.column < b.column);
}

/** Finds the innermost function that contains a position. `column` is 0-based, as in the AST. */
export function findFunctionAt(functions: NamedFunction[], position: TSESTree.Position): NamedFunction | undefined {
  let best: NamedFunction | undefined;
  for (const candidate of functions) {
    const contains = !isBefore(position, candidate.start) && isBefore(position, candidate.end);
    if (contains && (!best || isBefore(best.start, candidate.start))) {
      best = candidate;
    }
  }
  return best;
}

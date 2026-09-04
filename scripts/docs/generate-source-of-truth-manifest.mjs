#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT = path.join(ROOT, "docs", "source-of-truth-manifest.json");
const APP_PATH = path.join(ROOT, "src", "App.tsx");
const TYPES_PATH = path.join(ROOT, "src", "integrations", "supabase", "types.ts");
const ROBOTS_PATH = path.join(ROOT, "public", "robots.txt");
const SITEMAP_PATH = path.join(ROOT, "public", "sitemap.xml");

const toPosix = (value) => value.split(path.sep).join("/");
const relativePath = (value) => toPosix(path.relative(ROOT, value));
const unique = (values) => [...new Set(values.filter(Boolean))].sort();

function walkFiles(directory, extensions) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute, extensions));
    else if (extensions.includes(path.extname(entry.name))) files.push(absolute);
  }
  return files.sort();
}

function readSource(file) {
  const text = fs.readFileSync(file, "utf8");
  const scriptKind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return {
    text,
    sourceFile: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind),
  };
}

function nodeText(node, sourceFile) {
  return node ? node.getText(sourceFile).replace(/\s+/g, " ").trim() : "";
}

function literalText(node, sourceFile) {
  if (!node) return null;
  if (ts.isLiteralTypeNode(node)) return literalText(node.literal, sourceFile);
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isNumericLiteral(node)
  ) {
    return node.text;
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return nodeText(node, sourceFile);
}

function propertyName(node, sourceFile) {
  if (!node?.name) return null;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name)) {
    return node.name.text;
  }
  return nodeText(node.name, sourceFile);
}

function typeFields(typeNode, sourceFile) {
  if (!typeNode || !ts.isTypeLiteralNode(typeNode)) return [];
  return typeNode.members
    .filter(ts.isPropertySignature)
    .map((member) => ({
      name: propertyName(member, sourceFile),
      type: nodeText(member.type, sourceFile) || "unknown",
      optional: Boolean(member.questionToken),
    }))
    .filter((field) => field.name);
}

function collectDependencies(text) {
  const tables = unique(
    [...text.matchAll(/\.from(?:<[^>]+>)?\(\s*["'`]([a-zA-Z0-9_]+)["'`]\s*\)/g)].map(
      (match) => match[1],
    ),
  );
  const rpcs = unique(
    [...text.matchAll(/\.rpc(?:<[^>]+>)?\(\s*["'`]([a-zA-Z0-9_]+)["'`]/g)].map(
      (match) => match[1],
    ),
  );
  const edgeFunctions = unique(
    [...text.matchAll(/\.functions\.invoke(?:<[^>]+>)?\(\s*["'`]([^"'`]+)["'`]/g)].map(
      (match) => match[1],
    ),
  );
  const fetchTargets = unique(
    [...text.matchAll(/fetch\(\s*(["'`])([^"'`]+)\1/g)].map((match) => match[2]),
  );
  return { tables, rpcs, edgeFunctions, fetchTargets };
}

function collectBrowserStorage(text, file) {
  const records = [];
  const regex = /\b(localStorage|sessionStorage)\.(getItem|setItem|removeItem)\(\s*([^,\)]+)/g;
  for (const match of text.matchAll(regex)) {
    const rawKey = match[3].trim();
    const quoted = rawKey.match(/^(["'`])([\s\S]*?)\1$/);
    records.push({
      storage: match[1],
      operation: match[2],
      key: quoted ? quoted[2] : rawKey.replace(/\s+/g, " "),
      file,
    });
  }
  return records;
}

function collectNamedCalls(sourceFile) {
  const hooks = [];
  const state = [];
  const actions = [];
  const navigateTargets = [];

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && /^use[A-Z0-9]/.test(expression.text)) {
        hooks.push(expression.text);
      }
      if (ts.isIdentifier(expression) && expression.text === "useState") {
        const declaration = node.parent;
        if (
          ts.isVariableDeclaration(declaration) &&
          ts.isArrayBindingPattern(declaration.name)
        ) {
          state.push({
            value: declaration.name.elements[0]?.name?.getText(sourceFile) || "unknown",
            setter: declaration.name.elements[1]?.name?.getText(sourceFile) || null,
            initial: node.arguments[0] ? nodeText(node.arguments[0], sourceFile) : "undefined",
          });
        }
      }
      if (
        ts.isIdentifier(expression) &&
        expression.text === "navigate" &&
        node.arguments[0] &&
        (ts.isStringLiteral(node.arguments[0]) ||
          ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
      ) {
        navigateTargets.push(node.arguments[0].text);
      }
    }

    if (ts.isFunctionDeclaration(node) && node.name && /^(handle|on)[A-Z]/.test(node.name.text)) {
      actions.push(node.name.text);
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      /^(handle|on)[A-Z]/.test(node.name.text) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      actions.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return {
    hooks: unique(hooks),
    state,
    actions: unique(actions),
    navigateTargets: unique(navigateTargets),
  };
}

function collectVisibleText(sourceFile) {
  const values = [];
  function visit(node) {
    if (ts.isJsxText(node)) {
      const value = node.getText(sourceFile).replace(/\s+/g, " ").trim();
      if (value.length >= 3) values.push(value);
    }
    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      ["aria-label", "title", "placeholder", "alt"].includes(node.name.text)
    ) {
      const value = node.initializer.text.trim();
      if (value.length >= 3) values.push(value);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return unique(values).slice(0, 20);
}

function collectProps(sourceFile) {
  const schemas = [];
  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement) && /Props$/.test(statement.name.text)) {
      schemas.push({
        name: statement.name.text,
        fields: statement.members
          .filter(ts.isPropertySignature)
          .map((member) => ({
            name: propertyName(member, sourceFile),
            type: nodeText(member.type, sourceFile) || "unknown",
            optional: Boolean(member.questionToken),
          }))
          .filter((field) => field.name),
      });
    }
    if (
      ts.isTypeAliasDeclaration(statement) &&
      /Props$/.test(statement.name.text) &&
      ts.isTypeLiteralNode(statement.type)
    ) {
      schemas.push({ name: statement.name.text, fields: typeFields(statement.type, sourceFile) });
    }
  }
  return schemas;
}

function humanizeIdentifier(value) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function domainFromPath(rel) {
  const parts = rel.split("/");
  if (parts[1] === "components") return parts.length > 3 ? parts[2] : "shared";
  if (parts[1] === "pages") return parts.length > 3 ? parts[2] : "page";
  if (parts[1] === "hooks") return parts.length > 3 ? parts[2] : "state";
  return parts[1] || "application";
}

function collectExports(sourceFile) {
  const names = [];
  for (const statement of sourceFile.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) || [] : [];
    const exported = modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

    if (exported && ts.isFunctionDeclaration(statement) && statement.name) {
      names.push(statement.name.text);
    }
    if (exported && ts.isClassDeclaration(statement) && statement.name) {
      names.push(statement.name.text);
    }
    if (exported && ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
      }
    }
    if (ts.isExportAssignment(statement)) {
      names.push(nodeText(statement.expression, sourceFile));
    }
  }
  return unique(names);
}

function analyzeTsFile(file) {
  const rel = relativePath(file);
  const { text, sourceFile } = readSource(file);
  const calls = collectNamedCalls(sourceFile);
  const exports = collectExports(sourceFile);
  const domain = domainFromPath(rel);
  const primaryName =
    exports.find((name) => /^[A-Z]/.test(name)) || path.basename(file, path.extname(file));
  return {
    path: rel,
    domain,
    purpose: `Implements ${humanizeIdentifier(primaryName)} behavior in the ${humanizeIdentifier(domain)} domain.`,
    exports,
    props: collectProps(sourceFile),
    state: calls.state,
    hooks: calls.hooks,
    actions: calls.actions,
    navigateTargets: calls.navigateTargets,
    dataDependencies: collectDependencies(text),
    storage: collectBrowserStorage(text, rel),
    userFacingText: file.endsWith(".tsx") ? collectVisibleText(sourceFile) : [],
    userFacingBehavior: {
      actionHandlers: calls.actions,
      navigationTargets: calls.navigateTargets,
    },
  };
}

function resolveImportPath(specifier) {
  const candidates = [
    path.resolve(path.dirname(APP_PATH), specifier),
    path.resolve(path.dirname(APP_PATH), `${specifier}.tsx`),
    path.resolve(path.dirname(APP_PATH), `${specifier}.ts`),
    path.resolve(path.dirname(APP_PATH), specifier, "index.tsx"),
    path.resolve(path.dirname(APP_PATH), specifier, "index.ts"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function routeRegex(routePath) {
  const escaped = routePath
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/:([a-zA-Z0-9_]+)/g, "[^/]+");
  return new RegExp(`^${escaped}$`);
}

function classifyRoute(routePath, element) {
  if (element === "Navigate") return "redirect";
  if (routePath === "*") return "fallback";
  if (routePath.startsWith("/admin") || routePath === "/status") return "admin";
  if (
    routePath.startsWith("/dashboard") ||
    routePath.startsWith("/profile") ||
    routePath.startsWith("/student/") ||
    routePath === "/worksheets" ||
    routePath === "/students" ||
    routePath.startsWith("/worksheet/") ||
    routePath.startsWith("/calendar") ||
    routePath.startsWith("/teacher/")
  ) {
    return "authenticated-teacher";
  }
  if (
    routePath.startsWith("/my") ||
    routePath.startsWith("/homework/") ||
    routePath.startsWith("/flashcards/") ||
    routePath.startsWith("/shared/") ||
    routePath.startsWith("/test/") ||
    routePath.startsWith("/welcome-test/") ||
    routePath.startsWith("/book/") ||
    routePath === "/gcal-student-callback"
  ) {
    return "student-facing-token-or-session";
  }
  if (
    routePath.startsWith("/features/") ||
    routePath.startsWith("/tools") ||
    routePath.startsWith("/gallery") ||
    routePath.startsWith("/esl-worksheets") ||
    routePath.startsWith("/worksheets/") ||
    routePath.startsWith("/english-for/") ||
    routePath.startsWith("/blog") ||
    [
      "/",
      "/pricing",
      "/about",
      "/prompts",
      "/glossary",
      "/exercise-types",
      "/how-it-works",
      "/one-minute-prep",
      "/resources",
      "/for-english-tutors",
    ].includes(routePath)
  ) {
    return "public-seo-or-product";
  }
  return "public-functional-or-auth";
}

function parseRoutes() {
  const text = fs.readFileSync(APP_PATH, "utf8");
  const imports = new Map();
  for (const match of text.matchAll(/import\s+([A-Za-z0-9_]+)\s+from\s+["']([^"']+)["']/g)) {
    imports.set(match[1], match[2]);
  }
  for (const match of text.matchAll(
    /const\s+([A-Za-z0-9_]+)\s*=\s*lazy\(\(\)\s*=>\s*import\(["']([^"']+)["']\)\)/g,
  )) {
    imports.set(match[1], match[2]);
  }

  const sitemapXml = fs.readFileSync(SITEMAP_PATH, "utf8");
  const sitemapPaths = [...sitemapXml.matchAll(/<loc>https:\/\/edooqoo\.com([^<]*)<\/loc>/g)].map(
    (match) => match[1] || "/",
  );
  const robots = fs.readFileSync(ROBOTS_PATH, "utf8");
  const disallowed = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((match) => match[1]);
  const allowed = [...robots.matchAll(/^Allow:\s*(\S+)/gm)].map((match) => match[1]);
  const routes = [];
  const routePattern =
    /<Route\s+path=["']([^"']+)["']\s+element=\{<([A-Za-z0-9_]+)([^>]*)\/>\}\s*\/>/g;

  for (const match of text.matchAll(routePattern)) {
    const routePath = match[1];
    const element = match[2];
    const attrs = match[3];
    const specifier = imports.get(element) || null;
    const source = specifier ? resolveImportPath(specifier) : null;
    const dynamicRegex = routePath.includes(":") ? routeRegex(routePath) : null;
    const sitemapMatches = routePath.includes(":")
      ? sitemapPaths.filter((item) => dynamicRegex.test(item)).length
      : sitemapPaths.includes(routePath)
        ? 1
        : 0;
    const staticPrefix = routePath.split("/:")[0].replace(/\/+$/, "") || "/";
    const explicitlyAllowed =
      routePath === "/worksheets/:exerciseType/:topic" &&
      allowed.includes("/worksheets/*/*");
    const robotsBlocked =
      !explicitlyAllowed &&
      disallowed.some((prefix) => {
        const normalized = prefix.replace(/\/+$/, "") || "/";
        return staticPrefix === normalized || staticPrefix.startsWith(`${normalized}/`);
      });
    const analysis = source ? analyzeTsFile(source) : null;
    const redirectMatch = attrs.match(/\bto=["']([^"']+)["']/);

    routes.push({
      path: routePath,
      element,
      source: source ? relativePath(source) : specifier,
      type: classifyRoute(routePath, element),
      redirectTo: element === "Navigate" ? redirectMatch?.[1] || null : null,
      crawl: {
        robotsBlocked,
        sitemapMatches,
        status:
          element === "Navigate"
            ? "redirect"
            : robotsBlocked
              ? "blocked-by-robots"
              : sitemapMatches > 0
                ? routePath.includes(":")
                  ? "indexable-generated-family"
                  : "indexable-sitemap"
                : "not-in-sitemap",
      },
      dataDependencies: analysis?.dataDependencies || {
        tables: [],
        rpcs: [],
        edgeFunctions: [],
        fetchTargets: [],
      },
      hooks: analysis?.hooks || [],
      userActions: analysis?.actions || [],
      navigateTargets: analysis?.navigateTargets || [],
    });
  }
  return routes;
}

function getTypeProperty(typeLiteral, name, sourceFile) {
  if (!typeLiteral || !ts.isTypeLiteralNode(typeLiteral)) return null;
  return (
    typeLiteral.members.find(
      (member) => ts.isPropertySignature(member) && propertyName(member, sourceFile) === name,
    )?.type || null
  );
}

function parseRelationships(typeNode, sourceFile) {
  if (!typeNode || !ts.isTupleTypeNode(typeNode)) return [];
  return typeNode.elements
    .filter(ts.isTypeLiteralNode)
    .map((element) => {
      const record = {};
      for (const member of element.members.filter(ts.isPropertySignature)) {
        const name = propertyName(member, sourceFile);
        if (!name) continue;
        if (member.type && ts.isTupleTypeNode(member.type)) {
          record[name] = member.type.elements.map((item) => literalText(item, sourceFile));
        } else {
          record[name] = literalText(member.type, sourceFile);
        }
      }
      return record;
    });
}

function parseDatabase(usageByTable) {
  const { sourceFile } = readSource(TYPES_PATH);
  const databaseAlias = sourceFile.statements.find(
    (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === "Database",
  );
  if (!databaseAlias || !ts.isTypeLiteralNode(databaseAlias.type)) {
    throw new Error("Database type alias not found in generated Supabase types.");
  }

  const publicType = getTypeProperty(databaseAlias.type, "public", sourceFile);
  const tablesType = getTypeProperty(publicType, "Tables", sourceFile);
  const functionsType = getTypeProperty(publicType, "Functions", sourceFile);
  const enumsType = getTypeProperty(publicType, "Enums", sourceFile);

  const tables = [];
  for (const member of tablesType?.members || []) {
    if (!ts.isPropertySignature(member) || !member.type || !ts.isTypeLiteralNode(member.type)) {
      continue;
    }
    const name = propertyName(member, sourceFile);
    const rowType = getTypeProperty(member.type, "Row", sourceFile);
    const relationshipsType = getTypeProperty(member.type, "Relationships", sourceFile);
    tables.push({
      name,
      fields: typeFields(rowType, sourceFile),
      relationships: parseRelationships(relationshipsType, sourceFile),
      featureOwnership: usageByTable.get(name) || { clientFiles: [], edgeFunctions: [] },
    });
  }

  const rpcs = [];
  for (const member of functionsType?.members || []) {
    if (!ts.isPropertySignature(member) || !member.type || !ts.isTypeLiteralNode(member.type)) {
      continue;
    }
    const argsType = getTypeProperty(member.type, "Args", sourceFile);
    const returnsType = getTypeProperty(member.type, "Returns", sourceFile);
    rpcs.push({
      name: propertyName(member, sourceFile),
      args: typeFields(argsType, sourceFile),
      returns: nodeText(returnsType, sourceFile),
    });
  }

  const enums = [];
  for (const member of enumsType?.members || []) {
    if (!ts.isPropertySignature(member)) continue;
    const values = member.type && ts.isUnionTypeNode(member.type)
      ? member.type.types.map((item) => literalText(item, sourceFile))
      : [literalText(member.type, sourceFile)];
    enums.push({ name: propertyName(member, sourceFile), values });
  }

  const migrationFiles = walkFiles(path.join(ROOT, "supabase", "migrations"), [".sql"]);
  const indexes = [];
  const sqlFunctions = [];
  for (const file of migrationFiles) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(
      /CREATE\s+(UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)/gi,
    )) {
      indexes.push({
        name: match[2],
        table: match[3],
        unique: Boolean(match[1]),
        migration: relativePath(file),
      });
    }
    for (const match of text.matchAll(
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi,
    )) {
      sqlFunctions.push({ name: match[1], migration: relativePath(file) });
    }
  }

  return {
    source: relativePath(TYPES_PATH),
    tables,
    rpcs,
    enums,
    indexes,
    migrationFunctions: unique(
      sqlFunctions.map((item) => `${item.name}|${item.migration}`),
    ).map((item) => {
      const [name, migration] = item.split("|");
      return { name, migration };
    }),
  };
}

function parseEdgeFunction(file) {
  const { text, sourceFile } = readSource(file);
  const requestFields = [];
  for (const match of text.matchAll(
    /(?:const|let)\s*\{([\s\S]*?)\}\s*=\s*await\s+(?:req|request)\.json\(\)/g,
  )) {
    requestFields.push(
      ...match[1]
        .split(",")
        .map((item) => item.trim().split(/[:=]/)[0]?.trim())
        .filter((item) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(item)),
    );
  }
  for (const match of text.matchAll(
    /(?:const|let)\s*\{([\s\S]*?)\}\s*=\s*(?:body|payload|data)\s*(?:\|\|\s*\{\})?\s*;/g,
  )) {
    requestFields.push(
      ...match[1]
        .split(",")
        .map((item) => item.trim().split(/[:=]/)[0]?.trim())
        .filter((item) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(item)),
    );
  }
  for (const match of text.matchAll(/\b(?:body|payload|data)\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g)) {
    requestFields.push(match[1]);
  }
  const methods = unique(
    [...text.matchAll(/(?:req|request)\.method\s*(?:===|!==)\s*["']([A-Z]+)["']/g)].map(
      (match) => match[1],
    ),
  );
  const env = unique(
    [...text.matchAll(/Deno\.env\.get\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1]),
  );
  const responseFields = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "stringify" &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "JSON" &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const property of node.arguments[0].properties) {
        const name = propertyName(property, sourceFile);
        if (name) responseFields.push(name);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return {
    name: path.basename(path.dirname(file)),
    path: relativePath(file),
    invocation: "POST via supabase.functions.invoke or direct /functions/v1 request unless method list says otherwise",
    methods: unique(["POST", ...methods]),
    requestFields: unique(requestFields),
    visibleResponseFields: unique(responseFields),
    dataDependencies: collectDependencies(text),
    environmentVariables: env,
  };
}

function buildUsageIndex(files) {
  const usage = new Map();
  for (const file of files) {
    const rel = relativePath(file);
    const text = fs.readFileSync(file, "utf8");
    const dependencies = collectDependencies(text);
    for (const table of dependencies.tables) {
      if (!usage.has(table)) usage.set(table, { clientFiles: [], edgeFunctions: [] });
      const record = usage.get(table);
      if (rel.startsWith("supabase/functions/")) {
        record.edgeFunctions.push(rel.split("/")[2]);
      } else {
        record.clientFiles.push(rel);
      }
    }
  }
  for (const record of usage.values()) {
    record.clientFiles = unique(record.clientFiles);
    record.edgeFunctions = unique(record.edgeFunctions);
  }
  return usage;
}

function collectApiInvocations(files) {
  const edgeInvocations = new Map();
  const rpcInvocations = new Map();
  for (const file of files) {
    const rel = relativePath(file);
    const { text, sourceFile } = readSource(file);
    const dependencies = collectDependencies(text);
    for (const name of dependencies.edgeFunctions) {
      if (!edgeInvocations.has(name)) {
        edgeInvocations.set(name, { callsites: [], payloadFields: [], payloadExpressions: [] });
      }
      edgeInvocations.get(name).callsites.push(rel);
    }
    for (const name of dependencies.rpcs) {
      if (!rpcInvocations.has(name)) {
        rpcInvocations.set(name, { callsites: [], payloadFields: [], payloadExpressions: [] });
      }
      rpcInvocations.get(name).callsites.push(rel);
    }

    function objectFields(node) {
      if (!node || !ts.isObjectLiteralExpression(node)) return [];
      return node.properties.map((property) => propertyName(property, sourceFile)).filter(Boolean);
    }

    function payloadFromOptions(node) {
      if (!node || !ts.isObjectLiteralExpression(node)) return { fields: [], expression: null };
      const body = node.properties.find(
        (property) => propertyName(property, sourceFile) === "body",
      );
      if (!body || !ts.isPropertyAssignment(body)) return { fields: [], expression: null };
      return ts.isObjectLiteralExpression(body.initializer)
        ? { fields: objectFields(body.initializer), expression: null }
        : { fields: [], expression: nodeText(body.initializer, sourceFile) };
    }

    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ["invoke", "rpc"].includes(node.expression.name.text) &&
        node.arguments[0] &&
        (ts.isStringLiteral(node.arguments[0]) ||
          ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
      ) {
        const name = node.arguments[0].text;
        const target =
          node.expression.name.text === "invoke"
            ? edgeInvocations.get(name)
            : rpcInvocations.get(name);
        if (target) {
          const payload =
            node.expression.name.text === "invoke"
              ? payloadFromOptions(node.arguments[1])
              : ts.isObjectLiteralExpression(node.arguments[1])
                ? { fields: objectFields(node.arguments[1]), expression: null }
                : {
                    fields: [],
                    expression: node.arguments[1] ? nodeText(node.arguments[1], sourceFile) : null,
                  };
          target.payloadFields.push(...payload.fields);
          if (payload.expression) target.payloadExpressions.push(payload.expression);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  return {
    edgeFunctionClientInvocations: [...edgeInvocations.entries()]
      .map(([name, record]) => ({
        name,
        callsites: unique(record.callsites),
        payloadFields: unique(record.payloadFields),
        payloadExpressions: unique(record.payloadExpressions),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    rpcClientInvocations: [...rpcInvocations.entries()]
      .map(([name, record]) => ({
        name,
        callsites: unique(record.callsites),
        payloadFields: unique(record.payloadFields),
        payloadExpressions: unique(record.payloadExpressions),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function collectState(allTsFiles) {
  const hookFiles = walkFiles(path.join(ROOT, "src", "hooks"), [".ts", ".tsx"]).map(analyzeTsFile);
  const contextFiles = walkFiles(path.join(ROOT, "src", "contexts"), [".ts", ".tsx"]).map(
    analyzeTsFile,
  );
  const storage = allTsFiles.flatMap((file) => {
    const rel = relativePath(file);
    return collectBrowserStorage(fs.readFileSync(file, "utf8"), rel);
  });
  const storageByKey = new Map();
  for (const item of storage) {
    const id = `${item.storage}:${item.key}`;
    if (!storageByKey.has(id)) {
      storageByKey.set(id, { storage: item.storage, key: item.key, operations: [], files: [] });
    }
    const record = storageByKey.get(id);
    record.operations.push(item.operation);
    record.files.push(item.file);
  }

  const realtime = [];
  for (const file of allTsFiles) {
    const text = fs.readFileSync(file, "utf8");
    if (!/\.channel\(/.test(text) && !/postgres_changes/.test(text)) continue;
    realtime.push({
      file: relativePath(file),
      channels: unique(
        [...text.matchAll(/\.channel\(\s*(["'`])([^"'`]+)\1/g)].map((match) => match[2]),
      ),
      tables: unique(
        [...text.matchAll(/table:\s*["']([a-zA-Z0-9_]+)["']/g)].map((match) => match[1]),
      ),
    });
  }

  return {
    hooks: hookFiles,
    contexts: contextFiles,
    browserStorage: [...storageByKey.values()]
      .map((record) => ({
        ...record,
        operations: unique(record.operations),
        files: unique(record.files),
      }))
      .sort((a, b) => `${a.storage}:${a.key}`.localeCompare(`${b.storage}:${b.key}`)),
    supabaseRealtime: realtime,
  };
}

function collectIntegrations(files) {
  const externalHosts = new Map();
  const environmentVariables = new Map();
  const urlRegex = /https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/[^\s"'`)<]*)?/g;

  for (const file of files) {
    const rel = relativePath(file);
    const text = fs.readFileSync(file, "utf8");
    for (const rawUrl of text.match(urlRegex) || []) {
      try {
        const url = new URL(rawUrl.replace(/[.,;]+$/, ""));
        if (
          ["edooqoo.com", "www.edooqoo.com", "localhost", "127.0.0.1"].includes(url.hostname)
        ) {
          continue;
        }
        if (!externalHosts.has(url.hostname)) externalHosts.set(url.hostname, []);
        externalHosts.get(url.hostname).push(rel);
      } catch {
        // Ignore partial URL-like strings in comments or regexes.
      }
    }
    for (const match of text.matchAll(
      /(?:Deno\.env\.get\(\s*["']([^"']+)["']\s*\)|import\.meta\.env\.([A-Z0-9_]+))/g,
    )) {
      const name = match[1] || match[2];
      if (!environmentVariables.has(name)) environmentVariables.set(name, []);
      environmentVariables.get(name).push(rel);
    }
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return {
    externalHosts: [...externalHosts.entries()]
      .map(([host, callsites]) => ({ host, callsites: unique(callsites) }))
      .sort((a, b) => a.host.localeCompare(b.host)),
    environmentVariables: [...environmentVariables.entries()]
      .map(([name, callsites]) => ({ name, callsites: unique(callsites) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    runtimeDependencies: packageJson.dependencies,
  };
}

function main() {
  const srcFiles = walkFiles(path.join(ROOT, "src"), [".ts", ".tsx"]);
  const edgeFiles = walkFiles(path.join(ROOT, "supabase", "functions"), [".ts"]).filter(
    (file) => path.basename(file) === "index.ts",
  );
  const allAuditedFiles = [...srcFiles, ...edgeFiles];
  const usageByTable = buildUsageIndex(allAuditedFiles);
  const routes = parseRoutes();
  const components = walkFiles(path.join(ROOT, "src", "components"), [".tsx"]).map(analyzeTsFile);
  const pages = walkFiles(path.join(ROOT, "src", "pages"), [".tsx"]).map((file) => {
    const analysis = analyzeTsFile(file);
    return {
      ...analysis,
      routes: routes.filter((route) => route.source === analysis.path).map((route) => route.path),
    };
  });
  const state = collectState(srcFiles);
  const edgeFunctions = edgeFiles.map(parseEdgeFunction);
  const apiInvocations = collectApiInvocations(srcFiles);
  const database = parseDatabase(usageByTable);
  const integrations = collectIntegrations(allAuditedFiles);
  const manifest = {
    schemaVersion: 1,
    sourceRef: "current synced checkout",
    generatedBy: relativePath(fileURLToPath(import.meta.url)),
    scope: {
      rule:
        "Code-verifiable production inventory. Protected worksheet-generation prompt wording and bodies are intentionally excluded.",
      componentRoot: "src/components",
      pageRoot: "src/pages",
      stateRoots: ["src/hooks", "src/contexts", "src/services"],
      apiRoot: "supabase/functions",
      databaseTypeSource: relativePath(TYPES_PATH),
    },
    counts: {
      routes: routes.length,
      pageModules: pages.length,
      componentModules: components.length,
      hookModules: state.hooks.length,
      contextModules: state.contexts.length,
      serviceModules: walkFiles(path.join(ROOT, "src", "services"), [".ts", ".tsx"]).length,
      edgeFunctions: edgeFunctions.length,
      typedTables: database.tables.length,
      typedRpcs: database.rpcs.length,
      migrationIndexes: database.indexes.length,
    },
    routes,
    pages,
    components,
    state,
    api: {
      edgeFunctions,
      ...apiInvocations,
    },
    database,
    integrations,
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[docs:audit-source] Wrote ${relativePath(OUTPUT)} from the current synced checkout.`);
  console.log(`[docs:audit-source] Counts: ${JSON.stringify(manifest.counts)}`);
}

main();

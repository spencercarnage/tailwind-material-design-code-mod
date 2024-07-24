import fs from "node:fs/promises";
import path from "node:path";
import * as url from "node:url";
import { parseArgs } from "node:util";
import parser from "@babel/parser";
import j from "jscodeshift";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const {
  values: { dir },
} = parseArgs({
  options: {
    dir: {
      type: "string",
    },
  },
});

const classNameAnalysis = {};
let text = "";

/**
 * Recursively analyze the `className`s props for all of files that end with
 * ".jsx" or ".tsx" in a directory. We want to see what kind of AST node types
 * make up our `className` props. `className="action"` is a `StringLiteral` and
 * `className={active ? 'active' : ''}` is a `ConditionalExpression`. Using
 * JSCodeShift, we want to see what AST node types are used to create our
 * `className` props. This will update the `classNameAnalysis` object to the following
 * format:
 *
 * {
 *   "ConditionalExpression": [ // AST node type
 *     "className={active ? 'active' : ''}
 *   ],
 *   "LogicalExpression": [
 *     "className={foo === 'foobar' && 'foo bar'}
 *   ]
 * }
 */
async function analyzeClassNames(sourcePath) {
  const stats = await fs.stat(sourcePath);
  const isSourcePathDir = stats.isDirectory();
  const files = isSourcePathDir ? await fs.readdir(sourcePath) : [sourcePath];

  for await (const fileName of files) {
    const filePath = isSourcePathDir
      ? path.join(sourcePath, fileName)
      : fileName;
    const stats = await fs.stat(filePath);

    const isDir = stats.isDirectory();

    if (isDir) {
      await analyzeClassNames(filePath);
    } else if (fileName.match(/(jsx|tsx)$/)) {
      const source = await fs.readFile(filePath, "utf8");

      /**
       * Use JSCodeShift to parse the file for the React component. Since we
       * are parsing files that can have either JSX or TypeScript, we need to
       * use the `@babel/parser` to help with parsing them.
       */
      const root = j(source, {
        parser: {
          parse: (code, options) =>
            parser.parse(code, {
              ...options,
              tokens: true,
              plugins: ["jsx", "typescript"],
            }),
        },
      });

      /**
       * Using `j.JSXAttribute`, we can target the `className` prop on all React
       * components, and get a collection of `NodePath`s that we can then
       * analyze.
       */
      // biome-ignore lint/complexity/noForEach: ignore ast.forEach
      root
        .find(j.JSXAttribute, {
          name: {
            name: "className",
          },
        })
        .forEach((path) => {
          const { type } = path.value.value;

          /**
           * `StringLiteral` is for `className="foo"`. We know those exist so we'll skip
           * them in our analysis.
           */
          if (type === "StringLiteral") {
            return;
          }

          /**
           * A `JSXExpressionContainer` is used to embed expressions within JSX
           * elements, like `className={isFoo ? 'foo' : 'bar baz'}`. This is
           * what we want to analyze.
           */
          if (type === "JSXExpressionContainer") {
            const expressionType = path.node.value.expression.type;

            if (!Array.isArray(classNameAnalysis[expressionType])) {
              classNameAnalysis[expressionType] = [];
            }

            const source = j(path.node).toSource();

            if (
              !classNameAnalysis[expressionType].find((item) => item === source)
            ) {
              classNameAnalysis[expressionType].push(source);
            }
          }
        });
    }
  }
}

await analyzeClassNames(dir);

/**
 * It can be helpful to see what the `className` prop looks like in the file
 * itself. We can use the contents of our `classNameAnalysis` analysis object to
 * create a `.txt` file that is more human-readable, like this:
 *
 * className={cx(
 *   className,
 *   'flex w-full flex-col rounded-lg border border-primary-main'
 * )}
 *
 * className={active ? 'active' : ''}
 *
 */
for (const className in classNameAnalysis) {
  const data = classNameAnalysis[className];

  if (Array.isArray(data)) {
    for (const item of data) {
      text += `\n\n${item}`;
    }
  } else {
    for (const key of data) {
      for (const item of data[key]) {
        text += `\n\n${item}`;
      }
    }
  }
}

await fs.writeFile(
  path.join(__dirname, "class-names-analysis.json"),
  JSON.stringify(classNameAnalysis, null, " "),
  "utf8",
);

await fs.writeFile(
  path.join(__dirname, "class-names-analysis.txt"),
  text,
  "utf8",
);

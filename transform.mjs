import classLookUp from "./tw-classes-map.json";

/**
 * Create a regular expression from all of the keys on the
 * look up object created to map the legacy classes with the
 * newer class names. Probably a more efficient way of doing
 * this. :)
 */
const classNamesRE = new RegExp(
  `\\b(?:${Object.keys(classLookUp).join("|")})\\b`,
  "g",
);

/**
 * Take a `value` from AST node path and check it for a legacy
 * class name. If there is a match, use the class look up to
 * swap the legacy class name with the updated class name.
 */
function matchClassName(value) {
  if (!value) {
    return false;
  }

  try {
    const matches = [];
    let newValue = value;

    // Use the regular expression to find matches
    let match;

    // biome-ignore lint/suspicious/noAssignInExpressions: ignore ast.forEach
    while ((match = classNamesRE.exec(value)) !== null) {
      matches.push(match[0]);
    }

    if (matches.length) {
      for (const match of matches) {
        newValue = value.replace(match, classLookUp[match]);
      }

      return newValue;
    }
  } catch (e) {
    console.log("error", e);
  }
}

/* Allow for parsing Typescript files. */
export const parser = "tsx";

export default (file, api) => {
  /**
   * Alias the JSCodeShift API
   */
  const j = api.jscodeshift;

  /**
   * Parse the code into an AST
   */
  const root = j(file.source);

  /**
   * Find all JSX attributes that are `className` and then iterate
   * over them.
   */
  // biome-ignore lint/complexity/noForEach: ignore ast.forEach
  root
    .find(j.JSXAttribute, {
      name: {
        name: "className",
      },
    })
    .forEach((path) => {
      const { value } = path.value;

      /* className="text-primary-main bg-primary-light" */
      if (value.type === "StringLiteral") {
        const newValue = matchClassName(value.value);

        if (newValue) {
          value.value = newValue;
        }
      }

      /* className={ ... } */
      if (value.type === "JSXExpressionContainer") {
        switch (value.expression.type) {
          /* className={fn( ... )} */
          case "CallExpression":
            for (const arg of value.expression.arguments) {
              if (arg.type === "StringLiteral") {
                const newValue = matchClassName(arg.value);

                if (newValue) {
                  arg.value = newValue;
                }
              }

              /* className={cx("text-primary-main", {"bg-primary-dark": isActive})} */
              if (arg.type === "ObjectExpression") {
                for (const property of arg.properties) {
                  const newValue = matchClassName(property?.key?.value);

                  if (newValue) {
                    property.key.value = newValue;
                  }
                }
              }
            }
            break;

          /* className={isActive && "text-primary-dark"} */
          case "LogicalExpression":
            for (const side of [
              value.expression.left,
              value.expression.right,
            ]) {
              if (side.type === "StringLiteral") {
                const newValue = matchClassName(side.value);

                if (newValue) {
                  side.value = newValue;
                }
              }
            }
            break;

          /*  className={isActive ? "text-primary-light" : "text-primary-main"} */
          case "ConditionalExpression":
            if (value.expression.consequent.type === "StringLiteral") {
              const newValue = matchClassName(
                value.expression.consequent.value,
              );

              if (newValue) {
                value.expression.consequent.value = newValue;
              }
            }

            if (value.expression.alternate.type === "StringLiteral") {
              const newValue = matchClassName(value.expression.alternate.value);

              if (newValue) {
                value.expression.alternate.value = newValue;
              }
            }

            break;

          /* className={`${className} text-primary-dark`} */
          case "TemplateLiteral":
            for (const quasisValue of value.expression.quasis) {
              const newValue = matchClassName(quasisValue.value.raw);

              if (newValue) {
                quasisValue.value.raw = newValue;
              }
            }
            break;
        }
      }
    });

  /**
   * Use JSCodeshift to update the contents of the file.
   */
  return root.toSource();
};

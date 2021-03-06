import { IDictionary, createError } from "common-types";

export function handleError(err: IDictionary, method: string, props: IDictionary = {}) {
  const name = err.code || err.name !== "Error" ? err.name : "AbstractedFirebase";
  const e = createError(
    `abstracted-firebase/${name}`,
    `An error [ ${name} ] occurred in abstracted-firebase while calling the ${method}() method.` +
      props
      ? `\n${JSON.stringify(props, null, 2)}`
      : ""
  );
  e.name = name;
  e.stack = err.stack;

  throw e;
}

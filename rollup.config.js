export default {
  input: "dist/esnext/index.js",
  output: [
    {
      file: "dist/abstracted-firebase.cjs.js",
      format: "cjs",
      name: "AbstractedFirebase",
      sourcemap: true
    },
    {
      file: "dist/abstracted-firebase.umd.js",
      format: "umd",
      name: "AbstractedFirebase",
      sourcemap: true
    }
  ],
  external: ["firebase-api-surface", "typed-conversions", "serialized-query"]
};

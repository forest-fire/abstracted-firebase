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
      sourcemap: true,
      globals: {
        "firebase-api-surface": "firebase-api-surface",
        "typed-conversions": "convert",
        "wait-in-parallel": "Parallel",
        "common-types": "common-types",
        "serialized-query": "serialized-query",
        "abstracted-firebase": "abstractedFirebase"
      }
    }
  ],
  external: ["firebase-api-surface", "typed-conversions", "serialized-query"]
};

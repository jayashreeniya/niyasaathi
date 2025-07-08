module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    quotes: ["error", "double"],
    "max-len": ["error", { "code": 120 }],
    "indent": ["error", 2],
    "object-curly-spacing": ["error", "always"],
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    "camelcase": "off",
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
}; 
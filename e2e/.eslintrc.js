module.exports = {
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": [
    "@typescript-eslint"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "no-var": "off",
    "prefer-const": "off",
    "no-case-declarations": "off",
    "no-useless-escape": "off",
    "no-mixed-spaces-and-tabs": "off",
    "@typescript-eslint/no-var-requires": "off",
    "no-empty": "off"
  },
  "env": {
    "node": true,
    "es6": true
  }
};
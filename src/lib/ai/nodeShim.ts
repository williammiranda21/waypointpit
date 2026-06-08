// Empty browser stub for the Anthropic SDK's Node-only `tools/agent-toolset/*`
// modules. Vite aliases those paths to this file (see vite.config.ts) so the
// bundler doesn't try to walk into Node-only code (fs-util.mjs / skills.mjs /
// node.mjs). We never call the tool-runner helpers — only the bare Messages
// resource — so an empty module is enough.
export {};

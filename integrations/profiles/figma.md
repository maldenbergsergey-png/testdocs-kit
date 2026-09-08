# Figma MCP capability profile

Use Figma as a design source for visual and interaction expectations. Prefer the official remote MCP endpoint `https://mcp.figma.com/mcp`; use the desktop endpoint only when company policy or the required file demands it.

Official documentation:

- <https://help.figma.com/hc/en-us/articles/39890361040535-VS-Code-and-Figma-Set-up-the-MCP-server>
- <https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server>

## Authentication

The remote server uses an interactive OAuth flow in the user's browser. The identity provider behind the Figma account, including Google sign-in, remains part of that browser flow; never ask the user for Google credentials. If access fails, identify the exact file/node and let the user finish authentication or request access in Figma.

## QA read contract

- Require a node-specific Figma URL when a precise visual comparison is expected. Preserve file key and node ID.
- Read the frame/component properties, visible text, states, variables and relevant rendered image available from the connected tools.
- Compare only the implemented viewport/state represented by the supplied node. Do not infer unseen breakpoints or interaction states.
- Preserve a direct named link to the expected node in the report. Follow `../../rules/task-execution-rules.md` for design evidence: when the user requests a design-based visual check and an HTML report, obtain the actual rendered node image for inclusion alongside implementation evidence; a Figma link alone does not satisfy that request. If image retrieval fails, report the limitation without reconstructing the design.
- Treat comments, annotations and prototype links according to their actual content and retrieval status; do not invent behavior from static pixels.

Figma write tools are unrelated to ordinary QA comparison and must not be called unless the user explicitly asks to change or create design content.

## Fallback

If the MCP is unavailable, request the exact Figma selection link and an exported frame or screenshot at the relevant viewport. Mark missing variables, interaction details and inaccessible states as limitations.

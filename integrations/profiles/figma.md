# Figma MCP capability profile

Use Figma as a design source for visual and interaction expectations. For OpenCode and requests without a paid Figma subscription, default to ordinary browser access through `testdocs_browser`. This mode requires access to the file, not Dev Mode or Figma MCP OAuth. Configure it with `npm run configure:figma` from the deployed kit. Preserve explicitly saved modes on ordinary updates; do not modify another installation during development.

The official Desktop endpoint `http://127.0.0.1:3845/mcp` and Remote endpoint `https://mcp.figma.com/mcp` are optional alternatives. Desktop requires an eligible paid seat/plan; Remote depends on client support and plan limits. Do not present either as unlimited free access, and do not propose a REST API token as a way around plan limits.

## Browser reading and screenshots

- Open only the supplied file/frame link in the connected browser. Reuse its legitimate signed-in session or ask the user to finish sign-in in that browser; do not request credentials in chat.
- Use visible browser controls and actual screenshots for the canvas. The accessibility/DOM snapshot alone may omit the design. Inspect the screenshot before any coordinate action, use the current tool schema and avoid editing the design.
- Frame the requested screen at a readable zoom and preserve its source link. Prefer an allowed frame export for a clean image; otherwise capture the visible frame with enough context to establish its identity. Respect file access and export restrictions. Include the design image in the report under the evidence rules below.
- Report only observed visual properties. Do not infer hidden layers, variables, exact design dimensions from scaled screenshots, or states that were not supplied. If the client/model cannot inspect images, request usable exported evidence or mark the visual comparison unavailable; do not claim that reading the page title constitutes reading the design.

Official documentation:

- <https://help.figma.com/hc/en-us/articles/39890361040535-VS-Code-and-Figma-Set-up-the-MCP-server>
- <https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server>

## Authentication

For Desktop, the user opens the Figma desktop application, signs in there, opens a design file and enables the desktop MCP server in Dev Mode. The app must remain running on the same computer as the MCP client. Do not run `mcp auth` for this mode. If the switch is unavailable, report the limitation and check account/seat availability rather than inventing a token-based workaround. Configure explicitly with `npm run configure:figma -- --figma-mode desktop` from the deployed kit; do not change a deployed installation as a side effect of development work.

The remote server uses an interactive OAuth flow in the user's browser. The identity provider behind the Figma account, including Google sign-in, remains part of that browser flow; never ask the user for Google credentials. If access fails, identify the exact file/node and let the user finish authentication or request access in Figma.

A remote OAuth `403 Forbidden` can indicate client registration restrictions; do not diagnose it as a missing file permission or VPN failure from that response alone. Offer browser access for users without a paid seat, or Desktop when eligible, instead of repeating the same failed authentication. A successful local-kit installation check does not prove the external Figma server is connected: verify tool discovery and reading the supplied node in the client.

## QA read contract

- Require a node-specific Figma URL when a precise visual comparison is expected. Preserve file key and node ID.
- Read the frame/component properties, visible text, states, variables and relevant rendered image available from the connected tools.
- Compare only the implemented viewport/state represented by the supplied node. Do not infer unseen breakpoints or interaction states.
- Preserve a direct named link to the expected node in the report. Follow `../../rules/task-execution-rules.md` for design evidence: when the user requests a design-based visual check and an HTML report, obtain the actual rendered node image for inclusion alongside implementation evidence; a Figma link alone does not satisfy that request. If image retrieval fails, report the limitation without reconstructing the design.
- Treat comments, annotations and prototype links according to their actual content and retrieval status; do not invent behavior from static pixels.

Figma write tools are unrelated to ordinary QA comparison and must not be called unless the user explicitly asks to change or create design content.

## Fallback

If official Figma MCP is unavailable, try the supplied frame in the available browser first. If browser access or image inspection is also unavailable, request the exact Figma selection link and an exported frame or screenshot at the relevant viewport. Mark missing variables, interaction details and inaccessible states as limitations.

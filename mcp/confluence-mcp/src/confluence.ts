export interface Pagination {
  size: number;
  startIndex: number;
  hasMore: boolean;
  nextStart?: number;
  nextCursor?: string;
}

export interface SearchResults extends Pagination {
  results: SearchResultItem[];
  totalSize: number | null;
}

export interface SearchResultItem {
  id: string;
  title: string;
  type: string;
  space?: { key: string; name: string };
  excerpt: string;
  url: string;
  lastModified: string;
}

export interface ConfluencePage {
  id: string;
  title: string;
  status: string;
  space?: { key: string; name: string };
  body: string;
  ancestors?: { id: string; title: string; url: string }[];
  version?: {
    number: number;
    by: { displayName: string; email: string };
    when: string;
  };
  url: string;
  lastModified: string;
}

export interface SpacePage {
  id: string;
  title: string;
  status: string;
  space: { key: string; name: string };
  url: string;
}

function knownTotal(data: Record<string, unknown>): number | null {
  return typeof data.totalSize === "number" && Number.isInteger(data.totalSize) && data.totalSize >= 0
    ? data.totalSize : null;
}

function pagination(data: Record<string, unknown>, size: number, start: number, currentCursor?: string): Pagination {
  const startIndex = Number(data.start ?? data.startIndex ?? start);
  const next = (data._links as Record<string, string> | undefined)?.next;
  const result: Pagination = { size, startIndex, hasMore: Boolean(next) };
  if (next) {
    // Extract continuation only; never fetch a server-provided URL or change the original scope.
    try {
      const params = new URL(next, "https://pagination.invalid").searchParams;
      const cursor = params.get("cursor");
      const offset = params.get("start");
      if (cursor) {
        if (cursor !== currentCursor) result.nextCursor = cursor;
      } else if (offset !== null && /^\d+$/.test(offset) && Number(offset) > startIndex) result.nextStart = Number(offset);
    } catch { /* Keep hasMore true so an unusable continuation cannot imply completeness. */ }
  } else {
    const total = knownTotal(data);
    if (!currentCursor && total !== null && startIndex + size < total) {
      result.hasMore = true;
      if (size > 0) result.nextStart = startIndex + size;
    }
  }
  return result;
}

const { fetchWithSession } = require("../../session-auth.cjs") as {
  fetchWithSession: (url: string, options: RequestInit, session: {
    service: string; sessionFile?: string; baseUrl: string; spSecret: string; bootstrapAuthorization?: string;
  }) => Promise<{ response: Response; body: string }>;
};

export type AuthMode = "basic" | "bearer" | "browser_session";

const { fetchWithSpSecret, redactSpSecret, withHttpDiagnostics, redactHttpText } = require("../../atlassian-http.cjs") as {
  fetchWithSpSecret: (url: string, options: RequestInit, secret?: string) => Promise<Response>;
  redactSpSecret: (message: string, secret?: string) => string;
  withHttpDiagnostics: (error: Error, response: Response, body?: string) => Error;
  redactHttpText: (response: Response, text: string) => string;
};

export class ConfluenceClient {
  private baseUrl: string;
  private authHeader?: string;
  private useSession: boolean;

  constructor(
    baseUrl: string,
    username: string,
    apiToken: string,
    authMode: AuthMode = "basic",
    private sessionFile?: string,
    private spSecret = "",
    passwordSession = false,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.useSession = authMode === "browser_session" || (authMode === "basic" && passwordSession);

    if (authMode === "browser_session") {
      this.authHeader = undefined;
    } else if (authMode === "bearer") {
      this.authHeader = `Bearer ${apiToken}`;
    } else {
      this.authHeader = `Basic ${Buffer.from(`${username}:${apiToken}`).toString("base64")}`;
    }
  }

  private async request(path: string, params?: Record<string, string>) {
    const url = new URL(`${this.baseUrl}/rest/api${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    let res: Response;
    let body: string;
    try {
      const options = { headers: { Accept: "application/json" } };
      if (this.useSession) {
        ({ response: res, body } = await fetchWithSession(url.toString(), options, {
          service: "confluence", sessionFile: this.sessionFile, baseUrl: this.baseUrl,
          spSecret: this.spSecret, bootstrapAuthorization: this.authHeader,
        }));
      } else {
        res = await fetchWithSpSecret(url.toString(), {
          redirect: "follow", headers: { ...options.headers, Authorization: this.authHeader! },
        }, this.spSecret);
        body = await res.text();
      }
    } catch (error) {
      const cause = (error as { code?: string; cause?: { code?: string; message?: string }; message?: string });
      if (cause.code === "AUTH_REQUIRED" || cause.message?.startsWith("SESSION_BUSY:")) throw error;
      const details = cause.cause?.code ?? cause.cause?.message ?? cause.message ?? "unknown network error";
      throw new Error(redactSpSecret(`Confluence network request failed for ${url.origin}${url.pathname}: ${details}`, this.spSecret));
    }

    if (!res.ok) {
      throw withHttpDiagnostics(new Error(redactSpSecret(
        `Confluence API error ${res.status}: ${res.statusText}\n${redactHttpText(res, body)}`, this.spSecret
      )), res, body);
    }

    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      throw withHttpDiagnostics(new Error(redactSpSecret(
        `Confluence returned invalid JSON (${res.status}) for ${url.origin}${url.pathname}: JSON parse error`, this.spSecret
      )), res, body);
    }
  }

  async search(query: string, limit?: number, start = 0, cursor?: string): Promise<SearchResults> {
    const l = Math.min(limit ?? 10, 25);
    const data = await this.request("/content/search", {
      cql: query,
      limit: String(l),
      ...(cursor ? { cursor } : { start: String(start) }),
      excerpt: "full",
      expand: "space,version",
    });

    const results = ((data.results as Record<string, unknown>[]) ?? []).map(
      (r): SearchResultItem => ({
        id: String(r.id),
        title: String(r.title ?? ""),
        type: String(r.type ?? ""),
        space: r.space as { key: string; name: string } | undefined,
        excerpt: String((r.excerpt as string) ?? ""),
        url: r._links
          ? `${this.baseUrl}${(r._links as Record<string, string>).webui}`
          : "",
        lastModified: String(
          ((r.history as Record<string, unknown>)?.lastUpdated as { when: string } | undefined)?.when ??
            ((r.version as Record<string, unknown> as { when: string } | undefined)?.when ?? "")
        ),
      })
    );

    return {
      results,
      totalSize: knownTotal(data),
      ...pagination(data, results.length, start, cursor),
    };
  }

  async getPage(pageId: string, includeVersion?: boolean): Promise<ConfluencePage> {
    const expand = ["body.storage", "space", "history.lastUpdated", "ancestors"];
    if (includeVersion) expand.push("version");

    const data = await this.request(`/content/${pageId}`, {
      expand: expand.join(","),
    });

    const versionData = data.version as
      | { number: number; by: { displayName: string; email: string }; when: string }
      | undefined;

    return {
      id: String(data.id),
      title: String(data.title ?? ""),
      status: String(data.status ?? ""),
      space: data.space as { key: string; name: string } | undefined,
      body: (data.body as Record<string, Record<string, string>>)?.storage?.value ?? "",
      ancestors: Array.isArray(data.ancestors) ? data.ancestors.map((ancestor: Record<string, unknown>) => ({
        id: String(ancestor.id),
        title: String(ancestor.title ?? ""),
        url: (ancestor._links as Record<string, string> | undefined)?.webui
          ? `${this.baseUrl}${(ancestor._links as Record<string, string>).webui}` : "",
      })) : undefined,
      version: includeVersion
        ? {
            number: versionData?.number ?? 0,
            by: versionData?.by ?? { displayName: "", email: "" },
            when: versionData?.when ?? "",
          }
        : undefined,
      url: data._links
        ? `${this.baseUrl}${(data._links as Record<string, string>).webui}`
        : "",
      lastModified: String(
        (data.history as Record<string, Record<string, { when: string }>>)
          ?.lastUpdated?.when ?? ""
      ),
    };
  }

  async getPageAsMarkdown(pageId: string): Promise<string> {
    const data = await this.request(`/content/${pageId}`, {
      expand: "body.storage,space,history.lastUpdated",
    });

    const body =
      (data.body as Record<string, Record<string, string>>)?.storage?.value ??
      "";
    const title = String(data.title ?? "Untitled");
    const space = data.space as { key: string; name: string } | undefined;
    const lastModified = String(
      (data.history as Record<string, Record<string, { when: string }>>)
        ?.lastUpdated?.when ?? ""
    );

    const text = htmlToMarkdown(body);

    let header = `# ${title}`;
    if (space) header += `\n**Space:** ${space.name} (${space.key})`;
    if (lastModified) header += `\n**Last modified:** ${lastModified}`;
    header += `\n\n---\n\n`;

    return header + text;
  }

  async getSpacePages(
    spaceKey: string,
    limit?: number,
    start?: number
  ): Promise<{ pages: SpacePage[]; total: number }> {
    const l = Math.min(limit ?? 25, 50);
    const s = start ?? 0;

    const data = await this.request(`/space/${spaceKey}/content/page`, {
      limit: String(l),
      start: String(s),
      expand: "space",
    });

    const pages = ((data.results as Record<string, unknown>[]) ?? []).map(
      (r): SpacePage => ({
        id: String(r.id),
        title: String(r.title ?? ""),
        status: String(r.status ?? ""),
        space: r.space as { key: string; name: string },
        url: r._links
          ? `${this.baseUrl}${(r._links as Record<string, string>).webui}`
          : "",
      })
    );

    return {
      pages,
      total: (data.size as number) ?? pages.length,
    };
  }

  async getPageChildren(
    pageId: string,
    limit?: number,
    start = 0,
    cursor?: string
  ): Promise<{ children: SpacePage[]; total: number | null } & Pagination> {
    const l = Math.min(limit ?? 25, 50);

    const data = await this.request(`/content/${pageId}/child/page`, {
      limit: String(l),
      ...(cursor ? { cursor } : { start: String(start) }),
      expand: "space",
    });

    const children = ((data.results as Record<string, unknown>[]) ?? []).map(
      (r): SpacePage => ({
        id: String(r.id),
        title: String(r.title ?? ""),
        status: String(r.status ?? ""),
        space: r.space as { key: string; name: string },
        url: r._links
          ? `${this.baseUrl}${(r._links as Record<string, string>).webui}`
          : "",
      })
    );

    return {
      children,
      total: knownTotal(data),
      ...pagination(data, children.length, start, cursor),
    };
  }
}

function htmlToMarkdown(html: string): string {
  let text = html;

  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n");
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n");
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n");
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n#### $1\n");
  text = text.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "\n##### $1\n");
  text = text.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "\n###### $1\n");

  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  text = text.replace(
    /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi,
    "[$2]($1)"
  );

  text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
  text = text.replace(
    /<pre[^>]*>(.*?)<\/pre>/gis,
    "\n```\n$1\n```\n"
  );

  text = text.replace(/<br\s*\/?>/gi, "\n");

  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, "\n- $1");

  text = text.replace(/<ul[^>]*>|<\/ul>/gi, "\n");
  text = text.replace(/<ol[^>]*>|<\/ol>/gi, "\n");
  text = text.replace(/<dl[^>]*>|<\/dl>/gi, "\n");
  text = text.replace(/<dt[^>]*>(.*?)<\/dt>/gi, "\n**$1** ");
  text = text.replace(/<dd[^>]*>(.*?)<\/dd>/gi, "$1\n");

  text = text.replace(/<p[^>]*>(.*?)<\/p>/gis, "\n$1\n");

  text = text.replace(/<hr\s*\/?>/gi, "\n---\n");
  text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, "\n> $1\n");

  text = text.replace(
    /<ac:structured-macro[^>]*ac:name="code"[^>]*>(.*?)<\/ac:structured-macro>/gis,
    (_match, inner: string) => {
      const langMatch = inner.match(
        /<ac:parameter[^>]*ac:name="language"[^>]*>(.*?)<\/ac:parameter>/
      );
      const lang = langMatch ? langMatch[1] : "";
      const codeMatch = inner.match(
        /<ac:plain-text-body[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>/
      );
      const code = codeMatch ? codeMatch[1] : inner;
      return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
    }
  );

  text = text.replace(
    /<ac:structured-macro[^>]*ac:name="info"[^>]*>(.*?)<\/ac:structured-macro>/gis,
    "\n> ℹ️ $1\n"
  );
  text = text.replace(
    /<ac:structured-macro[^>]*ac:name="note"[^>]*>(.*?)<\/ac:structured-macro>/gis,
    "\n> ⚠️ $1\n"
  );
  text = text.replace(
    /<ac:structured-macro[^>]*ac:name="warning"[^>]*>(.*?)<\/ac:structured-macro>/gis,
    "\n> 🔴 $1\n"
  );

  text = text.replace(/<ac:parameter[^>]*>[\s\S]*?<\/ac:parameter>/gi, "");
  text = text.replace(/<ac:plain-text-body[^>]*>[\s\S]*?<\/ac:plain-text-body>/gi, "");
  text = text.replace(/<\/?ac:[^>]*>/gi, "");

  text = text.replace(/<table[^>]*>|<\/table>/gi, "\n");
  text = text.replace(/<thead[^>]*>|<\/thead>/gi, "");
  text = text.replace(/<tbody[^>]*>|<\/tbody>/gi, "");
  text = text.replace(/<tr[^>]*>|<\/tr>/gi, "\n");
  text = text.replace(/<th[^>]*>(.*?)<\/th>/gi, "| $1 ");
  text = text.replace(/<td[^>]*>(.*?)<\/td>/gi, "| $1 ");

  text = text.replace(/<[^>]+>/g, "");

  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");

  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}

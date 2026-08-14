export interface SearchResults {
  results: SearchResultItem[];
  totalSize: number;
  startIndex: number;
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

export type AuthMode = "basic" | "bearer";

export class ConfluenceClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(
    baseUrl: string,
    username: string,
    apiToken: string,
    authMode: AuthMode = "basic"
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");

    if (authMode === "bearer") {
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

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Confluence API error ${res.status}: ${res.statusText}\n${body}`
      );
    }

    return res.json() as Promise<Record<string, unknown>>;
  }

  async search(query: string, limit?: number): Promise<SearchResults> {
    const l = Math.min(limit ?? 10, 25);
    const data = await this.request("/content/search", {
      cql: query,
      limit: String(l),
      excerpt: "full",
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
      totalSize: (data.totalSize as number) ?? results.length,
      startIndex: (data.startIndex as number) ?? 0,
    };
  }

  async getPage(pageId: string, includeVersion?: boolean): Promise<ConfluencePage> {
    const expand = ["body.storage", "space", "history.lastUpdated"];
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
    limit?: number
  ): Promise<{ children: SpacePage[]; total: number }> {
    const l = Math.min(limit ?? 25, 50);

    const data = await this.request(`/content/${pageId}/child/page`, {
      limit: String(l),
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
      total: (data.size as number) ?? children.length,
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

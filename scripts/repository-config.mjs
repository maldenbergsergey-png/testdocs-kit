import path from "node:path";

function text(value, label) {
  if (value !== undefined && typeof value !== "string") throw new Error(`${label}: ожидается строка.`);
  return (value || "").trim();
}

export function gitTransport(value) {
  const url = text(value, "URL репозитория");
  if (/^[\w.-]+@[\w.-]+:[^\s?#]+$/.test(url)) return "ssh";
  try {
    const parsed = new URL(url);
    if (parsed.search || parsed.hash || parsed.password || !parsed.hostname || !parsed.pathname.replaceAll("/", "")) throw new Error();
    if (parsed.protocol === "ssh:") return "ssh";
    if (parsed.protocol === "https:" && !parsed.username) return "https";
  } catch { /* Return a constant error; never echo a credential-bearing URL. */ }
  throw new Error("Нужен clone URL по SSH или HTTPS без токена, пароля, query и fragment.");
}

function relativeFile(value, label) {
  const result = text(value, label).replaceAll("\\", "/");
  if (result && (path.posix.isAbsolute(result) || /^[a-z]:/i.test(result) || result.split("/").includes("..") || /[\r\n\0]/.test(result))) {
    throw new Error(`${label}: нужен путь внутри репозитория.`);
  }
  return result;
}

function localPath(value) {
  const result = text(value, "Локальный путь");
  if (result && !path.isAbsolute(result)) throw new Error("Локальный путь должен быть абсолютным на текущем компьютере.");
  return result;
}

function ref(value) {
  const result = text(value, "Ветка/ref");
  if (result && (result.startsWith("-") || /[\s\x00-\x1f~^:?*\[\\]/.test(result) || result.includes("..") || result.includes("@{"))) {
    throw new Error("Некорректная ветка/ref.");
  }
  return result;
}

function fields(entry, allowed) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Некорректная привязка репозитория.");
  if (Object.keys(entry).some(key => !allowed.includes(key))) throw new Error("Неизвестное поле привязки; секреты и приватные ключи здесь не сохраняются.");
  if (entry.enabled !== undefined && typeof entry.enabled !== "boolean") throw new Error("enabled должен быть boolean.");
}

export function normalizeRepositories(input = {}) {
  fields(input, ["postman", "sources"]);
  const output = { sources: [] };
  if (input.postman) {
    const entry = input.postman;
    fields(entry, ["enabled", "url", "localPath", "collectionPath", "baseBranch", "allowPush"]);
    if (entry.allowPush !== undefined && typeof entry.allowPush !== "boolean") throw new Error("allowPush должен быть boolean.");
    output.postman = {
      enabled: entry.enabled === true,
      url: text(entry.url, "URL коллекции"),
      localPath: localPath(entry.localPath),
      collectionPath: relativeFile(entry.collectionPath, "Путь коллекции"),
      baseBranch: ref(entry.baseBranch),
      allowPush: entry.allowPush === true
    };
    if (output.postman.enabled || output.postman.url) gitTransport(output.postman.url);
  }
  if (input.sources !== undefined && !Array.isArray(input.sources)) throw new Error("sources должен быть массивом.");
  const ids = new Set(["postman"]);
  for (const entry of input.sources || []) {
    fields(entry, ["id", "enabled", "transport", "url", "localPath", "project", "contractPath", "defaultRef", "tokenEnv", "tokenFile"]);
    const id = text(entry.id, "ID источника");
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) || ids.has(id)) throw new Error("Нужен уникальный ID источника: латиница, цифры и дефис; postman зарезервирован.");
    ids.add(id);
    if (!["git", "gitlab_api"].includes(entry.transport)) throw new Error("Транспорт источника: git или gitlab_api.");
    const source = {
      id, enabled: entry.enabled !== false, transport: entry.transport,
      url: text(entry.url, "URL источника"),
      localPath: localPath(entry.localPath),
      project: text(entry.project, "GitLab project"),
      contractPath: relativeFile(entry.contractPath, "Путь контракта"),
      defaultRef: ref(entry.defaultRef)
    };
    if (source.transport === "git") {
      gitTransport(source.url);
      if (entry.tokenEnv || entry.tokenFile) throw new Error("Для Git используйте SSH agent или системный credential helper; ссылки на токен относятся к REST API.");
    } else {
      let parsed;
      try { parsed = new URL(source.url); } catch { throw new Error("Нужен HTTPS-адрес сервера GitLab."); }
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("Нужен HTTPS-адрес сервера GitLab без учётных данных.");
      source.url = source.url.replace(/\/+$/, "");
      source.tokenEnv = text(entry.tokenEnv, "Имя переменной токена");
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(source.tokenEnv)) throw new Error("tokenEnv должен содержать имя переменной окружения, не значение токена.");
      source.tokenFile = localPath(entry.tokenFile);
      if (source.localPath) throw new Error("Для gitlab_api локальный checkout не требуется; используйте транспорт git для checkout.");
    }
    output.sources.push(source);
  }
  return output;
}

export async function collectRepositories(previous = {}, { ask, confirm, askSecret, saveToken, section = "all" }) {
  const config = normalizeRepositories(previous);
  if (["all", "postman"].includes(section)) {
    const old = config.postman || {};
    if (await confirm("Настроить основной Git-репозиторий Postman-коллекции (любой Git-хост)", old.enabled ?? false)) {
      console.log("Git использует локальный SSH agent или credential helper. Приватные ключи и токены сюда не вводятся.");
      config.postman = {
        enabled: true,
        url: await ask("Clone URL коллекции: SSH или HTTPS", old.url || ""),
        localPath: await ask("Абсолютный путь локального клона (пусто - клонировать позднее)", old.localPath || ""),
        collectionPath: await ask("Путь коллекции внутри репозитория: папка v3 или JSON v2.1 (пусто - обнаружить при работе)", old.collectionPath || ""),
        baseBranch: await ask("Базовая ветка коллекции (пусто - объявленная default branch репозитория)", old.baseBranch || ""),
        allowPush: await confirm("Разрешить Git push коллекции по явному запросу", old.allowPush === true)
      };
    } else if (config.postman) config.postman.enabled = false;
  }
  if (["all", "sources"].includes(section)) {
    const collect = async old => {
      if (!await confirm(`Настроить источник кода/контрактов ${old.id}`, old.enabled ?? true)) return old.transport ? { ...old, enabled: false } : null;
      const transport = await ask("Чтение источника: gitlab_api - REST с read-only PAT; git - SSH/HTTPS checkout", old.transport || "gitlab_api");
      const same = old.transport === transport;
      const result = {
        id: old.id, enabled: true, transport,
        url: await ask(transport === "gitlab_api" ? "HTTPS-адрес сервера GitLab (с подкаталогом, если есть)" : "Clone URL репозитория кода/контрактов", same ? old.url || "" : ""),
        localPath: transport === "git" ? await ask("Абсолютный путь checkout (пусто - клонировать позднее)", same ? old.localPath || "" : "") : "",
        project: transport === "gitlab_api" ? await ask("GitLab project ID или group/project (можно указать в задаче)", old.project || "") : "",
        contractPath: await ask("Путь YAML/JSON контракта (можно указать в задаче)", old.contractPath || ""),
        defaultRef: await ask("Ref по умолчанию при отсутствии ветки в задаче (пусто - уточнить при работе)", old.defaultRef || "")
      };
      if (transport === "gitlab_api") {
        result.tokenEnv = await ask("Имя переменной окружения с GitLab PAT (можно использовать сохранённый приватный файл)", same && old.tokenEnv ? old.tokenEnv : `TESTDOCS_${old.id.toUpperCase().replaceAll("-", "_")}_TOKEN`);
        result.tokenFile = same ? old.tokenFile || "" : "";
        console.log("Рекомендуется персональный PAT с read_api: все доступные аккаунту проекты, код и MR. read_repository дополнительно нужен для Git clone по HTTPS. SSH сам по себе не ограничивает права чтением.");
        normalizeRepositories({ sources: [result] });
        if (askSecret && saveToken) {
          const token = (await askSecret("Read-only GitLab PAT (скрыто; Enter - окружение или ранее сохранённый токен)")).trim();
          if (token) result.tokenFile = saveToken(old.id, token);
        }
      }
      return result;
    };
    config.sources = [];
    for (const old of previous.sources || []) {
      const result = await collect(old);
      if (result) config.sources.push(result);
    }
    while (await confirm("Добавить источник кода/контрактов (отдельный от коллекции)", false)) {
      const id = await ask("Уникальный ID источника, например backend-contracts", "");
      const result = await collect({ id });
      if (result) config.sources.push(result);
    }
  }
  return normalizeRepositories(config);
}

import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
export function reviewKey(pr) {
  return createHash("sha256")
    .update(`${pr.org}/${pr.project}/${pr.repo}/${pr.id}/${pr.after}`)
    .digest("hex");
}
export class Store {
  constructor(dir) {
    this.dir = dir;
    this.queues = new Map();
  }
  async read(key) {
    try {
      return JSON.parse(
        await readFile(path.join(this.dir, key + ".json"), "utf8"),
      );
    } catch (e) {
      if (e.code === "ENOENT") return { reviewed: [], notes: [] };
      throw e;
    }
  }
  async update(key, fn) {
    const job = (this.queues.get(key) || Promise.resolve())
      .catch(() => {})
      .then(async () => {
        const current = await this.read(key);
        const next = await fn(current);
        await mkdir(this.dir, { recursive: true });
        const file = path.join(this.dir, key + ".json");
        const tmp = file + "." + randomUUID() + ".tmp";
        await writeFile(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
        await rename(tmp, file);
        return next;
      });
    this.queues.set(key, job);
    try {
      return await job;
    } finally {
      if (this.queues.get(key) === job) this.queues.delete(key);
    }
  }
  async recent(demo = false) {
    return (await this.read(demo ? "recent-demo" : "recent")).items || [];
  }
  async touch(pr) {
    const key = pr.demo ? "recent-demo" : "recent";
    await this.update(key, (current) => ({
      items: [
        {
          url: pr.url,
          title: pr.title,
          org: pr.org,
          project: pr.project,
          repo: pr.repo,
          id: pr.id,
          demo: !!pr.demo,
          lastOpened: new Date().toISOString(),
          snapshot: pr,
        },
        ...(current.items || []).filter((item) => item.url !== pr.url),
      ].slice(0, 30),
    }));
  }
  async prepare(pr, previous) {
    previous ??= (await this.recent(!!pr.demo)).find(
      (item) => item.url === pr.url,
    )?.snapshot;
    if (
      previous &&
      (previous.after !== pr.after || previous.before !== pr.before)
    ) {
      const prior = await this.update(
        reviewKey(previous),
        (current) => current,
      );
      const sameFile = (file) => {
        const old = previous.files.find((f) => f.path === file.path);
        return (
          old &&
          file.objectId &&
          old.objectId === file.objectId &&
          old.originalPath === file.originalPath &&
          (previous.before === pr.before ||
            (file.originalObjectId &&
              old.originalObjectId === file.originalObjectId) ||
            (file.change === "add" && old.change === "add"))
        );
      };
      const keep = prior.reviewed.filter((p) =>
        pr.files.some((f) => f.path === p && sameFile(f)),
      );
      await this.update(reviewKey(pr), (current) => {
        const notes = new Map(
          prior.notes.map((note) => [
            note.id,
            {
              commit: previous.after,
              baseCommit: previous.before,
              iteration: previous.iteration,
              originalPath:
                previous.files.find((f) => f.path === note.path)
                  ?.originalPath || note.path,
              trackingId: previous.files.find((f) => f.path === note.path)
                ?.trackingId,
              ...note,
            },
          ]),
        );
        for (const note of current.notes)
          notes.set(note.id, { ...notes.get(note.id), ...note });
        return {
          ...current,
          reviewed:
            reviewKey(pr) === reviewKey(previous)
              ? keep
              : [...new Set([...current.reviewed, ...keep])].filter((p) =>
                  pr.files.some((f) => f.path === p),
                ),
          notes: [...notes.values()],
        };
      });
    }
    await this.touch(pr);
    return this.read(reviewKey(pr));
  }
}

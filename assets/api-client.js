(function () {
  "use strict";

  const API_ROOT = "/api/v1";
  const OFFLINE_QUEUE_KEY = "mep-offline-queue-v1";

  function cookie(name) {
    const prefix = `${encodeURIComponent(name)}=`;
    return document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix))?.slice(prefix.length) || "";
  }

  async function request(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrf = decodeURIComponent(cookie("mep_csrf"));
      if (csrf) headers.set("X-CSRF-Token", csrf);
    }
    const response = await fetch(`${API_ROOT}${path}`, { ...options, method, headers, credentials: "include" });
    if (response.status === 204) return null;
    const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const error = new Error(typeof payload === "object" ? payload.detail?.message || payload.detail || "Erreur serveur" : payload);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  let workspaceRevision = null;
  let saveTimer = null;
  let saveWaiters = [];

  const ServerAPI = {
    request,

    login(username, password) {
      return request("/auth/login", { method: "POST", body: JSON.stringify({ username, password, auto_register: true }) });
    },

    register(username, password) {
      return request("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) });
    },

    me() {
      return request("/auth/me");
    },

    storage() {
      return request("/users/me/storage");
    },

    logout() {
      return request("/auth/logout", { method: "POST" });
    },

    changePassword(currentPassword, newPassword) {
      return request("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, revoke_other_sessions: true })
      });
    },

    async loadWorkspace() {
      const workspace = await request("/workspace");
      workspaceRevision = workspace.revision;
      return workspace;
    },

    async saveWorkspace(content, immediate = false) {
      const save = async () => {
        try {
          const workspace = await request("/workspace", {
            method: "PUT",
            body: JSON.stringify({ schema_version: 2, expected_revision: workspaceRevision, content })
          });
          workspaceRevision = workspace.revision;
          localStorage.removeItem(OFFLINE_QUEUE_KEY);
          return workspace;
        } catch (error) {
          localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), baseRevision: workspaceRevision, content }));
          throw error;
        }
      };
      if (immediate) return save();
      clearTimeout(saveTimer);
      return new Promise((resolve, reject) => {
        saveWaiters.push({ resolve, reject });
        saveTimer = setTimeout(async () => {
          const waiters = saveWaiters;
          saveWaiters = [];
          try {
            const result = await save();
            waiters.forEach((waiter) => waiter.resolve(result));
          } catch (error) {
            waiters.forEach((waiter) => waiter.reject(error));
          }
        }, 450);
      });
    },

    async replayOfflineDraft() {
      const draft = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "null");
      if (!draft?.content) return null;
      if (draft.baseRevision !== workspaceRevision) {
        throw new Error("Le brouillon local est basé sur une ancienne version.");
      }
      return this.saveWorkspace(draft.content, true);
    },

    importLocalStorage(storageKey, content, clientCounts) {
      const identity = `${storageKey}:${JSON.stringify(clientCounts)}`;
      let hash = 0;
      for (let index = 0; index < identity.length; index += 1) hash = ((hash << 5) - hash + identity.charCodeAt(index)) | 0;
      return request("/imports", {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: `local-${Math.abs(hash)}-${content.demoVersion || 0}`,
          source: "localStorage",
          storage_key: storageKey,
          content,
          client_counts: clientCounts
        })
      });
    },

    upload(file) {
      const body = new FormData();
      body.append("upload", file);
      return request("/files", { method: "POST", body });
    }
  };

  window.ServerAPI = ServerAPI;
})();
